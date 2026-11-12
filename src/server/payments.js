/**
 * Platební brána pro české podnikatele (Comgate, případně GoPay).
 * Bez schválení a klíčů se ven nic neposílá.
 * Návrat z platební stránky platbu nepotvrzuje.
 * Stejná událost webhooku se zpracuje jen jednou a reklamu sama nezapne.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createSupabasePromotionStore } from './promotionOrders.js'
import { authConfig } from './supabaseAuth.js'

export function paymentConfig(env = process.env) {
  const provider = String(env.PAYMENT_PROVIDER ?? '').trim().toLowerCase()
  const merchantId = String(env.PAYMENT_MERCHANT_ID ?? '').trim()
  const secret = String(env.PAYMENT_SECRET ?? '').trim()
  const webhookSecret = String(env.PAYMENT_WEBHOOK_SECRET ?? '').trim()
  const live = String(env.PAYMENTS_LIVE ?? '').trim() === 'true'
  const known = provider === 'comgate' || provider === 'gopay'
  return {
    provider: known ? provider : '',
    merchantId,
    secret,
    webhookSecret,
    live,
    enabled: false,
    reason: 'gateway-not-connected',
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
 * Tělo, které by později šlo na bránu. Samo o sobě požadavek neodešle.
 * allowOutbound zůstává vypnuté, dokud nebude brána schválená a napojená.
 */
export function buildGatewayPayment(order, env = process.env) {
  const config = paymentConfig(env)
  if (!config.live || !config.provider || !config.merchantId || !config.secret) {
    return { ok: false, enabled: false, paid: false, error: 'not-configured' }
  }
  return {
    ok: false,
    enabled: false,
    paid: false,
    error: 'gateway-not-wired',
    request: {
      provider: config.provider,
      reference: order?.reference || '',
      amount: order?.amount,
      currency: 'CZK',
      renewal: 'none',
    },
  }
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
  const applied = await store.applyPayment({
    eventId: String(event.eventId),
    reference: String(event.reference),
    status: String(event.status),
  })
  if (!applied.ok) {
    return json({ ok: false, paid: false, activated: false, error: applied.error || 'failed', message: 'Platbu se nepodařilo zapsat.' }, 400)
  }
  return json({
    ok: true,
    duplicate: Boolean(applied.duplicate),
    paid: event.status === 'paid',
    activated: false,
    renewal: 'none',
  })
}

export async function paymentStatusHttp(request) {
  if (request.method !== 'GET') {
    return json({ ok: false, message: 'Povolená je jen metoda GET.' }, 405)
  }
  return json({
    ok: true,
    enabled: false,
    method: 'inquiry',
    renewal: 'none',
    reason: 'gateway-not-connected',
    message: 'Online platba není zapojená. Lze poslat nezávaznou poptávku a uhradit ji fakturou.',
  })
}
