/**
 * Comgate (CZK): create, push notifikace, status verify, aktivace.
 * Oficiální push: merchant + secret v těle (ne vlastní HMAC).
 * Stav se vždy ověří přes /v1.0/status. Return URL neaktivuje.
 * test=true nesmí aktivovat produkční propagaci při PAYMENTS_LIVE / Production.
 */
import { timingSafeEqual } from 'node:crypto'
import { applyAdminAction, createSupabasePromotionStore } from './promotionOrders.js'
import { authConfig } from './supabaseAuth.js'

const COMGATE_CREATE_URL = 'https://payments.comgate.cz/v1.0/create'
const COMGATE_STATUS_URL = 'https://payments.comgate.cz/v1.0/status'

/**
 * Potřebné env: PAYMENT_PROVIDER=comgate, PAYMENT_MERCHANT_ID, PAYMENT_SECRET.
 * PAYMENT_WEBHOOK_SECRET se u Comgate nepoužívá (secret jde v těle push).
 * Outbound: PAYMENTS_SANDBOX_OUTBOUND=true (test) nebo PAYMENTS_LIVE=true.
 */
export function paymentConfig(env = process.env) {
  const provider = String(env.PAYMENT_PROVIDER ?? '').trim().toLowerCase()
  const merchantId = String(env.PAYMENT_MERCHANT_ID ?? '').trim()
  const secret = String(env.PAYMENT_SECRET ?? '').trim()
  const live = String(env.PAYMENTS_LIVE ?? '').trim() === 'true'
  const sandboxOutbound = String(env.PAYMENTS_SANDBOX_OUTBOUND ?? '').trim() === 'true'
  const known = provider === 'comgate'
  const credentials = Boolean(known && merchantId && secret)
  const enabled = credentials && (live || sandboxOutbound)
  let reason = 'gateway-not-connected'
  if (credentials && !enabled) reason = 'gateway-credentials-present-outbound-off'
  else if (enabled && live) reason = 'live'
  else if (enabled) reason = 'sandbox'
  return {
    provider: known ? provider : '',
    merchantId,
    secret,
    live,
    sandboxOutbound,
    credentials,
    enabled,
    reason,
  }
}

/** Návratové URL z brány. Stav v adrese se ignoruje. */
export function interpretPaymentReturn() {
  return {
    ok: true,
    paid: false,
    activated: false,
    message: 'Návrat z platební stránky platbu nepotvrzuje. Stav řeší Comgate push + /status.',
  }
}

export function secretsMatch(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  if (!right || a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** @deprecated Comgate push používá secret v těle. Zachováno jen pro starší unit testy. */
export function verifyWebhookSignature() {
  return false
}

export function parseComgatePush(raw, contentType = '') {
  const text = String(raw || '')
  if (!text.trim()) return null
  const type = String(contentType || '').toLowerCase()
  if (type.includes('application/json') || text.trim().startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  const params = new URLSearchParams(text)
  return Object.fromEntries(params.entries())
}

export function mapComgateStatus(value) {
  const status = String(value || '').trim().toUpperCase()
  if (status === 'PAID') return 'paid'
  if (status === 'CANCELLED' || status === 'CANCELED') return 'cancelled'
  if (status === 'PENDING') return 'pending'
  if (status === 'AUTHORIZED') return 'authorized'
  return ''
}

export function isComgateTestFlag(value) {
  const raw = String(value ?? '').trim().toLowerCase()
  return raw === 'true' || raw === '1'
}

/**
 * Tělo create (v1.0 POST): merchant+secret v těle, prepareOnly=true, cena v haléřích.
 */
export function buildGatewayPayment(order, env = process.env) {
  const config = paymentConfig(env)
  if (!config.enabled) {
    return { ok: false, enabled: false, paid: false, error: 'not-configured' }
  }
  const amountCzk = Number(order?.amount)
  if (!Number.isFinite(amountCzk) || amountCzk < 1) {
    return { ok: false, enabled: false, paid: false, error: 'invalid-amount' }
  }
  const reference = String(order?.reference || '').trim()
  if (!reference) {
    return { ok: false, enabled: false, paid: false, error: 'missing-reference' }
  }
  const price = Math.round(amountCzk * 100)
  const label = String(order?.planName || order?.planId || 'FoodGo').slice(0, 16)
  return {
    ok: true,
    enabled: true,
    paid: false,
    error: '',
    request: {
      provider: 'comgate',
      merchant: config.merchantId,
      price,
      curr: 'CZK',
      label,
      refId: reference,
      email: String(order?.email || '').trim(),
      method: 'ALL',
      country: 'CZ',
      prepareOnly: true,
      test: !config.live,
      renewal: 'none',
    },
  }
}

export async function fetchComgateStatus(transId, options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const config = paymentConfig(env)
  if (!config.credentials || !transId) {
    return { ok: false, error: 'not-configured' }
  }
  const body = new URLSearchParams()
  body.set('merchant', config.merchantId)
  body.set('transId', String(transId))
  body.set('secret', config.secret)
  let response
  try {
    response = await fetchImpl(COMGATE_STATUS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  } catch {
    return { ok: false, error: 'gateway-unreachable' }
  }
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    payload = Object.fromEntries(new URLSearchParams(text).entries())
  }
  const code = String(payload?.code ?? '')
  if (!response.ok || (code && code !== '0')) {
    return { ok: false, error: 'status-failed', payload }
  }
  return {
    ok: true,
    transId: String(payload.transId || transId),
    status: mapComgateStatus(payload.status),
    rawStatus: String(payload.status || ''),
    price: Number(payload.price),
    curr: String(payload.curr || '').toUpperCase(),
    refId: String(payload.refId || ''),
    test: isComgateTestFlag(payload.test),
    payload,
  }
}

export async function createComgatePayment(order, options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const built = buildGatewayPayment(order, env)
  if (!built.ok) return built
  const config = paymentConfig(env)
  const body = new URLSearchParams()
  body.set('merchant', config.merchantId)
  body.set('secret', config.secret)
  body.set('price', String(built.request.price))
  body.set('curr', built.request.curr)
  body.set('label', built.request.label)
  body.set('refId', built.request.refId)
  body.set('method', built.request.method)
  body.set('country', built.request.country)
  body.set('prepareOnly', 'true')
  body.set('test', built.request.test ? 'true' : 'false')
  if (built.request.email) body.set('email', built.request.email)
  if (order?.returnUrl) body.set('url_paid', String(order.returnUrl))
  if (order?.cancelUrl) body.set('url_cancelled', String(order.cancelUrl))
  if (order?.pendingUrl) body.set('url_pending', String(order.pendingUrl))

  let response
  try {
    response = await fetchImpl(COMGATE_CREATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
  } catch {
    return { ok: false, enabled: true, paid: false, error: 'gateway-unreachable' }
  }

  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    payload = Object.fromEntries(new URLSearchParams(text).entries())
  }
  const code = String(payload?.code ?? '')
  const redirect = String(payload?.redirect ?? '').trim()
  const transId = String(payload?.transId ?? '').trim()
  if (!response.ok || (code && code !== '0') || !redirect) {
    return {
      ok: false,
      enabled: true,
      paid: false,
      error: 'gateway-rejected',
      message: String(payload?.message || 'Comgate platbu nepřijala.'),
    }
  }
  return {
    ok: true,
    enabled: true,
    paid: false,
    provider: 'comgate',
    redirect,
    transId,
    test: !config.live,
    renewal: 'none',
  }
}

export function paymentTestMode(env = process.env) {
  const live = String(env.PAYMENTS_LIVE ?? '').trim() === 'true'
  const requested = String(env.PAYMENTS_TEST_MODE ?? '').trim() === 'true'
  const production = String(env.VERCEL_ENV ?? '').trim() === 'production'
  const secret = String(env.PAYMENT_TEST_SECRET ?? '').trim()
  return {
    enabled: requested && !live && !production && secret.length >= 16,
    live,
    secret,
  }
}

function validPlaceId(value) {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(String(value || ''))
}

function placeIdForActivation(row, requested) {
  if (validPlaceId(row?.placeId)) return String(row.placeId)
  if (validPlaceId(requested)) return String(requested)
  return ''
}

function priceMatchesOrder(row, priceHalers) {
  if (!Number.isFinite(priceHalers)) return false
  const expected = Math.round(Number(row?.amount) * 100)
  return Number.isFinite(expected) && expected === Math.round(priceHalers)
}

function json(body, status = 200, headers) {
  return Response.json(body, { status, headers })
}

function okPush() {
  return new Response('OK', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

function storeFor(options) {
  if (options.store) return options.store
  const config = authConfig(options.env ?? process.env)
  if (!config.configured) return null
  return createSupabasePromotionStore({
    config,
    accessToken: '',
    fetchImpl: options.fetchImpl ?? fetch,
  })
}

/**
 * Testovací Comgate push nesmí zapnout ostré veřejné umístění.
 * Aktivace jen když: paid + (sandbox režim a test) nebo (live a !test).
 */
export function mayActivateFromComgate(verified, env = process.env) {
  const config = paymentConfig(env)
  const production = String(env.VERCEL_ENV ?? '').trim() === 'production'
  if (verified.status !== 'paid') return { ok: false, reason: 'not-paid' }
  if (verified.test) {
    if (config.live || production) {
      return { ok: false, reason: 'test-payment-blocked-on-live' }
    }
    return { ok: true, paymentSource: 'gateway-test' }
  }
  if (!config.live) {
    return { ok: false, reason: 'live-payment-while-sandbox-only' }
  }
  return { ok: true, paymentSource: 'gateway' }
}

async function activateAfterPaid(store, row, event, now) {
  if (!row || row.status === 'active' || event?.status !== 'paid') {
    return { row, activated: row?.status === 'active' }
  }
  if (typeof store.save !== 'function') {
    return { row, activated: false }
  }
  const placeId = placeIdForActivation(row, event?.placeId)
  if (!placeId) return { row, activated: false }
  const next = applyAdminAction(row, 'activate', { now, placeId })
  if (!next.ok) return { row, activated: false }
  if (event.paymentSource) {
    next.row.paymentSource = event.paymentSource
  }
  const saved = await store.save(next.row)
  if (!saved.ok) return { row, activated: false }
  return { row: next.row, activated: next.row.status === 'active' }
}

export async function paymentReturnHttp(request) {
  if (request.method !== 'GET') {
    return json({ ok: false, paid: false, activated: false, message: 'Povolená je jen metoda GET.' }, 405)
  }
  return json(interpretPaymentReturn())
}

/**
 * Comgate push (form nebo JSON). Ověří secret, zavolá /status, zapíše platbu.
 * Odpověď 200 OK (Comgate očekává 2xx).
 */
export async function paymentWebhookHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, paid: false, activated: false, message: 'Povolená je jen metoda POST.' }, 405)
  }
  const env = options.env ?? process.env
  const config = paymentConfig(env)
  if (!config.credentials) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'not-configured',
      message: 'Comgate není nastavený (PAYMENT_MERCHANT_ID + PAYMENT_SECRET).',
    }, 503)
  }

  const raw = await request.text()
  const push = parseComgatePush(raw, request.headers.get('content-type') || '')
  if (!push?.transId || !push?.refId || !push?.status) {
    return json({ ok: false, paid: false, activated: false, error: 'invalid-event', message: 'Comgate push nemá transId/refId/status.' }, 400)
  }
  if (!secretsMatch(push.merchant, config.merchantId) || !secretsMatch(push.secret, config.secret)) {
    return json({ ok: false, paid: false, activated: false, error: 'bad-secret', message: 'Comgate merchant/secret nesedí.' }, 401)
  }

  const verified = await fetchComgateStatus(push.transId, {
    env,
    fetchImpl: options.fetchImpl ?? fetch,
  })
  if (!verified.ok) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: verified.error || 'status-failed',
      message: 'Stav platby u Comgate se nepodařilo ověřit.',
    }, 502)
  }

  const store = storeFor(options)
  if (!store) {
    return json({ ok: false, paid: false, activated: false, error: 'not-configured', message: 'Platbu není kam zapsat.' }, 503)
  }

  let existing = null
  if (typeof store.getByReference === 'function') {
    const found = await store.getByReference(verified.refId)
    existing = found?.row || null
  }
  if (!existing && typeof store.list === 'function') {
    const listed = await store.list()
    existing = listed.rows?.find((row) => row.reference === verified.refId) || null
  }
  if (!existing) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'missing-order',
      message: 'Objednávka k refId se nenašla.',
    }, 404)
  }
  if (!priceMatchesOrder(existing, verified.price) || verified.curr !== 'CZK') {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'amount-mismatch',
      message: 'Ověřená částka/měna nesedí s objednávkou.',
    }, 400)
  }

  const mapped = verified.status === 'paid'
    ? 'paid'
    : verified.status === 'cancelled'
      ? 'cancelled'
      : verified.status === 'pending'
        ? 'pending'
        : 'failed'

  const gate = mayActivateFromComgate(verified, env)
  const applied = await store.applyPayment({
    eventId: `comgate:${verified.transId}`,
    reference: verified.refId,
    status: mapped === 'paid' ? 'paid' : mapped === 'cancelled' ? 'cancelled' : mapped,
    paymentSource: gate.ok ? gate.paymentSource : '',
  })
  if (!applied.ok) {
    return json({ ok: false, paid: false, activated: false, error: applied.error || 'failed', message: 'Platbu se nepodařilo zapsat.' }, 400)
  }

  let row = applied.row || existing
  if (mapped === 'paid' && row?.paymentStatus !== 'paid' && typeof store.getByReference === 'function') {
    const again = await store.getByReference(verified.refId)
    if (again?.row) row = again.row
  }

  let activated = row?.status === 'active'
  if (gate.ok && mapped === 'paid' && row && row.status !== 'active') {
    const act = typeof store.activatePaid === 'function'
      ? await store.activatePaid(verified.refId, {
          paymentSource: gate.paymentSource,
          now: options.now ?? Date.now(),
        })
      : await activateAfterPaid(
          store,
          { ...row, paymentStatus: 'paid' },
          { status: 'paid', placeId: row.placeId, paymentSource: gate.paymentSource },
          options.now ?? Date.now(),
        )
    if (act?.row) row = act.row
    activated = Boolean(act?.activated)
    if (!activated && row?.placeId) {
      return json({
        ok: false,
        paid: true,
        activated: false,
        duplicate: Boolean(applied.duplicate),
        error: 'activation-failed',
        message: 'Platba je zapsaná, propagace se neaktivovala. Stejný webhook lze bezpečně zopakovat.',
      }, 503)
    }
  }

  // Comgate vyžaduje 2xx; tělo stačí OK. Detaily necháváme v JSON jen když klient není Comgate.
  if (options.debugJson) {
    return json({
      ok: true,
      paid: mapped === 'paid',
      activated,
      test: verified.test,
      blockedReason: gate.ok ? '' : gate.reason,
      renewal: 'none',
      endsAt: row?.endsAt || null,
    })
  }
  return okPush()
}

export async function paymentTestConfirmHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, paid: false, activated: false, message: 'Povolená je jen metoda POST.' }, 405)
  }
  const env = options.env ?? process.env
  const mode = paymentTestMode(env)
  if (!mode.enabled) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'test-mode-off',
      message: 'Testovací potvrzení platby je vypnuté. Ostrá platba se nespouští.',
    }, 404)
  }
  if (!secretsMatch(request.headers.get('x-foodgo-test-secret') || '', mode.secret)) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'bad-secret',
      message: 'Testovací potvrzení bylo odmítnuto.',
    }, 401)
  }
  let event
  try {
    event = await request.json()
  } catch {
    return json({ ok: false, paid: false, activated: false, error: 'invalid-json', message: 'Tělo musí být JSON.' }, 400)
  }
  if (!event?.eventId || !event?.reference || !event?.status) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'invalid-event',
      message: 'Chybí identifikace testovací platby.',
    }, 400)
  }
  const store = storeFor(options)
  if (!store?.applyPayment) {
    return json({ ok: false, paid: false, activated: false, error: 'not-configured', message: 'Testovací platbu není kam zapsat.' }, 503)
  }
  const applied = await store.applyPayment({
    eventId: String(event.eventId),
    reference: String(event.reference),
    status: String(event.status),
  })
  if (!applied.ok) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: applied.error || 'failed',
      message: 'Testovací platbu se nepodařilo zapsat.',
    }, 400)
  }
  let row = applied.row
  if (applied.duplicate && (row?.status === 'active' || event.status !== 'paid')) {
    return json({
      ok: true,
      test: true,
      duplicate: true,
      paid: row?.paymentStatus === 'paid',
      activated: row?.status === 'active',
      renewal: 'none',
      message: 'Stejná testovací událost už byla zpracovaná.',
    })
  }
  const activated = typeof store.activatePaid === 'function' && event.status === 'paid'
    ? await store.activatePaid(String(event.reference), {
        paymentSource: 'gateway-test',
        now: options.now ?? Date.now(),
      })
    : await activateAfterPaid(
        store,
        row,
        { ...event, paymentSource: 'gateway-test' },
        options.now ?? Date.now(),
      )
  row = activated.row
  if (event.status === 'paid' && row?.placeId && !activated.activated) {
    return json({
      ok: false,
      test: true,
      paid: true,
      activated: false,
      duplicate: Boolean(applied.duplicate),
      error: 'activation-failed',
      message: 'Testovací platba je zapsaná, propagace se neaktivovala. Stejný požadavek lze zopakovat.',
    }, 503)
  }
  return json({
    ok: true,
    test: true,
    duplicate: Boolean(applied.duplicate),
    paid: row?.paymentStatus === 'paid',
    activated: activated.activated,
    renewal: 'none',
    reference: row?.reference || String(event.reference),
    endsAt: row?.endsAt || null,
    message: activated.activated
      ? 'Testovací platba je ověřená a propagace je v testovací evidenci zapnutá. Peníze se nepřevedly.'
      : 'Testovací platba je zapsaná. Propagace se nezapnula.',
  })
}

export async function paymentStatusHttp(request, options = {}) {
  if (request.method !== 'GET') {
    return json({ ok: false, message: 'Povolená je jen metoda GET.' }, 405)
  }
  const env = options.env ?? process.env
  const config = paymentConfig(env)
  const bypassConfigured = Boolean(String(env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '').trim())
  if (!config.enabled) {
    return json({
      ok: true,
      enabled: false,
      method: 'inquiry',
      renewal: 'none',
      provider: config.provider || '',
      reason: config.reason,
      webhookPath: '/api/payments/webhook',
      protectionBypassConfigured: bypassConfigured,
      message: 'Online platba není zapojená. Lze poslat nezávaznou poptávku a uhradit ji fakturou.',
    })
  }
  return json({
    ok: true,
    enabled: true,
    method: 'comgate',
    renewal: 'none',
    provider: 'comgate',
    live: config.live,
    reason: config.reason,
    webhookPath: '/api/payments/webhook',
    protectionBypassConfigured: bypassConfigured,
    message: config.live
      ? 'Comgate je připravený pro ostré platby.'
      : 'Comgate sandbox outbound je zapnutý (test=true). Ostré platby jsou vypnuté.',
  })
}

export async function paymentCreateHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, paid: false, error: 'method', message: 'Povolená je jen metoda POST.' }, 405)
  }
  const env = options.env ?? process.env
  const config = paymentConfig(env)
  if (!config.enabled) {
    return json({
      ok: false,
      paid: false,
      enabled: false,
      error: 'not-configured',
      message: 'Online platba není zapojená. Použij nezávaznou poptávku.',
    }, 503)
  }
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, paid: false, error: 'invalid-json', message: 'Tělo musí být JSON.' }, 400)
  }
  const reference = String(body?.reference || '').trim()
  const accessKey = String(body?.accessKey || body?.key || '').trim()
  if (!reference || !accessKey) {
    return json({ ok: false, paid: false, error: 'missing-credentials', message: 'Chybí kód poptávky nebo přístupový klíč.' }, 400)
  }
  const store = storeFor(options)
  if (!store?.readOwn) {
    return json({ ok: false, paid: false, error: 'not-configured', message: 'Objednávku nelze načíst.' }, 503)
  }
  const found = await store.readOwn(reference, accessKey)
  if (!found.ok) {
    return json({ ok: false, paid: false, error: 'missing', message: 'Poptávka se nenašla.' }, 404)
  }
  const row = found.row
  if (row.paymentStatus === 'paid') {
    return json({ ok: false, paid: true, error: 'already-paid', message: 'Tato poptávka už je uhrazená.' }, 409)
  }
  const created = await createComgatePayment(row, {
    env,
    fetchImpl: options.fetchImpl ?? fetch,
  })
  if (!created.ok) {
    return json({
      ok: false,
      paid: false,
      enabled: true,
      error: created.error || 'gateway-failed',
      message: created.message || 'Platební relaci se nepodařilo založit.',
    }, 502)
  }
  return json({
    ok: true,
    paid: false,
    provider: 'comgate',
    redirect: created.redirect,
    transId: created.transId,
    test: created.test,
    renewal: 'none',
    amount: row.amount,
    currency: 'CZK',
  })
}
