/**
 * Jednotný HTTP router pro všechny /api/* cesty.
 * Na Vercelu Hobby běží jako jedna Serverless Function (api/index.js).
 * Zachovává původní URL, metody a handlery.
 */
import { businessHttp } from './businessApplications.js'
import { communityHttp } from './community.js'
import { authActionHttp, dealDetailHttp } from './memberHttp.js'
import { promotionRequestHttp } from './promotionRequest.js'
import { quotePromotionHttp } from './quotePromotion.js'

const AUTH_ACTIONS = {
  '/api/auth/login': 'login',
  '/api/auth/signup': 'signup',
  '/api/auth/logout': 'logout',
  '/api/auth/session': 'session',
  '/api/auth/recover': 'recover',
  '/api/auth/prepare-recovery': 'prepare-recovery',
  '/api/auth/update-password': 'update-password',
}

const COMMUNITY_PATHS = new Set(['/api/favorites', '/api/reviews', '/api/review-reports'])

const BUSINESS_PATHS = new Set([
  '/api/published-places',
  '/api/business-applications',
  '/api/business-description-review',
  '/api/business-existence-check',
  '/api/admin/me',
  '/api/admin/business-applications',
  '/api/admin/business-applications/review',
  '/api/admin/business-applications/resend-email',
])

function json(body, status = 404, headers) {
  return Response.json(body, { status, headers })
}

/** Odstraní koncové lomítko a vrátí Request se stejnou metodou, hlavičkami i tělem. */
function normalizeApiRequest(request) {
  const url = new URL(request.url)
  if (url.pathname.length <= 1 || !url.pathname.endsWith('/')) {
    return { request, pathname: url.pathname }
  }
  url.pathname = url.pathname.slice(0, -1)
  return { request: new Request(url, request), pathname: url.pathname }
}

async function promotionRequestFetch(request) {
  const result = await promotionRequestHttp(request)
  return json(result.body, result.status, result.headers)
}

export async function apiRouter(incoming) {
  try {
    const { request, pathname } = normalizeApiRequest(incoming)

    const authAction = AUTH_ACTIONS[pathname]
    if (authAction) return await authActionHttp(authAction, request)

    if (pathname === '/api/deal-detail') return await dealDetailHttp(request)

    if (COMMUNITY_PATHS.has(pathname)) return await communityHttp(request)

    if (BUSINESS_PATHS.has(pathname)) return await businessHttp(request)

    if (pathname === '/api/promotion-request') return await promotionRequestFetch(request)

    if (pathname === '/api/quote-promotion') {
      try {
        return await quotePromotionHttp(request)
      } catch {
        return json({ ok: false, error: 'internal-error', message: 'Cenu se nepodařilo spočítat.' }, 500)
      }
    }

    return json({ ok: false, message: 'Neznámá adresa.' }, 404)
  } catch {
    return json({ ok: false, message: 'Požadavek se nepodařilo zpracovat.' }, 500)
  }
}

export default {
  fetch(request) {
    return apiRouter(request)
  },
}
