/**
 * Hlášení chyb o podnicích.
 * Trvalé uložení jen přes Supabase RPC submit_place_report.
 * Paměťový „úspěch“ se nepředstírá — bez DB vrací 503.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePlaceReport } from '../utils/placeReport.js'
import { authConfig, resolveUser } from './supabaseAuth.js'
import { supabaseApiHeaders } from './supabaseApiHeaders.js'
import { wrapFoodGoEmail } from './emailTemplates.js'
import { CONTACT_EMAIL } from '../constants/brand.js'

async function notifyOperatorNewReport(report, env, fetchImpl = fetch) {
  const apiKey = String(env?.RESEND_API_KEY ?? '').trim()
  const from = String(env?.EMAIL_FROM ?? '').trim()
  const to = String(env?.INQUIRY_TO_EMAIL ?? CONTACT_EMAIL).trim()
  if (!apiKey || !from.includes('@') || !to.includes('@')) return
  const letter = wrapFoodGoEmail({
    title: 'Nové hlášení údaje',
    preheader: 'Uloženo v administraci — bez osobních dat v e-mailu',
    bodyLines: [
      'V katalogu je nové hlášení o údajích podniku.',
      report?.restaurantId ? `Podnik (id): ${report.restaurantId}` : '',
      report?.category ? `Kategorie hlášení: ${report.category}` : '',
      'Detail je v administraci. Tento e-mail neobsahuje kontakt hlásícího.',
    ].filter(Boolean),
  })
  try {
    await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: CONTACT_EMAIL,
        subject: 'FOODGO — nové hlášení údaje',
        text: letter.text,
        html: letter.html,
      }),
    })
  } catch {
    /* hlášení už je uložené — e-mail je best-effort */
  }
}

const recentByIp = new Map()
const sqlPath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../supabase/place-reports.sql')

function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'local'
}

export function resetPlaceReportLimits() {
  recentByIp.clear()
}

function rateLimited(ip) {
  const now = Date.now()
  const windowMs = 60_000
  const max = 8
  const bucket = recentByIp.get(ip) || []
  const fresh = bucket.filter((ts) => now - ts < windowMs)
  if (fresh.length >= max) {
    recentByIp.set(ip, fresh)
    return true
  }
  fresh.push(now)
  recentByIp.set(ip, fresh)
  return false
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  })
}

async function callRpc(config, fetchImpl, name, args, accessToken = '') {
  const response = await fetchImpl(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      ...supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text.slice(0, 200) }
  }
  return { ok: response.ok, status: response.status, body }
}

function storageUnavailable(message) {
  return json(
    {
      ok: false,
      stored: false,
      error: 'storage-unavailable',
      message:
        message
        || 'Hlášení teď neumíme trvale uložit. Zkus to později, nebo napiš na kontakt v patičce.',
    },
    503,
  )
}

export function createMemoryPlaceReportStore() {
  const rows = []
  return {
    kind: 'memory',
    async insert(report) {
      const id = `mem-${rows.length + 1}`
      rows.push({
        id,
        restaurantId: report.restaurantId,
        reason: report.reason,
        details: report.details,
        contact: report.contact,
        status: 'new',
        createdAt: report.createdAt || new Date().toISOString(),
      })
      return { ok: true, id }
    },
    async list() {
      return {
        ok: true,
        reports: rows.map((row) => ({ ...row })),
      }
    },
    async updateStatus(id, status) {
      const row = rows.find((item) => item.id === id)
      if (!row) return { ok: false, error: 'missing', status: 404 }
      row.status = status
      return { ok: true, report: { ...row } }
    },
  }
}

export function createSupabasePlaceReportStore({ config, accessToken = '', fetchImpl = fetch }) {
  return {
    kind: 'supabase',
    async insert(report) {
      const result = await callRpc(
        config,
        fetchImpl,
        'submit_place_report',
        {
          p_restaurant_id: report.restaurantId,
          p_reason: report.reason,
          p_details: report.details,
          p_contact: report.contact,
        },
        accessToken,
      )
      const msg = String(result.body?.message || result.body?.hint || '')
      if (
        result.status === 404
        || /Could not find the function|PGRST202|schema cache/i.test(msg)
      ) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!result.ok) {
        if (/check constraint|violates/i.test(msg)) {
          return { ok: false, error: 'invalid', status: 400, message: 'Hlášení neprošlo kontrolou.' }
        }
        return { ok: false, error: 'failed', status: result.status || 502, message: msg }
      }
      return { ok: true, id: result.body }
    },
    async list() {
      const response = await fetchImpl(
        `${config.url}/rest/v1/place_reports?select=id,restaurant_id,reason,details,contact,status,created_at&order=created_at.desc&limit=200`,
        {
          headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
        },
      )
      const body = await response.json().catch(() => ({}))
      const msg = JSON.stringify(body)
      if (response.status === 404 || /Could not find the table|PGRST205/i.test(msg)) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!response.ok) {
        return { ok: false, error: 'forbidden', status: response.status }
      }
      return {
        ok: true,
        reports: (Array.isArray(body) ? body : []).map((row) => ({
          id: row.id,
          restaurantId: row.restaurant_id,
          reason: row.reason,
          details: row.details,
          contact: row.contact,
          status: row.status,
          createdAt: row.created_at,
        })),
      }
    },
    async updateStatus(id, status) {
      const response = await fetchImpl(
        `${config.url}/rest/v1/place_reports?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: {
            ...supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
            'content-type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ status }),
        },
      )
      const body = await response.json().catch(() => ({}))
      const msg = JSON.stringify(body)
      if (response.status === 404 || /Could not find the table|PGRST205/i.test(msg)) {
        return { ok: false, error: 'not-ready', status: 503 }
      }
      if (!response.ok) return { ok: false, error: 'failed', status: response.status }
      const row = Array.isArray(body) ? body[0] : body
      if (!row) return { ok: false, error: 'missing', status: 404 }
      return {
        ok: true,
        report: {
          id: row.id,
          restaurantId: row.restaurant_id,
          reason: row.reason,
          details: row.details,
          contact: row.contact,
          status: row.status,
          createdAt: row.created_at,
        },
      }
    },
  }
}

async function profileIsAdmin(config, accessToken, fetchImpl, userId) {
  const response = await fetchImpl(
    `${config.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`,
    {
      headers: supabaseApiHeaders({ apiKey: config.anonKey, accessToken }),
    },
  )
  if (!response.ok) return false
  const body = await response.json().catch(() => [])
  return Boolean(Array.isArray(body) && body[0]?.is_admin === true)
}

export async function placeReportsHttp(request, { placeExists, store, env, fetchImpl, isAdmin } = {}) {
  const url = new URL(request.url)
  if (url.pathname !== '/api/place-reports') {
    return json({ ok: false, message: 'Not found' }, 404)
  }

  const runtimeEnv = env ?? process.env
  const config = authConfig(runtimeEnv)
  const http = fetchImpl || fetch
  const activeStore =
    store
    || (config.configured ? createSupabasePlaceReportStore({ config, fetchImpl: http }) : null)

  const STATUSES = new Set(['new', 'reviewing', 'resolved', 'dismissed'])

  async function requireAdminStore() {
    if (!activeStore) return { ok: false, response: storageUnavailable('Evidence hlášení není nastavená.') }

    let adminOk = false
    let adminStore = activeStore
    if (typeof isAdmin === 'function') {
      adminOk = Boolean(await isAdmin(request))
    } else if (config.configured) {
      const resolved = await resolveUser(request, config, http)
      if (!resolved.user?.id || !resolved.accessToken) {
        return { ok: false, response: json({ ok: false, message: 'Forbidden' }, 403) }
      }
      adminOk = await profileIsAdmin(config, resolved.accessToken, http, resolved.user.id)
      adminStore = createSupabasePlaceReportStore({
        config,
        accessToken: resolved.accessToken,
        fetchImpl: http,
      })
    }

    if (!adminOk) return { ok: false, response: json({ ok: false, message: 'Forbidden' }, 403) }
    return { ok: true, store: adminStore }
  }

  if (request.method === 'GET') {
    const gate = await requireAdminStore()
    if (!gate.ok) return gate.response
    const listed = await gate.store.list()
    if (!listed.ok) {
      if (listed.error === 'not-ready') return storageUnavailable()
      return json({ ok: false, message: 'Hlášení se nepodařilo načíst.' }, listed.status || 502)
    }
    return json({ ok: true, reports: listed.reports })
  }

  if (request.method === 'PATCH') {
    const gate = await requireAdminStore()
    if (!gate.ok) return gate.response
    let body
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, message: 'Neplatné JSON tělo.' }, 400)
    }
    const id = String(body?.id || '').trim()
    const status = String(body?.status || '').trim()
    if (!id) return json({ ok: false, message: 'Chybí id hlášení.' }, 400)
    if (!STATUSES.has(status)) {
      return json({ ok: false, message: 'Neplatný stav hlášení.' }, 400)
    }
    if (typeof gate.store.updateStatus !== 'function') {
      return storageUnavailable('Aktualizace stavu hlášení není dostupná.')
    }
    const updated = await gate.store.updateStatus(id, status)
    if (!updated.ok) {
      if (updated.error === 'not-ready') return storageUnavailable()
      if (updated.error === 'missing') return json({ ok: false, message: 'Hlášení nenalezeno.' }, 404)
      return json({ ok: false, message: 'Stav se nepodařilo uložit.' }, updated.status || 502)
    }
    return json({ ok: true, report: updated.report })
  }

  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Method not allowed' }, 405)
  }

  const ip = clientIp(request)
  if (rateLimited(ip)) {
    return json({ ok: false, stored: false, message: 'Too many reports. Zkus to za chvíli.' }, 429)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, stored: false, message: 'Neplatné JSON tělo.' }, 400)
  }

  const validated = validatePlaceReport(body)
  if (!validated.ok) {
    return json({ ok: false, stored: false, message: validated.message }, 400)
  }

  if (typeof placeExists === 'function' && !placeExists(validated.report.restaurantId)) {
    return json({ ok: false, stored: false, message: 'Podnik v katalogu není.' }, 404)
  }

  if (!activeStore) {
    return storageUnavailable('Supabase není nastavené — hlášení se neuložilo.')
  }

  const saved = await activeStore.insert(validated.report)
  if (!saved.ok) {
    if (saved.error === 'not-ready') {
      return storageUnavailable('Tabulka hlášení ještě není nasazená. Hlášení se neuložilo.')
    }
    if (saved.error === 'invalid') {
      return json({ ok: false, stored: false, message: saved.message || 'Neplatné hlášení.' }, 400)
    }
    return storageUnavailable(saved.message || 'Hlášení se nepodařilo uložit.')
  }

  // Best-effort: selhání e-mailu nesmí zahodit uložené hlášení.
  void notifyOperatorNewReport(validated.report, runtimeEnv, http)

  return json({ ok: true, stored: true, received: true, id: saved.id || undefined })
}

/** SQL migrace pro kontraktové testy. */
export const PLACE_REPORTS_SQL = readFileSync(sqlPath, 'utf8')
