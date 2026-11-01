/**
 * API žádostí o přidání podniku: odeslání, admin schválení, zveřejněný katalog.
 * Admin oprávnění jen z profiles.is_admin (RLS / store), ne z klientského JS.
 */

import { createHash } from 'node:crypto'
import { curatedPlaces } from '../data/curatedPlaces.js'
import { osmPlaces } from '../data/osmPlaces.js'
import {
  assessBusinessApplication,
  normalizeKey,
  publicApplicationView,
  publishedPlaceFromApplication,
  toCatalogRestaurant,
  uniquePlaceId,
} from '../utils/businessApplication.js'
import { authConfig, clientKey, resolveUser } from './supabaseAuth.js'
import { sendBusinessApprovalEmail } from './businessMail.js'
import { rememberPublishedId } from './publishedPlaceIds.js'
import { reviewDescription } from '../utils/descriptionReview.js'
import { checkPlaceExistence } from './placeExistence.js'

function sanitizeExistenceCandidates(raw) {
  const list = Array.isArray(raw) ? raw : []
  return list.slice(0, 5).map((item) => ({
    placeId: String(item?.placeId ?? '').slice(0, 120),
    name: String(item?.name ?? '').slice(0, 160),
    address: String(item?.address ?? '').slice(0, 200),
    score: Number.isFinite(Number(item?.score)) ? Number(item.score) : undefined,
  }))
}

function applicationRowFields(payload, meta = {}) {
  return {
    status: 'pending',
    plan_id: payload.planId,
    business_name: payload.businessName,
    address: payload.address,
    locality: payload.locality,
    category: payload.category,
    category_label: payload.categoryLabel,
    cuisine_focus: payload.cuisineFocus || '',
    description: payload.description,
    description_original: payload.descriptionOriginal || payload.description || '',
    description_review_engine: payload.descriptionReviewEngine === 'rules' ? 'rules' : '',
    description_review_notes: String(payload.descriptionReviewNotes || '').slice(0, 1000),
    owner_email: payload.ownerEmail,
    website: payload.website || '',
    photo_mime: payload.photo?.mime || null,
    photo_data: payload.photo?.dataUrl || null,
    proposed_place_id: payload.proposedPlaceId,
    published_place_id: null,
    admin_note: '',
    email_status: 'not_sent',
    email_error: '',
    email_sent_at: null,
    existence_status: payload.existenceStatus || 'unavailable',
    existence_summary: String(payload.existenceSummary || '').slice(0, 600),
    // Veřejný insert vždy vyžaduje ruční kontrolu (RLS to také vynucuje).
    existence_requires_manual: true,
    existence_candidates: sanitizeExistenceCandidates(payload.existenceCandidates),
    duplicate_of: '',
    submitter_ip_hash: meta.ipHash || '',
  }
}

const WRITE_WINDOW_MS = 60 * 60 * 1000
const WRITE_MAX = 5
const writeAttempts = new Map()

const staticPlaces = [...curatedPlaces, ...osmPlaces]
const staticIds = new Set(staticPlaces.map((p) => p.id))
const staticKeys = new Set(staticPlaces.map((p) => normalizeKey(p.name, p.address)))

export function resetBusinessLimits() {
  writeAttempts.clear()
}

function allowSubmit(request) {
  const key = clientKey(request)
  const now = Date.now()
  const prev = (writeAttempts.get(key) ?? []).filter((time) => now - time < WRITE_WINDOW_MS)
  if (prev.length >= WRITE_MAX) {
    writeAttempts.set(key, prev)
    return false
  }
  prev.push(now)
  writeAttempts.set(key, prev)
  return true
}

function json(body, status = 200, cookies = []) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

function notConfigured(cookies = []) {
  return json(
    {
      ok: false,
      configured: false,
      error: 'auth-not-configured',
      message: 'Supabase na serveru ještě není nastavené (SUPABASE_URL / SUPABASE_ANON_KEY).',
    },
    503,
    cookies,
  )
}

function ipHash(request) {
  const ip = clientKey(request)
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

function publicSiteOrigin(request, env) {
  const configured = String(env.PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '')
  if (configured) return configured
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
    .split(',')[0]
    .trim()
  if (!host) return ''
  const forwarded = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim()
  const localHost = host.startsWith('localhost') || host.startsWith('127.0.0.1')
  const proto = forwarded || (localHost ? 'http' : 'https')
  return `${proto}://${host}`
}

async function rest(config, token, fetchImpl, path, { method = 'GET', body, prefer } = {}) {
  const headers = new Headers({
    apikey: config.anonKey,
    authorization: `Bearer ${token || config.anonKey}`,
    accept: 'application/json',
  })
  if (body !== undefined) headers.set('content-type', 'application/json')
  if (prefer) headers.set('prefer', prefer)
  const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return { ok: true, body: [] }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const msg = payload?.message || payload?.error_description || ''
    if (response.status === 404 || /relation|does not exist|schema cache/i.test(msg)) {
      return { ok: false, status: 503, error: 'not-ready' }
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, error: 'forbidden', message: msg }
    }
    return { ok: false, status: response.status || 502, error: 'failed', message: msg }
  }
  return { ok: true, body: payload }
}

function mapAppRow(row) {
  return row
}

export function createMemoryBusinessStore() {
  const applications = []
  const published = []
  const admins = new Set()
  let seq = 0
  const nextId = () => {
    seq += 1
    return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`
  }

  return {
    async isAdmin(userId) {
      return admins.has(userId)
    },
    grantAdmin(userId) {
      admins.add(userId)
    },
    async listPublished() {
      return { ok: true, places: published.map((row) => ({ ...row })) }
    },
    async existingKeysAndIds() {
      const keys = new Set(staticKeys)
      const ids = new Set(staticIds)
      for (const row of applications) {
        if (row.status === 'rejected') continue
        keys.add(normalizeKey(row.business_name, row.address))
        ids.add(row.proposed_place_id)
        if (row.published_place_id) ids.add(row.published_place_id)
      }
      for (const place of published) ids.add(place.id)
      return { ok: true, keys, ids }
    },
    async createApplication(payload, meta) {
      const id = nextId()
      const now = new Date().toISOString()
      const row = {
        id,
        ...applicationRowFields(payload, meta),
        created_at: now,
        updated_at: now,
        reviewed_at: null,
        reviewed_by: null,
      }
      applications.push(row)
      return { ok: true, row }
    },
    async listApplications(status) {
      let rows = [...applications]
      if (status) rows = rows.filter((row) => row.status === status)
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
      return { ok: true, rows }
    },
    async getApplication(id) {
      const row = applications.find((item) => item.id === id)
      if (!row) return { ok: false, status: 404, error: 'missing' }
      return { ok: true, row }
    },
    async updateApplication(id, patch) {
      const row = applications.find((item) => item.id === id)
      if (!row) return { ok: false, status: 404, error: 'missing' }
      Object.assign(row, patch, { updated_at: new Date().toISOString() })
      return { ok: true, row }
    },
    async upsertPublished(place, applicationId) {
      const existing = published.find((row) => row.id === place.id || row.application_id === applicationId)
      if (existing) {
        Object.assign(existing, {
          name: place.name,
          description: place.description,
          type: place.type,
          category: place.category,
          address: place.address,
          website: place.website || '',
          image_data_url: place.imageDataUrl || null,
          updated_at: new Date().toISOString(),
        })
        rememberPublishedId(existing.id)
        return { ok: true, row: existing, created: false }
      }
      const row = {
        id: place.id,
        application_id: applicationId,
        name: place.name,
        description: place.description,
        type: place.type,
        category: place.category,
        address: place.address,
        website: place.website || '',
        image_data_url: place.imageDataUrl || null,
        source: 'owner_application',
        is_new: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      published.push(row)
      rememberPublishedId(row.id)
      return { ok: true, row, created: true }
    },
  }
}

export function createSupabaseBusinessStore({ config, accessToken, fetchImpl }) {
  const token = accessToken || config.anonKey

  return {
    async isAdmin(userId) {
      if (!accessToken || !userId) return false
      const result = await rest(
        config,
        accessToken,
        fetchImpl,
        `profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
      )
      if (!result.ok) return false
      return Boolean(result.body?.[0]?.is_admin)
    },
    async listPublished() {
      const result = await rest(
        config,
        config.anonKey,
        fetchImpl,
        'published_places?select=id,name,description,type,category,address,website,image_data_url,source,is_new,created_at&order=created_at.desc',
      )
      if (!result.ok) return result
      return { ok: true, places: result.body || [] }
    },
    async existingKeysAndIds() {
      const keys = new Set(staticKeys)
      const ids = new Set(staticIds)
      const published = await this.listPublished()
      if (published.ok) {
        for (const place of published.places) {
          ids.add(place.id)
          keys.add(normalizeKey(place.name, place.address))
        }
      }
      const pending = await rest(
        config,
        token,
        fetchImpl,
        'business_applications?status=in.(pending,approved,needs_changes)&select=business_name,address,proposed_place_id,published_place_id',
      )
      // Anon cannot select applications — that's fine; duplicates among pending rely on server memory + published + static.
      if (pending.ok) {
        for (const row of pending.body || []) {
          keys.add(normalizeKey(row.business_name, row.address))
          if (row.proposed_place_id) ids.add(row.proposed_place_id)
          if (row.published_place_id) ids.add(row.published_place_id)
        }
      }
      return { ok: true, keys, ids }
    },
    async createApplication(payload, meta) {
      const result = await rest(config, token, fetchImpl, 'business_applications', {
        method: 'POST',
        prefer: 'return=representation',
        body: applicationRowFields(payload, meta),
      })
      if (!result.ok) return result
      const row = Array.isArray(result.body) ? result.body[0] : result.body
      return { ok: true, row: mapAppRow(row) }
    },
    async listApplications(status) {
      if (!accessToken) return { ok: false, status: 401, error: 'auth' }
      let path =
        'business_applications?select=*&order=created_at.desc'
      if (status) path += `&status=eq.${encodeURIComponent(status)}`
      const result = await rest(config, accessToken, fetchImpl, path)
      if (!result.ok) return result
      return { ok: true, rows: result.body || [] }
    },
    async getApplication(id) {
      if (!accessToken) return { ok: false, status: 401, error: 'auth' }
      const result = await rest(
        config,
        accessToken,
        fetchImpl,
        `business_applications?id=eq.${encodeURIComponent(id)}&select=*`,
      )
      if (!result.ok) return result
      const row = result.body?.[0]
      if (!row) return { ok: false, status: 404, error: 'missing' }
      return { ok: true, row }
    },
    async updateApplication(id, patch) {
      if (!accessToken) return { ok: false, status: 401, error: 'auth' }
      const result = await rest(
        config,
        accessToken,
        fetchImpl,
        `business_applications?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', prefer: 'return=representation', body: patch },
      )
      if (!result.ok) return result
      const row = result.body?.[0]
      if (!row) return { ok: false, status: 404, error: 'missing' }
      return { ok: true, row }
    },
    async upsertPublished(place, applicationId) {
      if (!accessToken) return { ok: false, status: 401, error: 'auth' }
      const existing = await rest(
        config,
        accessToken,
        fetchImpl,
        `published_places?or=(id.eq.${encodeURIComponent(place.id)},application_id.eq.${encodeURIComponent(applicationId)})&select=*`,
      )
      if (!existing.ok) return existing
      if (existing.body?.[0]) {
        const id = existing.body[0].id
        const updated = await rest(
          config,
          accessToken,
          fetchImpl,
          `published_places?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            prefer: 'return=representation',
            body: {
              name: place.name,
              description: place.description,
              type: place.type,
              category: place.category,
              address: place.address,
              website: place.website || '',
              image_data_url: place.imageDataUrl || null,
              updated_at: new Date().toISOString(),
            },
          },
        )
        if (!updated.ok) return updated
        rememberPublishedId(id)
        return { ok: true, row: updated.body?.[0], created: false }
      }
      const created = await rest(config, accessToken, fetchImpl, 'published_places', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          id: place.id,
          application_id: applicationId,
          name: place.name,
          description: place.description,
          type: place.type,
          category: place.category,
          address: place.address,
          website: place.website || '',
          image_data_url: place.imageDataUrl || null,
          source: 'owner_application',
          is_new: true,
        },
      })
      if (!created.ok) return created
      const row = created.body?.[0]
      if (row?.id) rememberPublishedId(row.id)
      return { ok: true, row, created: true }
    },
  }
}

async function readBody(request, max = 450_000) {
  const text = await request.text()
  if (text.length > max) return { ok: false, message: 'Požadavek je moc velký.' }
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false, message: 'Požadavek nemá platné JSON.' }
  }
}

async function resolveStore(request, options) {
  if (options.store) {
    const resolved = options.user
      ? { user: options.user, accessToken: options.accessToken || '', cookies: [] }
      : await resolveUser(request, options.env ?? process.env, options).catch(() => ({
          user: null,
          accessToken: '',
          cookies: [],
        }))
    return { store: options.store, resolved, config: options.config || null }
  }
  const env = options.env ?? process.env
  const config = authConfig(env)
  if (!config) return { error: notConfigured() }
  const resolved = await resolveUser(request, env, options)
  const store = createSupabaseBusinessStore({
    config,
    accessToken: resolved.accessToken || '',
    fetchImpl: options.fetchImpl ?? fetch,
  })
  return { store, resolved, config }
}

async function requireAdmin(store, resolved) {
  if (!resolved.user) {
    return { error: json({ ok: false, error: 'auth-required', message: 'Nejdřív se přihlas.' }, 401, resolved.cookies) }
  }
  const admin = await store.isAdmin(resolved.user.id)
  if (!admin) {
    return {
      error: json(
        { ok: false, error: 'forbidden', message: 'Tuhle stránku můžou používat jen administrátoři.' },
        403,
        resolved.cookies,
      ),
    }
  }
  return { user: resolved.user }
}

export async function listPublishedPlacesHttp(request, options = {}) {
  const prepared = await resolveStore(request, options)
  if (prepared.error) return prepared.error
  const listed = await prepared.store.listPublished()
  if (!listed.ok) {
    if (listed.error === 'not-ready') {
      return json(
        {
          ok: true,
          places: [],
          message: 'Tabulka zveřejněných podniků ještě není. V SQL Editoru spusť supabase/bootstrap-all.sql.',
        },
        200,
        prepared.resolved.cookies,
      )
    }
    return json({ ok: false, error: listed.error, message: 'Seznam podniků se nepodařilo načíst.' }, listed.status || 502, prepared.resolved.cookies)
  }
  for (const place of listed.places) rememberPublishedId(place.id)
  return json(
    {
      ok: true,
      places: listed.places.map((row) => toCatalogRestaurant(row)),
    },
    200,
    prepared.resolved.cookies,
  )
}

export async function submitBusinessApplicationHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST.' }, 405)
  }
  if (!allowSubmit(request) && !options.skipRateLimit) {
    return json(
      { ok: false, error: 'rate-limited', message: 'Z tohoto zařízení už přišlo víc žádostí. Zkus to později.' },
      429,
    )
  }

  const prepared = await resolveStore(request, options)
  if (prepared.error) return prepared.error

  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, prepared.resolved.cookies)

  const catalog = await prepared.store.existingKeysAndIds()
  if (!catalog.ok && catalog.error === 'not-ready') {
    return json(
      {
        ok: false,
        error: 'not-ready',
        message: 'Databáze žádostí ještě není. V SQL Editoru spusť supabase/bootstrap-all.sql.',
      },
      503,
      prepared.resolved.cookies,
    )
  }
  const keys = catalog.ok ? catalog.keys : new Set(staticKeys)
  const ids = catalog.ok ? catalog.ids : new Set(staticIds)

  const proposedPlaceId = uniquePlaceId(
    payload.value.businessName,
    payload.value.address,
    ids,
  )

  // Existence a metadata kontroly textu se počítají na serveru — klientské hodnoty se neberou jako důkaz.
  const env = options.env ?? process.env
  const existence = await checkPlaceExistence(
    {
      businessName: payload.value.businessName,
      address: payload.value.address,
      locality: payload.value.locality,
    },
    env,
    options.fetchImpl ?? fetch,
  )
  const textReview = reviewDescription(payload.value.descriptionOriginal || payload.value.description, {
    businessName: payload.value.businessName,
    locality: payload.value.locality,
  })

  const assessed = assessBusinessApplication(
    {
      ...payload.value,
      proposedPlaceId,
      keepDescriptionExact: true,
      descriptionReviewEngine: textReview.ok ? textReview.engine : '',
      descriptionReviewNotes: textReview.ok
        ? [...(textReview.warnings || []), textReview.message].filter(Boolean).join(' · ').slice(0, 1000)
        : '',
      existenceStatus: existence.status || 'unavailable',
      existenceSummary: existence.summary || '',
      existenceRequiresManual: true,
      existenceCandidates: existence.candidates || [],
    },
    { takenIds: ids, existingKeys: keys },
  )
  if (!assessed.ok) {
    return json(
      { ok: false, error: 'validation', message: assessed.message, errors: assessed.errors },
      400,
      prepared.resolved.cookies,
    )
  }

  const created = await prepared.store.createApplication(assessed.value, { ipHash: ipHash(request) })
  if (!created.ok) {
    if (created.error === 'not-ready') {
      return json(
        {
          ok: false,
          error: 'not-ready',
          message: 'Databáze žádostí ještě není. V SQL Editoru spusť supabase/bootstrap-all.sql.',
        },
        503,
        prepared.resolved.cookies,
      )
    }
    return json(
      { ok: false, error: created.error || 'failed', message: created.message || 'Žádost se nepodařilo uložit.' },
      created.status || 502,
      prepared.resolved.cookies,
    )
  }

  return json(
    {
      ok: true,
      status: 'pending',
      id: created.row.id,
      message:
        'Žádost je přijatá a čeká na kontrolu. Podnik ještě není veřejný. Automatická kontrola ověřila formát údajů, ne fyzickou existenci podniku.',
      verificationNote: assessed.value.verificationNote,
    },
    200,
    prepared.resolved.cookies,
  )
}

export async function adminListApplicationsHttp(request, options = {}) {
  const prepared = await resolveStore(request, options)
  if (prepared.error) return prepared.error
  const admin = await requireAdmin(prepared.store, prepared.resolved)
  if (admin.error) return admin.error

  const url = new URL(request.url)
  const status = url.searchParams.get('status') || ''
  const listed = await prepared.store.listApplications(status || undefined)
  if (!listed.ok) {
    return json(
      { ok: false, error: listed.error, message: 'Žádosti se nepodařilo načíst.' },
      listed.status || 502,
      prepared.resolved.cookies,
    )
  }

  return json(
    {
      ok: true,
      admin: true,
      applications: listed.rows.map((row) => publicApplicationView(row)),
    },
    200,
    prepared.resolved.cookies,
  )
}

export async function adminReviewApplicationHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST.' }, 405)
  }
  const prepared = await resolveStore(request, options)
  if (prepared.error) return prepared.error
  const admin = await requireAdmin(prepared.store, prepared.resolved)
  if (admin.error) return admin.error

  const payload = await readBody(request, 20_000)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, prepared.resolved.cookies)

  const id = String(payload.value.id ?? '').trim()
  const action = String(payload.value.action ?? '').trim()
  const adminNote = String(payload.value.adminNote ?? '').trim().slice(0, 500)
  if (!id) return json({ ok: false, message: 'Chybí id žádosti.' }, 400, prepared.resolved.cookies)
  if (!['approve', 'reject', 'needs_changes'].includes(action)) {
    return json({ ok: false, message: 'Neznámá akce.' }, 400, prepared.resolved.cookies)
  }

  const current = await prepared.store.getApplication(id)
  if (!current.ok) {
    return json({ ok: false, error: 'missing', message: 'Žádost neexistuje.' }, 404, prepared.resolved.cookies)
  }

  const env = options.env ?? process.env
  const now = new Date().toISOString()

  if (action === 'reject' || action === 'needs_changes') {
    const status = action === 'reject' ? 'rejected' : 'needs_changes'
    const updated = await prepared.store.updateApplication(id, {
      status,
      admin_note: adminNote,
      reviewed_at: now,
      reviewed_by: admin.user.id,
    })
    if (!updated.ok) {
      return json({ ok: false, message: 'Stav se nepodařilo uložit.' }, updated.status || 502, prepared.resolved.cookies)
    }
    return json(
      { ok: true, application: publicApplicationView(updated.row), emailStatus: updated.row.email_status },
      200,
      prepared.resolved.cookies,
    )
  }

  // approve — idempotentní: už schválené znovu nevytvoří duplicitní podnik
  let placeId = current.row.published_place_id || current.row.proposed_place_id
  const applicationValue = {
    businessName: current.row.business_name,
    address: current.row.address,
    locality: current.row.locality,
    category: current.row.category,
    categoryLabel: current.row.category_label,
    cuisineFocus: current.row.cuisine_focus || '',
    typeLabel: current.row.cuisine_focus || current.row.category_label,
    description: current.row.description,
    ownerEmail: current.row.owner_email,
    website: current.row.website,
    proposedPlaceId: current.row.proposed_place_id,
    photo: current.row.photo_data
      ? { mime: current.row.photo_mime, dataUrl: current.row.photo_data }
      : null,
  }
  const place = publishedPlaceFromApplication(applicationValue, placeId)
  const upserted = await prepared.store.upsertPublished(place, id)
  if (!upserted.ok) {
    return json(
      { ok: false, error: upserted.error, message: upserted.message || 'Podnik se nepodařilo zveřejnit.' },
      upserted.status || 502,
      prepared.resolved.cookies,
    )
  }
  placeId = upserted.row.id

  let emailStatus = current.row.email_status
  let emailError = current.row.email_error || ''
  let emailSentAt = current.row.email_sent_at

  const alreadyApproved = current.row.status === 'approved' && current.row.published_place_id
  if (!alreadyApproved || emailStatus !== 'sent') {
    const origin = publicSiteOrigin(request, env)
    const placeUrl = origin ? `${origin}/restaurant/${encodeURIComponent(placeId)}` : `/restaurant/${encodeURIComponent(placeId)}`
    const mailed = await sendBusinessApprovalEmail(
      {
        businessName: current.row.business_name,
        ownerEmail: current.row.owner_email,
        placeUrl,
      },
      env,
      options.fetchImpl ?? fetch,
    )
    emailStatus = mailed.status
    emailError = mailed.ok ? '' : mailed.message || mailed.error || ''
    emailSentAt = mailed.ok ? now : emailSentAt
  }

  const updated = await prepared.store.updateApplication(id, {
    status: 'approved',
    admin_note: adminNote || current.row.admin_note || '',
    published_place_id: placeId,
    reviewed_at: now,
    reviewed_by: admin.user.id,
    email_status: emailStatus,
    email_error: emailError,
    email_sent_at: emailSentAt,
  })
  if (!updated.ok) {
    return json({ ok: false, message: 'Schválení se nepodařilo uložit.' }, updated.status || 502, prepared.resolved.cookies)
  }

  return json(
    {
      ok: true,
      application: publicApplicationView(updated.row),
      placeId,
      emailStatus,
      emailError,
      published: true,
      createdPlace: upserted.created,
    },
    200,
    prepared.resolved.cookies,
  )
}

export async function adminMeHttp(request, options = {}) {
  const prepared = await resolveStore(request, options)
  if (prepared.error) return prepared.error
  if (!prepared.resolved.user) {
    return json({ ok: false, authenticated: false, admin: false }, 200, prepared.resolved.cookies)
  }
  const admin = await prepared.store.isAdmin(prepared.resolved.user.id)
  return json(
    {
      ok: true,
      authenticated: true,
      admin: Boolean(admin),
      email: prepared.resolved.user.email || '',
    },
    200,
    prepared.resolved.cookies,
  )
}

export async function descriptionReviewHttp(request, _options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST.' }, 405)
  }
  const payload = await readBody(request, 20_000)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400)
  const reviewed = reviewDescription(payload.value.description, {
    businessName: payload.value.businessName,
    locality: payload.value.locality,
  })
  if (!reviewed.ok) return json({ ok: false, ...reviewed }, 400)
  return json({ ok: true, ...reviewed }, 200)
}

export async function existenceCheckHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST.' }, 405)
  }
  const payload = await readBody(request, 20_000)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400)
  const result = await checkPlaceExistence(payload.value, options.env ?? process.env, options.fetchImpl ?? fetch)
  return json(result, result.ok === false ? 400 : 200)
}

export async function adminResendEmailHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST.' }, 405)
  }
  const prepared = await resolveStore(request, options)
  if (prepared.error) return prepared.error
  const admin = await requireAdmin(prepared.store, prepared.resolved)
  if (admin.error) return admin.error

  const payload = await readBody(request, 20_000)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, prepared.resolved.cookies)
  const id = String(payload.value.id ?? '').trim()
  if (!id) return json({ ok: false, message: 'Chybí id žádosti.' }, 400, prepared.resolved.cookies)

  const current = await prepared.store.getApplication(id)
  if (!current.ok) {
    return json({ ok: false, error: 'missing', message: 'Žádost neexistuje.' }, 404, prepared.resolved.cookies)
  }
  if (current.row.status !== 'approved' || !current.row.published_place_id) {
    return json(
      { ok: false, message: 'E-mail jde znovu poslat jen u schváleného a zveřejněného podniku.' },
      400,
      prepared.resolved.cookies,
    )
  }

  const env = options.env ?? process.env
  const origin = publicSiteOrigin(request, env)
  const placeId = current.row.published_place_id
  const placeUrl = origin
    ? `${origin}/restaurant/${encodeURIComponent(placeId)}`
    : `/restaurant/${encodeURIComponent(placeId)}`
  const mailed = await sendBusinessApprovalEmail(
    {
      businessName: current.row.business_name,
      ownerEmail: current.row.owner_email,
      placeUrl,
    },
    env,
    options.fetchImpl ?? fetch,
  )
  const now = new Date().toISOString()
  const updated = await prepared.store.updateApplication(id, {
    email_status: mailed.status,
    email_error: mailed.ok ? '' : mailed.message || mailed.error || '',
    email_sent_at: mailed.ok ? now : current.row.email_sent_at,
  })
  if (!updated.ok) {
    return json({ ok: false, message: 'Stav e-mailu se nepodařilo uložit.' }, updated.status || 502, prepared.resolved.cookies)
  }
  return json(
    {
      ok: mailed.ok,
      emailStatus: mailed.status,
      emailError: mailed.ok ? '' : mailed.message || mailed.error || '',
      message: mailed.message,
      application: publicApplicationView(updated.row),
    },
    mailed.ok ? 200 : 502,
    prepared.resolved.cookies,
  )
}

export async function businessHttp(request, options = {}) {
  const pathname = new URL(request.url).pathname
  if (pathname === '/api/published-places') return listPublishedPlacesHttp(request, options)
  if (pathname === '/api/business-applications' && request.method === 'POST') {
    return submitBusinessApplicationHttp(request, options)
  }
  if (pathname === '/api/business-description-review' && request.method === 'POST') {
    return descriptionReviewHttp(request, options)
  }
  if (pathname === '/api/business-existence-check' && request.method === 'POST') {
    return existenceCheckHttp(request, options)
  }
  if (pathname === '/api/admin/me') return adminMeHttp(request, options)
  if (pathname === '/api/admin/business-applications' && request.method === 'GET') {
    return adminListApplicationsHttp(request, options)
  }
  if (pathname === '/api/admin/business-applications/review' && request.method === 'POST') {
    return adminReviewApplicationHttp(request, options)
  }
  if (pathname === '/api/admin/business-applications/resend-email' && request.method === 'POST') {
    return adminResendEmailHttp(request, options)
  }
  return json({ ok: false, error: 'not-found', message: 'Neznámá business API cesta.' }, 404)
}
