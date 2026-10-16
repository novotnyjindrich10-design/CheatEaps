/**
 * Vercel Function: POST /api/quote-promotion
 * Vite vývojový server tenhle soubor neobsluhuje. Nasadí ho až Vercel ze složky api/.
 * Cenu počítá quoteTrustedPrice. Částku z požadavku nečte.
 */
import { quoteTrustedPrice } from '../src/constants/promotionPrice.js'

function json(body, status, headers) {
  return Response.json(body, { status, headers })
}

function missing(payload, key) {
  if (!Object.hasOwn(payload, key)) return true
  const value = payload[key]
  return value == null || value === ''
}

/**
 * HTTP obsluha dotazu na cenu. Druhý argument je jen pro test selhání výpočtu.
 * Produkční vstup volá quoteTrustedPrice a další pole požadavku ignoruje.
 */
export async function quotePromotionHttp(request, quote = quoteTrustedPrice) {
  if (request.method !== 'POST') {
    return json(
      { ok: false, error: 'method-not-allowed', message: 'Povolená je jen metoda POST.' },
      405,
      { Allow: 'POST' },
    )
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return json(
      { ok: false, error: 'invalid-json', message: 'Požadavek musí být JSON objekt s planId a periodId.' },
      400,
    )
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return json(
      { ok: false, error: 'invalid-json', message: 'Požadavek musí být JSON objekt s planId a periodId.' },
      400,
    )
  }

  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(
      { ok: false, error: 'invalid-json', message: 'Požadavek musí být JSON objekt s planId a periodId.' },
      400,
    )
  }

  if (missing(payload, 'planId')) {
    return json({ ok: false, error: 'missing-field', field: 'planId', message: 'Chybí planId.' }, 400)
  }
  if (missing(payload, 'periodId')) {
    return json({ ok: false, error: 'missing-field', field: 'periodId', message: 'Chybí periodId.' }, 400)
  }

  let quoted
  try {
    quoted = quote(payload.planId, payload.periodId)
  } catch {
    return json({ ok: false, error: 'internal-error', message: 'Cenu se nepodařilo spočítat.' }, 500)
  }

  if (!quoted?.ok) {
    const error = quoted?.error === 'unknown-period' ? 'unknown-period' : 'unknown-plan'
    const message = error === 'unknown-period' ? 'Neznámé období.' : 'Neznámý balíček.'
    return json({ ok: false, error, message }, 400)
  }

  return json(
    {
      ok: true,
      planId: quoted.planId,
      periodId: quoted.periodId,
      monthly: quoted.monthly,
      yearly: quoted.yearly,
      amount: quoted.amount,
      savings: quoted.savings,
      currency: quoted.currency,
    },
    200,
  )
}

export default {
  async fetch(request) {
    try {
      return await quotePromotionHttp(request)
    } catch {
      return json({ ok: false, error: 'internal-error', message: 'Cenu se nepodařilo spočítat.' }, 500)
    }
  },
}
