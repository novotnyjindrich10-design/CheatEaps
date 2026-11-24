/**
 * Platební brána: Comgate (karty + bankovní metody v CZK).
 * Bez schválení a klíčů se ven nic neposílá.
 * Návrat z platební stránky platbu nepotvrzuje.
 * Ověřený webhook (podpis + částka + měna) zapíše úhradu a aktivuje propagaci.
 * Stejná událost se zpracuje jen jednou.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { applyAdminAction, createSupabasePromotionStore } from './promotionOrders.js'
import { authConfig } from './supabaseAuth.js'

const COMGATE_CREATE_URL = 'https://payments.comgate.cz/v1.0/create'
const COMGATE_CREATE_URL_V2 = 'https://payments.comgate.cz/v2.0/payment'

/**
 * Comgate pro ČR (CZK). Stripe / GoPay se nezapojují paralelně.
 * Ostrý outbound vyžaduje PAYMENTS_LIVE=true + merchant + secret + webhook secret.
 * Sandbox outbound: PAYMENTS_SANDBOX_OUTBOUND=true bez LIVE (test=true u Comgate).
 */
export function paymentConfig(env = process.env) {
  const provider = String(env.PAYMENT_PROVIDER ?? '').trim().toLowerCase()
  const merchantId = String(env.PAYMENT_MERCHANT_ID ?? '').trim()
  const secret = String(env.PAYMENT_SECRET ?? '').trim()
  const webhookSecret = String(env.PAYMENT_WEBHOOK_SECRET ?? '').trim()
  const live = String(env.PAYMENTS_LIVE ?? '').trim() === 'true'
  const sandboxOutbound = String(env.PAYMENTS_SANDBOX_OUTBOUND ?? '').trim() === 'true'
  const known = provider === 'comgate'
  const credentials = Boolean(known && merchantId && secret && webhookSecret)
  const enabled = credentials && (live || sandboxOutbound)
  let reason = 'gateway-not-connected'
  if (credentials && !enabled) reason = 'gateway-credentials-present-outbound-off'
  else if (enabled && live) reason = 'live'
  else if (enabled) reason = 'sandbox'
  return {
    provider: known ? provider : '',
    merchantId,
    secret,
    webhookSecret,
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
    message: 'Návrat z platební stránky platbu nepotvrzuje.',
  }
}

export function verifyWebhookSignature(rawBody, header, secret) {
  if (!secret || !header) return false
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex')
  const left = Buffer.from(digest)
  const right = Buffer.from(String(header).trim())
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/**
 * Tělo požadavku na Comgate create. Samo o sobě nic neodešle.
 * Cena v haléřích (99 Kč → 9900). test=true mimo LIVE.
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
      test: !config.live,
      renewal: 'none',
    },
  }
}

/**
 * Založí Comgate platbu a vrátí redirect URL.
 * Bez credentials / outbound flagu nic neposílá.
 */
export async function createComgatePayment(order, options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const built = buildGatewayPayment(order, env)
  if (!built.ok) return built
  const config = paymentConfig(env)
  const body = new URLSearchParams()
  body.set('merchant', config.merchantId)
  body.set('price', String(built.request.price))
  body.set('curr', built.request.curr)
  body.set('label', built.request.label)
  body.set('refId', built.request.refId)
  body.set('method', built.request.method)
  body.set('country', built.request.country)
  body.set('test', built.request.test ? 'true' : 'false')
  if (built.request.email) body.set('email', built.request.email)
  if (order?.returnUrl) body.set('url_paid', String(order.returnUrl))
  if (order?.cancelUrl) body.set('url_cancelled', String(order.cancelUrl))
  if (order?.pendingUrl) body.set('url_pending', String(order.pendingUrl))

  const auth = Buffer.from(`${config.merchantId}:${config.secret}`).toString('base64')
  let response
  try {
    response = await fetchImpl(COMGATE_CREATE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    })
  } catch {
    return { ok: false, enabled: true, paid: false, error: 'gateway-unreachable' }
  }

  let payload = null
  const text = await response.text()
  try {
    payload = JSON.parse(text)
  } catch {
    const params = new URLSearchParams(text)
    payload = Object.fromEntries(params.entries())
  }

  const code = String(payload?.code ?? payload?.errorCode ?? '')
  const redirect = String(payload?.redirect ?? payload?.paymentUrl ?? '').trim()
  const transId = String(payload?.transId ?? '').trim()
  if (!response.ok || (code && code !== '0') || !redirect) {
    return {
      ok: false,
      enabled: true,
      paid: false,
      error: 'gateway-rejected',
      message: String(payload?.message || payload?.errorMessage || 'Comgate platbu nepřijala.'),
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
    api: COMGATE_CREATE_URL_V2,
  }
}

/** Testovací simulace jen když není ostrý provoz a tajemství má aspoň 16 znaků. */
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

function secretsMatch(header, secret) {
  const left = Buffer.from(String(header || ''))
  const right = Buffer.from(String(secret || ''))
  if (!secret || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function validPlaceId(value) {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(String(value || ''))
}

function placeIdForActivation(row, requested) {
  if (validPlaceId(row?.placeId)) return String(row.placeId)
  if (validPlaceId(requested)) return String(requested)
  return ''
}

function amountsMatch(row, event) {
  if (event?.amount == null || event?.amount === '') return true
  const expected = Number(row?.amount)
  const got = Number(event.amount)
  if (!Number.isFinite(expected) || !Number.isFinite(got)) return false
  return Math.round(expected) === Math.round(got)
}

function currencyMatch(event) {
  if (event?.currency == null || event?.currency === '') return true
  return String(event.currency).trim().toUpperCase() === 'CZK'
}

function json(body, status = 200, headers) {
  return Response.json(body, { status, headers })
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

export async function paymentWebhookHttp(request, options = {}) {
  if (request.method !== 'POST') {
    return json({ ok: false, paid: false, activated: false, message: 'Povolená je jen metoda POST.' }, 405)
  }
  const env = options.env ?? process.env
  const config = paymentConfig(env)
  const raw = await request.text()
  if (!config.webhookSecret) {
    return json({
      ok: false,
      paid: false,
      activated: false,
      error: 'not-configured',
      message: 'Webhook plateb není nastavený. Stav poptávky se nezměnil.',
    }, 503)
  }
  const header = request.headers.get('x-cheapeats-signature') || ''
  if (!verifyWebhookSignature(raw, header, config.webhookSecret)) {
    return json({ ok: false, paid: false, activated: false, error: 'bad-signature', message: 'Podpis platby nesedí.' }, 401)
  }
  let event
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ ok: false, paid: false, activated: false, error: 'invalid-json', message: 'Webhook nemá platný JSON.' }, 400)
  }
  if (!event?.eventId || !event?.reference || !event?.status) {
    return json({ ok: false, paid: false, activated: false, error: 'invalid-event', message: 'Ve webhooku chybí identifikace platby.' }, 400)
  }
  const store = storeFor(options)
  if (!store) {
    return json({ ok: false, paid: false, activated: false, error: 'not-configured', message: 'Platbu není kam zapsat.' }, 503)
  }

  // Nejdřív najdi objednávku kvůli kontrole částky/měny (bez zápisu).
  let existing = null
  if (typeof store.list === 'function') {
    const listed = await store.list()
    existing = listed.rows?.find((row) => row.reference === String(event.reference)) || null
  } else if (typeof store.readOwn === 'function' && event.accessKey) {
    const own = await store.readOwn(String(event.reference), String(event.accessKey))
    existing = own.ok ? own.row : null
  }

  if (existing) {
    if (!amountsMatch(existing, event)) {
      return json({
        ok: false,
        paid: false,
        activated: false,
        error: 'amount-mismatch',
        message: 'Částka ve webhooku nesedí s objednávkou.',
      }, 400)
    }
    if (!currencyMatch(event)) {
      return json({
        ok: false,
        paid: false,
        activated: false,
        error: 'currency-mismatch',
        message: 'Měna ve webhooku musí být CZK.',
      }, 400)
    }
  }

  const applied = await store.applyPayment({
    eventId: String(event.eventId),
    reference: String(event.reference),
    status: String(event.status),
  })
  if (!applied.ok) {
    return json({ ok: false, paid: false, activated: false, error: applied.error || 'failed', message: 'Platbu se nepodařilo zapsat.' }, 400)
  }

  let row = applied.row
  if (applied.duplicate) {
    return json({
      ok: true,
      duplicate: true,
      paid: row?.paymentStatus === 'paid',
      activated: row?.status === 'active',
      renewal: 'none',
    })
  }

  const activated = await activateAfterPaid(store, row, event, options.now ?? Date.now())
  row = activated.row
  return json({
    ok: true,
    duplicate: false,
    paid: event.status === 'paid',
    activated: activated.activated,
    renewal: 'none',
    endsAt: row?.endsAt || null,
    live: config.live,
  })
}

/**
 * Simulace potvrzené platby bez převodu peněz.
 * Návratová URL sem nepatří. Stejné eventId se zpracuje jen jednou
 * a už běžící období se neprodlužuje.
 */
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
  if (applied.duplicate) {
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
  const activated = await activateAfterPaid(store, row, event, options.now ?? Date.now())
  row = activated.row
  return json({
    ok: true,
    test: true,
    duplicate: false,
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
  if (!config.enabled) {
    return json({
      ok: true,
      enabled: false,
      method: 'inquiry',
      renewal: 'none',
      provider: config.provider || '',
      reason: config.reason,
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
