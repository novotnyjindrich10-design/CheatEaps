/**
 * Jednotný HTTP router pro všechny /api/* cesty.
 * Na Vercelu Hobby běží jako jedna Serverless Function (api/index.js).
 * Zachovává původní URL, metody a handlery.
 */
import { businessHttp } from './businessApplications.js'
import { communityHttp } from './community.js'
import { loyaltyHttp } from './loyalty.js'
import { authActionHttp, dealDetailHttp } from './memberHttp.js'
import {
  paymentCreateHttp,
  paymentReturnHttp,
  paymentStatusHttp,
  paymentTestConfirmHttp,
  paymentWebhookHttp,
} from './payments.js'
import { promotionRequestHttp } from './promotionRequest.js'
import {
  adminOwnerClaimsHttp,
  adminPromotionOrdersHttp,
  adminPromotionReviewHttp,
  promotionOrdersHttp,
  sponsorshipsHttp,
} from './promotionOrders.js'
import { quotePromotionHttp } from './quotePromotion.js'
import { placeReportsHttp } from './placeReports.js'
import { placeStatsHttp } from './placeStats.js'
import { placeOverridesHttp } from './placeOverrides.js'
import { healthHttp } from './health.js'
import { restaurantExists } from './community.js'

function catalogPlaceExists(id) {
  return restaurantExists(String(id || ''))
}

const AUTH_ACTIONS = {
  '/api/auth/login': 'login',
  '/api/auth/signup': 'signup',
  '/api/auth/logout': 'logout',
  '/api/auth/session': 'session',
  '/api/auth/recover': 'recover',
  '/api/auth/prepare-recovery': 'prepare-recovery',
  '/api/auth/update-password': 'update-password',
  '/api/auth/delete-account': 'delete-account',
}

const COMMUNITY_PATHS = new Set(['/api/favorites', '/api/reviews', '/api/review-reports'])

const LOYALTY_PATHS = new Set([
  '/api/loyalty/me',
  '/api/loyalty/history',
  '/api/loyalty/rewards',
  '/api/loyalty/redemptions',
  '/api/loyalty/redeem',
  '/api/admin/reviews/pending',
  '/api/admin/reviews/moderate',
  '/api/admin/loyalty/rewards',
  '/api/admin/loyalty/rewards/codes',
])

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

    if (LOYALTY_PATHS.has(pathname)) return await loyaltyHttp(request)

    if (BUSINESS_PATHS.has(pathname)) return await businessHttp(request)

    if (pathname === '/api/promotion-request') return await promotionRequestFetch(request)

    if (pathname === '/api/promotion-orders') {
      const response = await promotionOrdersHttp(request)
      return response
    }
    if (pathname === '/api/sponsorships') return await sponsorshipsHttp(request)
    if (pathname === '/api/admin/promotion-orders') return await adminPromotionOrdersHttp(request)
    if (pathname === '/api/admin/promotion-orders/review') return await adminPromotionReviewHttp(request)
    if (pathname === '/api/admin/owner-claims') return await adminOwnerClaimsHttp(request)
    if (pathname === '/api/payments/webhook') return await paymentWebhookHttp(request)
    if (pathname === '/api/payments/test-confirm') return await paymentTestConfirmHttp(request)
    if (pathname === '/api/payments/create') return await paymentCreateHttp(request)
    if (pathname === '/api/payments/return') return await paymentReturnHttp(request)
    if (pathname === '/api/payments/status') return await paymentStatusHttp(request)

    if (pathname === '/api/quote-promotion') {
      try {
        return await quotePromotionHttp(request)
      } catch {
        return json({ ok: false, error: 'internal-error', message: 'Cenu se nepodařilo spočítat.' }, 500)
      }
    }

    if (pathname === '/api/place-reports') {
      return await placeReportsHttp(request, { placeExists: catalogPlaceExists })
    }

    if (pathname === '/api/place-overrides' || pathname === '/api/admin/place-overrides') {
      return await placeOverridesHttp(request, { placeExists: catalogPlaceExists })
    }

    if (
      pathname === '/api/place-stats' ||
      pathname === '/api/place-stats/event' ||
      pathname === '/api/place-stats/owner'
    ) {
      return await placeStatsHttp(request, { placeExists: catalogPlaceExists })
    }

    if (pathname === '/api/health') {
      return await healthHttp(request)
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
