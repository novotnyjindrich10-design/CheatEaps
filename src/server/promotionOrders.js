/**
 * Evidence poptávek placené propagace.
 * Veřejný požadavek umí poptávku uložit. Stav zaplaceno a aktivní reklamu
 * nastaví jen administrátor nebo ověřený webhook, nikdy návrat z platební stránky.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { assessPromotionRequest, sendPromotionInquiryMail } from './promotionRequest.js'
import { authConfig, resolveUser } from './supabaseAuth.js'
import { activeSponsorship } from '../constants/monetization.js'

const OPEN = new Set(['inquiry', 'accepted', 'active'])
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_EMAIL = 3
const recentByEmail = new Map()

export function resetPromotionOrderLimits() {
  recentByEmail.clear()
}

function hashKey(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function keysMatch(storedHash, key) {
  if (!storedHash || !key) return false
  const hashed = hashKey(key)
  const left = Buffer.from(storedHash)
  const right = Buffer.from(hashed)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function placeKeyOf(record) {
  if (record.placeId) return `id:${record.placeId}`
  return `name:${String(record.businessName || '').trim().toLowerCase()}`
}

function newReference() {
  return `CE${randomBytes(5).toString('hex').toUpperCase()}`
}

function json(body, status = 200, headers) {
  return Response.json(body, { status, headers })
}

function publicOrder(row) {
  return {
    reference: row.reference,
    status: row.status,
    paymentStatus: row.paymentStatus,
    planId: row.planId,
    planName: row.planName,
    periodId: row.periodId,
    amount: row.amount,
    currency: row.currency || 'CZK',
    serviceDays: row.serviceDays,
    serviceLabel: row.serviceLabel,
    renewal: 'none',
    vatStatus: row.vatStatus,
    vatNote: row.vatNote,
    placeId: row.placeId || '',
    businessName: row.businessName,
    startsAt: row.startsAt || null,
    endsAt: row.endsAt || null,
    paid: row.paymentStatus === 'paid',
    activated: row.status === 'active',
  }
}

function adminOrder(row) {
  return {
    ...publicOrder(row),
    id: row.id,
    companyName: row.companyName,
    ico: row.ico || '',
    dic: row.dic || '',
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    billingAddress: row.billingAddress,
    website: row.website || '',
    paymentSource: row.paymentSource || '',
    invoiceNumber: row.invoiceNumber || '',
    invoiceIssuedAt: row.invoiceIssuedAt || null,
    invoiceNote: row.invoiceNote || '',
    startsAt: row.startsAt || null,
    endsAt: row.endsAt || null,
    adminNote: row.adminNote || '',
    createdAt: row.createdAt,
  }
}

function closed(row) {
  return row.status === 'declined' || row.status === 'ended'
}

export function applyAdminAction(row, action, { now = Date.now(), note = '', placeId = '', invoiceNumber = '' } = {}) {
  const next = {
    ...row,
    adminNote: String(note || row.adminNote || '').slice(0, 500),
    updatedAt: new Date(now).toISOString(),
  }
  if (action === 'accept') {
    if (closed(row)) return { ok: false, error: 'closed' }
    if (row.status !== 'active') next.status = 'accepted'
    return { ok: true, row: next }
  }
  if (action === 'decline') {
    next.status = 'declined'
    next.endsAt = new Date(now).toISOString()
    return { ok: true, row: next }
  }
  if (action === 'invoice') {
    if (row.paymentStatus === 'paid') return { ok: false, error: 'already-paid' }
    if (closed(row)) return { ok: false, error: 'closed' }
    const number = String(invoiceNumber || '').trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{0,39}$/.test(number)) return { ok: false, error: 'invoice-number' }
    if (row.status === 'inquiry') next.status = 'accepted'
    next.paymentStatus = 'invoiced'
    next.paymentSource = 'manual'
    next.invoiceNumber = number
    next.invoiceNote = String(note || '').slice(0, 500)
    next.invoiceIssuedAt = new Date(now).toISOString()
    return { ok: true, row: next }
  }
  if (action === 'mark_paid') {
    if (closed(row)) return { ok: false, error: 'closed' }
    if (row.paymentStatus === 'paid') return { ok: true, row }
    next.paymentStatus = 'paid'
    next.paymentSource = row.paymentSource === 'gateway' ? 'gateway' : 'manual'
    next.paidAt = new Date(now).toISOString()
    return { ok: true, row: next }
  }
  if (action === 'activate') {
    if (closed(row)) return { ok: false, error: 'closed' }
    if (row.paymentStatus !== 'paid') return { ok: false, error: 'unpaid' }
    const id = String(placeId || row.placeId || '')
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return { ok: false, error: 'place' }
    const start = now
    const end = start + Number(row.serviceDays) * 24 * 60 * 60 * 1000
    next.status = 'active'
    next.placeId = id
    next.startsAt = new Date(start).toISOString()
    next.endsAt = new Date(end).toISOString()
    next.activatedAt = next.startsAt
    next.renewal = 'none'
    return { ok: true, row: next }
  }
  if (action === 'end') {
    next.status = 'ended'
    next.endsAt = new Date(now).toISOString()
    return { ok: true, row: next }
  }
  return { ok: false, error: 'unknown-action' }
}

export function applyVerifiedPayment(row, event, seen) {
  if (!event?.eventId) return { ok: false, error: 'event' }
  if (seen.has(event.eventId)) return { ok: true, duplicate: true, row }
  seen.add(event.eventId)
  if (event.status === 'paid') {
    if (row.paymentStatus === 'paid') return { ok: true, duplicate: false, row }
    return {
      ok: true,
      duplicate: false,
      row: {
        ...row,
        paymentStatus: 'paid',
        paymentSource: 'gateway',
        paidAt: new Date().toISOString(),
        renewal: 'none',
      },
    }
  }
  if ((event.status === 'failed' || event.status === 'cancelled') && row.paymentStatus !== 'paid') {
    return { ok: true, duplicate: false, row: { ...row, paymentStatus: 'failed' } }
  }
  return { ok: true, duplicate: false, row }
}

export function createMemoryPromotionStore() {
  const orders = []
  const events = new Set()
  const admins = new Set()
  let seq = 0

  return {
    kind: 'memory',
    grantAdmin(userId) {
      admins.add(userId)
    },
    async isAdmin(userId) {
      return admins.has(userId)
    },
    async create(record) {
      const key = placeKeyOf(record)
      const duplicate = orders.find(
        (row) =>
          row.email.toLowerCase() === record.email.toLowerCase()
          && row.planId === record.planId
          && row.periodId === record.periodId
          && row.placeKey === key
          && OPEN.has(row.status),
      )
      if (duplicate) return { ok: false, error: 'duplicate' }
      seq += 1
      const accessKey = randomBytes(24).toString('base64url')
      const row = {
        ...record,
        id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
        reference: newReference(),
        accessHash: hashKey(accessKey),
        status: 'inquiry',
        paymentStatus: 'none',
        paymentSource: '',
        renewal: 'none',
        placeKey: key,
        startsAt: null,
        endsAt: null,
        adminNote: '',
        invoiceNumber: '',
        invoiceIssuedAt: null,
        invoiceNote: '',
        createdAt: new Date().toISOString(),
      }
      orders.push(row)
      return { ok: true, row, accessKey }
    },
    async readOwn(reference, accessKey) {
      const row = orders.find((item) => item.reference === reference)
      if (!row || !keysMatch(row.accessHash, accessKey)) return { ok: false, error: 'missing' }
      return { ok: true, row }
    },
    async list() {
      return { ok: true, rows: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }
    },
    async get(id) {
      const row = orders.find((item) => item.id === id)
      if (!row) return { ok: false, error: 'missing' }
      return { ok: true, row }
    },
    async save(row) {
      const index = orders.findIndex((item) => item.id === row.id)
      if (index === -1) return { ok: false, error: 'missing' }
      orders[index] = row
      return { ok: true, row }
    },
    async applyPayment(event) {
      const row = orders.find((item) => item.reference === event.reference)
      if (!row) return { ok: false, error: 'missing' }
      const applied = applyVerifiedPayment(row, event, events)
      if (!applied.ok) return applied
      if (!applied.duplicate) {
        const index = orders.findIndex((item) => item.id === row.id)
        orders[index] = applied.row
      }
      return { ok: true, duplicate: applied.duplicate, activated: false, row: orders.find((item) => item.id === row.id) }
    },
    async activeSponsorships(now = Date.now()) {
      return orders
        .filter((row) => row.paymentStatus === 'paid' && row.placeId)
        .map((row) => ({
          placeId: row.placeId,
          planId: row.planId,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          verified: row.status === 'active',
          status: row.status,
        }))
        .filter((row) => activeSponsorship(row, now))
        .map((row) => ({
          placeId: row.placeId,
          planId: row.planId,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        }))
    },
  }
}

function rest(config, token, fetchImpl, path, { method = 'GET', body, apiKey } = {}) {
  const key = apiKey || config.anonKey
  return fetchImpl(`${config.url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token || key}`,
      'Content-Type': 'application/json',
      ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, body: payload }
  })
}

export function createSupabasePromotionStore({ config, accessToken, fetchImpl }) {
  const token = accessToken || config.anonKey
  return {
    kind: 'supabase',
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
    async create(record) {
      const accessKey = randomBytes(24).toString('base64url')
      const result = await rest(config, config.anonKey, fetchImpl, 'rpc/submit_promotion_inquiry', {
        method: 'POST',
        body: {
          p_record: record,
          p_access_hash: hashKey(accessKey),
          p_reference: newReference(),
        },
      })
      if (!result.ok) {
        const message = result.body?.message || result.body?.error_description || ''
        if (result.status === 404 || /function|schema cache|does not exist/i.test(message)) {
          return { ok: false, error: 'not-ready' }
        }
        return { ok: false, error: 'failed' }
      }
      const payload = result.body?.ok ? result.body : result.body?.[0]
      if (payload?.error === 'duplicate') return { ok: false, error: 'duplicate' }
      if (!payload?.ok) return { ok: false, error: payload?.error || 'failed' }
      return {
        ok: true,
        accessKey,
        row: {
          ...record,
          id: payload.id,
          reference: payload.reference,
          status: 'inquiry',
          paymentStatus: 'none',
          renewal: 'none',
        },
      }
    },
    async readOwn(reference, accessKey) {
      const result = await rest(config, config.anonKey, fetchImpl, 'rpc/read_promotion_inquiry', {
        method: 'POST',
        body: { p_reference: reference, p_access_key: accessKey },
      })
      if (!result.ok || result.body?.ok === false) return { ok: false, error: 'missing' }
      return { ok: true, row: result.body.order }
    },
    async list() {
      const result = await rest(
        config,
        token,
        fetchImpl,
        'promotion_orders?select=*&order=created_at.desc',
      )
      if (!result.ok) return { ok: false, error: result.status === 404 ? 'not-ready' : 'failed' }
      return { ok: true, rows: (result.body || []).map(fromDb) }
    },
    async get(id) {
      const result = await rest(
        config,
        token,
        fetchImpl,
        `promotion_orders?id=eq.${encodeURIComponent(id)}&select=*`,
      )
      if (!result.ok || !result.body?.[0]) return { ok: false, error: 'missing' }
      return { ok: true, row: fromDb(result.body[0]) }
    },
    async save(row) {
      const result = await rest(config, token, fetchImpl, `promotion_orders?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        body: toDbPatch(row),
      })
      if (!result.ok) return { ok: false, error: 'failed' }
      return { ok: true, row }
    },
    async applyPayment(event) {
      // Stejná hodnota jako Comgate PAYMENT_SECRET (nebo legacy PAYMENT_WEBHOOK_SECRET).
      // Nastav v DB: alter database postgres set app.payment_webhook_secret = '<PAYMENT_SECRET>';
      const secret = String(process.env.PAYMENT_SECRET || process.env.PAYMENT_WEBHOOK_SECRET || '')
      const serviceKey = String(config.serviceRoleKey || '').trim()
      if (!serviceKey) return { ok: false, error: 'service-role-required' }
      const result = await rest(config, serviceKey, fetchImpl, 'rpc/record_verified_payment', {
        method: 'POST',
        apiKey: serviceKey,
        body: {
          p_event_id: event.eventId,
          p_reference: event.reference,
          p_status: event.status,
          p_secret: secret,
        },
      })
      if (!result.ok || result.body?.ok === false) return { ok: false, error: result.body?.error || 'failed' }
      return { ok: true, duplicate: Boolean(result.body.duplicate), activated: false }
    },
    async activeSponsorships() {
      const result = await rest(
        config,
        config.anonKey,
        fetchImpl,
        'promotion_sponsorships_public?select=place_id,plan_id,starts_at,ends_at',
      )
      if (!result.ok) return []
      return (result.body || []).map((row) => ({
        placeId: row.place_id,
        planId: row.plan_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }))
    },
  }
}

function fromDb(row) {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentSource: row.payment_source,
    planId: row.plan_id,
    planName: row.plan_name,
    periodId: row.period_id,
    amount: row.amount,
    currency: row.currency,
    serviceDays: row.service_days,
    serviceLabel: row.service_label,
    renewal: row.renewal,
    vatStatus: row.vat_status,
    vatNote: row.vat_note,
    placeId: row.place_id,
    businessName: row.business_name,
    companyName: row.company_name,
    ico: row.ico,
    dic: row.dic,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    billingAddress: row.billing_address,
    website: row.website,
    invoiceNumber: row.invoice_number || '',
    invoiceIssuedAt: row.invoice_issued_at || null,
    invoiceNote: row.invoice_note || '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    adminNote: row.admin_note,
    createdAt: row.created_at,
  }
}

function toDbPatch(row) {
  return {
    status: row.status,
    payment_status: row.paymentStatus,
    payment_source: row.paymentSource || '',
    place_id: row.placeId || '',
    invoice_number: row.invoiceNumber || '',
    invoice_issued_at: row.invoiceIssuedAt || null,
    invoice_note: row.invoiceNote || '',
    starts_at: row.startsAt,
    ends_at: row.endsAt,
    admin_note: row.adminNote || '',
    paid_at: row.paidAt || null,
    activated_at: row.activatedAt || null,
    renewal: 'none',
    updated_at: new Date().toISOString(),
  }
}

async function resolveStore(request, options) {
  if (options.store) {
    return { store: options.store, user: options.user || null }
  }
  const env = options.env ?? process.env
  const config = authConfig(env)
  if (!config.configured) return { error: 'not-configured' }
  const fetchImpl = options.fetchImpl ?? fetch
  let user = null
  let accessToken = ''
  if (options.user) {
    user = options.user
    accessToken = options.accessToken || ''
  } else {
    const resolved = await resolveUser(request, config, fetchImpl)
    user = resolved.user
    accessToken = resolved.accessToken || ''
  }
  return {
    store: createSupabasePromotionStore({ config, accessToken, fetchImpl }),
    user,
  }
}

function limited(email, now) {
  const key = email.toLowerCase()
  const prev = (recentByEmail.get(key) ?? []).filter((time) => now - time < WINDOW_MS)
  if (prev.length >= MAX_PER_EMAIL) {
    recentByEmail.set(key, prev)
    return true
  }
  prev.push(now)
  recentByEmail.set(key, prev)
  return false
}

export async function promotionOrdersHttp(request, options = {}) {
  const now = options.now ?? Date.now()
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  if (request.method === 'GET') {
    const url = new URL(request.url)
    const prepared = await resolveStore(request, options)
    if (!prepared.store) {
      return json({ ok: false, error: 'not-configured', message: 'Poptávku teď nelze načíst.' }, 503)
    }
    const found = await prepared.store.readOwn(url.searchParams.get('reference') || '', url.searchParams.get('key') || '')
    if (!found.ok) return json({ ok: false, error: 'missing', message: 'Poptávka se nenašla.' }, 404)
    return json({ ok: true, order: publicOrder(found.row) })
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST nebo GET.' }, 405, { Allow: 'GET, POST' })
  }
  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ ok: false, accepted: false, paid: false, activated: false, error: 'invalid-json', message: 'Poptávka musí být JSON.' }, 400)
  }
  const assessment = assessPromotionRequest(payload, now)
  if (!assessment.ok) return json(assessment.body, assessment.status)
  if (limited(assessment.emailKey, now)) {
    return json({ ok: false, accepted: false, paid: false, activated: false, error: 'rate-limited', message: 'Z tohoto kontaktu už přišlo víc poptávek. Zkus to později.' }, 429)
  }

  const prepared = await resolveStore(request, options)
  let stored = null
  if (prepared.store) {
    stored = await prepared.store.create(assessment.record)
    if (stored.error === 'duplicate') {
      return json({
        ok: false,
        accepted: false,
        paid: false,
        activated: false,
        error: 'duplicate',
        message: 'Stejná poptávka už čeká na vyřízení. Nová se nezaložila.',
      }, 409)
    }
  }

  const saved = stored?.ok === true
  let operatorNotified = false
  let restaurantNotified = false
  let mailError = ''
  if (saved || stored?.error === 'not-ready' || !prepared.store) {
    const mail = await sendPromotionInquiryMail({
      ...assessment,
      reference: saved ? stored.row.reference : '',
    }, env, fetchImpl)
    operatorNotified = mail.operator === true
    restaurantNotified = mail.restaurant === true
    mailError = mail.error || ''
  }
  if (!saved && !operatorNotified) {
    return json({
      ok: false,
      accepted: false,
      stored: false,
      emailed: false,
      operatorNotified: false,
      restaurantNotified: false,
      paid: false,
      activated: false,
      error: 'not-ready',
      message: 'Poptávku teď nelze uložit ani odeslat. Nic se nezaplatilo a propagace se nezapnula.',
    }, 503)
  }

  let message
  if (saved && operatorNotified && restaurantNotified) {
    message = 'Poptávka je uložená. Potvrzení šlo na e-mail restaurace a upozornění provozovateli. Nic se nezaplatilo a propagace se nezapnula.'
  } else if (saved && operatorNotified) {
    message = 'Poptávka je uložená a provozovatel dostal upozornění. Potvrzení restauraci se nepodařilo odeslat. Nic se nezaplatilo a propagace se nezapnula.'
  } else if (saved && mailError === 'email-failed') {
    message = 'Poptávka je uložená. E-mail se nepodařilo odeslat. Nic se nezaplatilo a propagace se nezapnula.'
  } else if (saved) {
    message = 'Poptávka je uložená. E-mail se neodeslal, protože Resend není nastavený. Nic se nezaplatilo a propagace se nezapnula.'
  } else {
    message = 'Poptávka odešla e-mailem provozovateli. V evidenci ještě není, protože tabulka neběží. Nic se nezaplatilo a propagace se nezapnula.'
  }

  return json({
    ok: true,
    accepted: true,
    stored: saved,
    emailed: operatorNotified,
    operatorNotified,
    restaurantNotified,
    paid: false,
    activated: false,
    renewal: 'none',
    reference: saved ? stored.row.reference : '',
    accessKey: saved ? stored.accessKey : '',
    order: saved ? publicOrder(stored.row) : null,
    message,
  })
}

export async function sponsorshipsHttp(request, options = {}) {
  if (request.method !== 'GET') {
    return json({ ok: false, message: 'Povolená je jen metoda GET.' }, 405, { Allow: 'GET' })
  }
  const prepared = await resolveStore(request, options)
  if (!prepared.store) return json({ ok: true, sponsorships: [] })
  const rows = await prepared.store.activeSponsorships(options.now ?? Date.now())
  return json({ ok: true, sponsorships: rows })
}

async function requireAdmin(request, options) {
  const prepared = await resolveStore(request, options)
  if (!prepared.store) {
    return { error: json({ ok: false, error: 'not-configured', message: 'Evidence propagace ještě není nastavená.' }, 503) }
  }
  if (!prepared.user) {
    return { error: json({ ok: false, error: 'auth-required', message: 'Nejdřív se přihlas.' }, 401) }
  }
  const admin = await prepared.store.isAdmin(prepared.user.id)
  if (!admin) {
    return { error: json({ ok: false, error: 'forbidden', message: 'Tuhle stránku můžou používat jen administrátoři.' }, 403) }
  }
  return prepared
}

export async function adminPromotionOrdersHttp(request, options = {}) {
  if (request.method !== 'GET') {
    return json({ ok: false, message: 'Povolená je jen metoda GET.' }, 405)
  }
  const prepared = await requireAdmin(request, options)
  if (prepared.error) return prepared.error
  const listed = await prepared.store.list()
  if (!listed.ok) {
    return json({ ok: false, error: listed.error, message: 'Poptávky se nepodařilo načíst.' }, 503)
  }
  const rows = listed.rows.map(adminOrder)
  const active = rows.filter((row) => row.activated && row.endsAt && Date.parse(row.endsAt) > (options.now ?? Date.now()))
  const paidRows = rows.filter((row) => row.paymentStatus === 'paid')
  const recordedRevenueCzk = paidRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  return json({
    ok: true,
    orders: rows,
    stats: {
      inquiries: rows.length,
      activeSponsorships: active.length,
      paidOrders: paidRows.length,
      recordedRevenueCzk,
      impressionsMeasured: false,
      webhookErrorsStored: false,
      note: 'Tržby jsou jen součet částek u objednávek se stavem platby paid v evidenci. Nejsou to peníze na účtu. Chyby webhooků se do databáze neukládají, dokud provozovatel neschválí auditní tabulku. Zobrazení a prokliky se neměří.',
    },
  })
}

export async function adminPromotionReviewHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, message: 'Povolená je jen metoda POST.' }, 405)
  }
  const prepared = await requireAdmin(request, options)
  if (prepared.error) return prepared.error
  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ ok: false, error: 'invalid-json', message: 'Požadavek musí být JSON.' }, 400)
  }
  const found = await prepared.store.get(payload.id)
  if (!found.ok) return json({ ok: false, error: 'missing', message: 'Poptávka se nenašla.' }, 404)
  const applied = applyAdminAction(found.row, payload.action, {
    now: options.now ?? Date.now(),
    note: payload.adminNote,
    placeId: payload.placeId,
    invoiceNumber: payload.invoiceNumber,
  })
  if (!applied.ok) {
    const message = applied.error === 'unpaid'
      ? 'Reklamu lze zapnout až po ověřené úhradě.'
      : applied.error === 'place'
        ? 'Chybí platný identifikátor podniku v katalogu.'
        : applied.error === 'invoice-number'
          ? 'Doplň číslo dokladu ze svého účetnictví. Web fakturu nevystavuje.'
          : 'Tuhle akci u poptávky udělat nejde.'
    return json({ ok: false, error: applied.error, paid: found.row.paymentStatus === 'paid', activated: false, message }, 400)
  }
  const saved = await prepared.store.save(applied.row)
  if (!saved.ok) return json({ ok: false, error: 'failed', message: 'Změnu se nepodařilo uložit.' }, 502)
  return json({
    ok: true,
    paid: applied.row.paymentStatus === 'paid',
    activated: applied.row.status === 'active',
    renewal: 'none',
    order: adminOrder(applied.row),
  })
}
