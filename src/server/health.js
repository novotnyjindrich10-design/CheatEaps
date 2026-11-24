/**
 * Veřejný health endpoint bez tajných hodnot a bez detailů konfigurace.
 */
import { authConfig } from './supabaseAuth.js'
import { paymentConfig } from './payments.js'

function present(value) {
  return Boolean(String(value || '').trim())
}

export function healthSnapshot(env = process.env) {
  const auth = authConfig(env)
  const payments = paymentConfig(env)
  const resend = present(env.RESEND_API_KEY)
  const siteUrl = present(env.PUBLIC_SITE_URL)
  const livePayments = String(env.PAYMENTS_LIVE || '').trim() === 'true'

  return {
    ok: true,
    service: 'foodgo',
    time: new Date().toISOString(),
    checks: {
      supabaseConfigured: Boolean(auth.configured),
      paymentsConfigured: Boolean(payments.enabled),
      paymentsLive: livePayments,
      emailConfigured: resend,
      publicSiteUrl: siteUrl,
    },
  }
}

export async function healthHttp(request, { env } = {}) {
  if (request.method !== 'GET') {
    return Response.json({ ok: false, message: 'Method not allowed' }, { status: 405 })
  }
  return Response.json(healthSnapshot(env ?? process.env), {
    status: 200,
    headers: {
      'cache-control': 'no-store',
    },
  })
}
