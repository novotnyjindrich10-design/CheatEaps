import { curatedPlaces } from '../data/curatedPlaces.js'
import { osmPlaces } from '../data/osmPlaces.js'
import {
  authorLabel,
  cheapEatsSummary,
  parseRestaurantId,
  publicName,
  reportReason,
  reviewBody,
  reviewRating,
  sortReviews,
} from '../utils/communityText.js'
import { authConfig, clientKey, resolveUser } from './supabaseAuth.js'
import { isPublishedPlaceId } from './publishedPlaceIds.js'

const restaurantIds = new Set()
for (const place of [...curatedPlaces, ...osmPlaces]) {
  if (place?.id) restaurantIds.add(place.id)
}

const WRITE_WINDOW_MS = 15 * 60 * 1000
const WRITE_MAX = 30
const writeAttempts = new Map()
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function restaurantExists(id) {
  return restaurantIds.has(id) || isPublishedPlaceId(id)
}

export function resetCommunityLimits() {
  writeAttempts.clear()
}

function allowWrite(request) {
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

function notConfigured() {
  return json(
    {
      ok: false,
      configured: false,
      authenticated: false,
      error: 'auth-not-configured',
      message: 'Přihlášení ještě není zapnuté. Chybí SUPABASE_URL nebo SUPABASE_ANON_KEY na serveru.',
    },
    503,
  )
}

const NOT_READY =
  'Oblíbené a recenze v databázi ještě nejsou. V SQL editoru spusť supabase/community.sql. Nejdřív musí být spuštěný supabase/auth-rls.sql.'

function fail(error, status, cookies = [], extra = {}) {
  const message = {
    'not-ready': NOT_READY,
    'auth-required': 'Nejdřív se přihlas.',
    'restaurant-unknown': 'Tahle restaurace v CheapEats není.',
    'review-exists': 'U téhle restaurace už recenzi máš. Můžeš ji upravit.',
    'review-missing': 'Tvoje recenze u téhle restaurace není.',
    'not-owner': 'Upravit a smazat jde jen vlastní recenzi.',
    'report-own': 'Vlastní recenzi nenahlašuj. Můžeš ji upravit nebo smazat.',
    'report-missing': 'Tahle recenze už není k nahlášení.',
    'report-duplicate': 'Tuhle recenzi už jsi nahlásil.',
    'nickname-invalid': 'Přezdívka má mít 2 až 32 znaků a nesmí být e-mail.',
    'rate-limited': 'Moc pokusů. Zkus to za chvíli.',
    failed: 'Požadavek se nepovedl.',
  }[error] || extra.message || 'Požadavek se nepovedl.'
  return json({ ok: false, error, message, ...extra }, status, cookies)
}

async function readBody(request) {
  const text = await request.text()
  if (text.length > 12_000) return { ok: false, message: 'Požadavek je moc velký.' }
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false, message: 'Požadavek nemá platné JSON.' }
  }
}

function knownRestaurant(id, exists) {
  const parsed = parseRestaurantId(id)
  if (!parsed.ok) return parsed
  if (!exists(parsed.id)) {
    return { ok: false, error: 'restaurant-unknown', message: 'Tahle restaurace v CheapEats není.' }
  }
  return parsed
}

function publicReview(review, viewerId) {
  return {
    id: review.id,
    authorId: review.userId,
    authorLabel: review.authorLabel,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt,
    mine: Boolean(viewerId) && review.userId === viewerId,
  }
}

function reviewPayload(reviews, restaurantId, viewerId) {
  const sorted = sortReviews(reviews)
  return {
    ok: true,
    configured: true,
    restaurantId,
    summary: cheapEatsSummary(sorted),
    reviews: sorted.map((review) => publicReview(review, viewerId)),
  }
}

export function createMemoryCommunity() {
  const favorites = []
  const reviews = []
  const reports = []
  const names = new Map()
  let sequence = 0

  const nextId = () => {
    sequence += 1
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`
  }

  return {
    async listFavorites(userId) {
      return {
        ok: true,
        favorites: favorites
          .filter((row) => row.userId === userId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .map((row) => ({ restaurantId: row.restaurantId, createdAt: row.createdAt })),
      }
    },
    async addFavorite(userId, restaurantId, createdAt) {
      const found = favorites.some((row) => row.userId === userId && row.restaurantId === restaurantId)
      if (!found) favorites.push({ userId, restaurantId, createdAt })
      return { ok: true, created: !found }
    },
    async removeFavorite(userId, restaurantId) {
      const before = favorites.length
      for (let index = favorites.length - 1; index >= 0; index -= 1) {
        const row = favorites[index]
        if (row.userId === userId && row.restaurantId === restaurantId) favorites.splice(index, 1)
      }
      return { ok: true, removed: favorites.length !== before }
    },
    async listReviews(restaurantId) {
      return { ok: true, reviews: reviews.filter((row) => row.restaurantId === restaurantId) }
    },
    async displayName(userId) {
      return names.get(userId) || ''
    },
    async saveDisplayName(userId, name) {
      names.set(userId, name)
      for (const review of reviews) {
        if (review.userId === userId) review.authorLabel = authorLabel(name, userId)
      }
      return { ok: true }
    },
    async createReview(review) {
      if (reviews.some((row) => row.userId === review.userId && row.restaurantId === review.restaurantId)) {
        return { ok: false, status: 409, error: 'review-exists' }
      }
      const stored = { ...review, id: nextId() }
      reviews.push(stored)
      return { ok: true, review: stored }
    },
    async updateReview(userId, restaurantId, patch) {
      const own = reviews.find((row) => row.userId === userId && row.restaurantId === restaurantId)
      const other = reviews.find((row) => row.restaurantId === restaurantId && row.userId !== userId)
      if (!own && other) return { ok: false, status: 403, error: 'not-owner' }
      if (!own) return { ok: false, status: 404, error: 'review-missing' }
      own.rating = patch.rating
      own.body = patch.body
      own.authorLabel = patch.authorLabel
      return { ok: true, review: own }
    },
    async deleteReview(userId, restaurantId) {
      const own = reviews.find((row) => row.userId === userId && row.restaurantId === restaurantId)
      const other = reviews.find((row) => row.restaurantId === restaurantId && row.userId !== userId)
      if (!own && other) return { ok: false, status: 403, error: 'not-owner' }
      if (!own) return { ok: false, status: 404, error: 'review-missing' }
      const index = reviews.indexOf(own)
      reviews.splice(index, 1)
      for (let reportIndex = reports.length - 1; reportIndex >= 0; reportIndex -= 1) {
        if (reports[reportIndex].reviewId === own.id) reports.splice(reportIndex, 1)
      }
      return { ok: true }
    },
    async reportReview({ reviewId, reporterId, reason }) {
      const review = reviews.find((row) => row.id === reviewId)
      if (!review) return { ok: false, status: 404, error: 'report-missing' }
      if (review.userId === reporterId) return { ok: false, status: 403, error: 'report-own' }
      if (reports.some((row) => row.reviewId === reviewId && row.reporterId === reporterId)) {
        return { ok: false, status: 409, error: 'report-duplicate' }
      }
      reports.push({ reviewId, reporterId, reason })
      return { ok: true }
    },
  }
}

function restProblem(body, status) {
  const record = Array.isArray(body) ? body[0] || {} : body || {}
  const blob = `${record.code || ''} ${record.message || ''}`.toLowerCase()
  if (blob.includes('23505') || blob.includes('duplicate')) return { ok: false, status: 409, error: 'duplicate' }
  if (blob.includes('pgrst205') || blob.includes('42p01') || blob.includes('does not exist') || blob.includes('schema cache')) {
    return { ok: false, status: 503, error: 'not-ready' }
  }
  if (status === 401 || blob.includes('jwt')) return { ok: false, status: 401, error: 'auth' }
  return { ok: false, status: status || 502, error: 'failed' }
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
  if (!response.ok) return restProblem(payload, response.status)
  return { ok: true, body: payload }
}

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    restaurantId: row.restaurant_id,
    rating: row.rating,
    body: row.body,
    authorLabel: row.author_label,
    createdAt: row.created_at,
  }
}

export function createSupabaseCommunity({ config, accessToken, fetchImpl }) {
  const authed = (path, options) => {
    if (!accessToken) return Promise.resolve({ ok: false, status: 401, error: 'auth' })
    return rest(config, accessToken, fetchImpl, path, options)
  }

  return {
    async listFavorites(userId) {
      const result = await authed(
        `favorites?user_id=eq.${encodeURIComponent(userId)}&select=restaurant_id,created_at&order=created_at.desc`,
      )
      if (!result.ok) return result
      return {
        ok: true,
        favorites: (result.body || []).map((row) => ({
          restaurantId: row.restaurant_id,
          createdAt: row.created_at,
        })),
      }
    },
    async addFavorite(userId, restaurantId, createdAt) {
      const result = await authed('favorites', {
        method: 'POST',
        prefer: 'return=minimal',
        body: { user_id: userId, restaurant_id: restaurantId, created_at: createdAt },
      })
      if (!result.ok && result.error === 'duplicate') return { ok: true, created: false }
      if (!result.ok) return result
      return { ok: true, created: true }
    },
    async removeFavorite(userId, restaurantId) {
      const result = await authed(
        `favorites?user_id=eq.${encodeURIComponent(userId)}&restaurant_id=eq.${encodeURIComponent(restaurantId)}`,
        { method: 'DELETE', prefer: 'return=representation' },
      )
      if (!result.ok) return result
      return { ok: true, removed: Array.isArray(result.body) ? result.body.length > 0 : true }
    },
    async listReviews(restaurantId) {
      const result = await rest(
        config,
        accessToken,
        fetchImpl,
        `reviews?restaurant_id=eq.${encodeURIComponent(restaurantId)}&select=id,user_id,restaurant_id,rating,body,author_label,created_at&order=created_at.desc`,
      )
      if (!result.ok) return result
      return { ok: true, reviews: (result.body || []).map(mapRow) }
    },
    async displayName(userId) {
      const result = await authed(`profiles?id=eq.${encodeURIComponent(userId)}&select=display_name`)
      if (!result.ok) return ''
      return result.body?.[0]?.display_name || ''
    },
    async saveDisplayName(userId, name) {
      const updated = await authed(`profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { display_name: name },
      })
      if (!updated.ok) return updated
      if (Array.isArray(updated.body) && updated.body.length > 0) return { ok: true }
      return authed('profiles', {
        method: 'POST',
        prefer: 'return=minimal',
        body: { id: userId, display_name: name },
      })
    },
    async createReview(review) {
      const existing = await this.listReviews(review.restaurantId)
      if (!existing.ok) return existing
      if (existing.reviews.some((row) => row.userId === review.userId)) {
        return { ok: false, status: 409, error: 'review-exists' }
      }
      const result = await authed('reviews', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          user_id: review.userId,
          restaurant_id: review.restaurantId,
          rating: review.rating,
          body: review.body,
          author_label: review.authorLabel,
        },
      })
      if (!result.ok && result.error === 'duplicate') return { ok: false, status: 409, error: 'review-exists' }
      if (!result.ok) return result
      const row = Array.isArray(result.body) ? result.body[0] : null
      return { ok: true, review: row ? mapRow(row) : review }
    },
    async updateReview(userId, restaurantId, patch) {
      const existing = await this.listReviews(restaurantId)
      if (!existing.ok) return existing
      const own = existing.reviews.find((row) => row.userId === userId)
      if (!own && existing.reviews.length > 0) return { ok: false, status: 403, error: 'not-owner' }
      if (!own) return { ok: false, status: 404, error: 'review-missing' }
      const result = await authed(`reviews?id=eq.${encodeURIComponent(own.id)}&user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        prefer: 'return=representation',
        body: { rating: patch.rating, body: patch.body, author_label: patch.authorLabel },
      })
      if (!result.ok) return result
      const row = Array.isArray(result.body) ? result.body[0] : null
      if (!row) return { ok: false, status: 403, error: 'not-owner' }
      return { ok: true, review: mapRow(row) }
    },
    async deleteReview(userId, restaurantId) {
      const existing = await this.listReviews(restaurantId)
      if (!existing.ok) return existing
      const own = existing.reviews.find((row) => row.userId === userId)
      if (!own && existing.reviews.length > 0) return { ok: false, status: 403, error: 'not-owner' }
      if (!own) return { ok: false, status: 404, error: 'review-missing' }
      const result = await authed(`reviews?id=eq.${encodeURIComponent(own.id)}&user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        prefer: 'return=representation',
      })
      if (!result.ok) return result
      if (Array.isArray(result.body) && result.body.length === 0) {
        return { ok: false, status: 403, error: 'not-owner' }
      }
      return { ok: true }
    },
    async reportReview({ reviewId, reporterId, reason }) {
      const found = await rest(
        config,
        accessToken,
        fetchImpl,
        `reviews?id=eq.${encodeURIComponent(reviewId)}&select=id,user_id`,
      )
      if (!found.ok) return found
      const review = found.body?.[0]
      if (!review) return { ok: false, status: 404, error: 'report-missing' }
      if (review.user_id === reporterId) return { ok: false, status: 403, error: 'report-own' }
      const result = await authed('review_reports', {
        method: 'POST',
        prefer: 'return=minimal',
        body: { review_id: reviewId, reporter_id: reporterId, reason },
      })
      if (!result.ok && result.error === 'duplicate') return { ok: false, status: 409, error: 'report-duplicate' }
      if (!result.ok) return result
      return { ok: true }
    },
  }
}

async function openContext(request, deps) {
  if ('user' in deps && deps.store) {
    return {
      user: deps.user,
      store: deps.store,
      cookies: [],
      exists: deps.restaurantExists ?? restaurantExists,
    }
  }
  const config = authConfig(deps.env ?? process.env)
  if (!config.configured) return { error: notConfigured() }
  const fetchImpl = deps.fetchImpl ?? fetch
  const resolved = await resolveUser(request, config, fetchImpl)
  return {
    user: resolved.user,
    store: createSupabaseCommunity({ config, accessToken: resolved.accessToken || '', fetchImpl }),
    cookies: resolved.cookies,
    exists: deps.restaurantExists ?? restaurantExists,
  }
}

function viewer(user) {
  if (!user?.id || !USER_ID.test(user.id)) return null
  return user
}

function requireUser(context) {
  const user = viewer(context.user)
  if (!user) return { error: fail('auth-required', 401, context.cookies) }
  return { user }
}

function storeFailure(result, cookies) {
  if (result.error === 'duplicate') return fail('failed', result.status || 409, cookies)
  if (result.error === 'not-ready') return fail('not-ready', 503, cookies)
  if (result.error === 'auth') return fail('auth-required', 401, cookies)
  if (result.error) return fail(result.error, result.status || 400, cookies)
  return fail('failed', result.status || 502, cookies)
}

async function favoritesHttp(request, url, deps) {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return json({ ok: false, message: 'Tahle adresa bere jen GET, POST nebo DELETE.' }, 405)
  }
  if (request.method !== 'GET' && !allowWrite(request)) return fail('rate-limited', 429)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireUser(context)
  if (required.error) return required.error
  const { user } = required

  if (request.method === 'GET') {
    const listed = await context.store.listFavorites(user.id)
    if (!listed.ok) return storeFailure(listed, context.cookies)
    return json(
      {
        ok: true,
        configured: true,
        authenticated: true,
        ids: listed.favorites.map((row) => row.restaurantId),
      },
      200,
      context.cookies,
    )
  }

  let restaurantValue = ''
  if (request.method === 'DELETE') {
    restaurantValue = url.searchParams.get('restaurantId')
  } else {
    const payload = await readBody(request)
    if (!payload.ok) return json({ ok: false, message: payload.message }, 400, context.cookies)
    restaurantValue = payload.value?.restaurantId
  }
  const restaurant = knownRestaurant(restaurantValue, context.exists)
  if (!restaurant.ok) return fail(restaurant.error, 404, context.cookies)

  const createdAt = (deps.now ? deps.now() : new Date()).toISOString()
  const changed = request.method === 'POST'
    ? await context.store.addFavorite(user.id, restaurant.id, createdAt)
    : await context.store.removeFavorite(user.id, restaurant.id)
  if (!changed.ok) return storeFailure(changed, context.cookies)
  const listed = await context.store.listFavorites(user.id)
  if (!listed.ok) return storeFailure(listed, context.cookies)
  return json(
    {
      ok: true,
      configured: true,
      authenticated: true,
      favorite: request.method === 'POST',
      ids: listed.favorites.map((row) => row.restaurantId),
    },
    200,
    context.cookies,
  )
}

async function nicknameFrom(request, user, store) {
  const payload = await readBody(request)
  if (!payload.ok) return { error: json({ ok: false, message: payload.message }, 400) }
  const rawName = payload.value?.displayName
  if (typeof rawName === 'string' && rawName.trim()) {
    const name = publicName(rawName)
    if (!name) return { error: fail('nickname-invalid', 400) }
    const saved = await store.saveDisplayName(user.id, name)
    if (!saved.ok) return { error: storeFailure(saved) }
  }
  const savedName = await store.displayName(user.id)
  const rating = reviewRating(payload.value?.rating)
  if (!rating.ok) return { error: fail(rating.error, 400, [], rating) }
  const body = reviewBody(payload.value?.body)
  if (!body.ok) return { error: fail(body.error, 400, [], body) }
  const restaurant = payload.value?.restaurantId
  return {
    payload,
    rating: rating.rating,
    body: body.text,
    restaurant,
    authorLabel: authorLabel(savedName, user.id),
  }
}

async function reviewsHttp(request, url, deps) {
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return json({ ok: false, message: 'Tahle adresa bere jen GET, POST, PUT nebo DELETE.' }, 405)
  }
  if (request.method !== 'GET' && !allowWrite(request)) return fail('rate-limited', 429)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const user = viewer(context.user)

  if (request.method === 'GET') {
    const restaurant = knownRestaurant(url.searchParams.get('restaurantId'), context.exists)
    if (!restaurant.ok) return fail(restaurant.error, 404, context.cookies)
    const listed = await context.store.listReviews(restaurant.id)
    if (!listed.ok) return storeFailure(listed, context.cookies)
    return json(reviewPayload(listed.reviews, restaurant.id, user?.id), 200, context.cookies)
  }

  if (!user) return fail('auth-required', 401, context.cookies)

  if (request.method === 'DELETE') {
    const restaurant = knownRestaurant(url.searchParams.get('restaurantId'), context.exists)
    if (!restaurant.ok) return fail(restaurant.error, 404, context.cookies)
    const removed = await context.store.deleteReview(user.id, restaurant.id)
    if (!removed.ok) return storeFailure(removed, context.cookies)
    const listed = await context.store.listReviews(restaurant.id)
    if (!listed.ok) return storeFailure(listed, context.cookies)
    return json(
      { ...reviewPayload(listed.reviews, restaurant.id, user.id), deleted: true, message: 'Recenze je smazaná.' },
      200,
      context.cookies,
    )
  }

  const draft = await nicknameFrom(request, user, context.store)
  if (draft.error) return draft.error
  const restaurant = knownRestaurant(draft.restaurant, context.exists)
  if (!restaurant.ok) return fail(restaurant.error, 404, context.cookies)
  const review = {
    userId: user.id,
    restaurantId: restaurant.id,
    rating: draft.rating,
    body: draft.body,
    authorLabel: draft.authorLabel,
    createdAt: (deps.now ? deps.now() : new Date()).toISOString(),
  }
  const saved = request.method === 'POST'
    ? await context.store.createReview(review)
    : await context.store.updateReview(user.id, restaurant.id, review)
  if (!saved.ok) return storeFailure(saved, context.cookies)
  const listed = await context.store.listReviews(restaurant.id)
  if (!listed.ok) return storeFailure(listed, context.cookies)
  return json(
    {
      ...reviewPayload(listed.reviews, restaurant.id, user.id),
      saved: true,
      message: 'Recenze je uložená.',
    },
    200,
    context.cookies,
  )
}

async function reportsHttp(request, deps) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Tahle adresa bere jen POST.' }, 405)
  if (!allowWrite(request)) return fail('rate-limited', 429)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireUser(context)
  if (required.error) return required.error
  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, context.cookies)
  const reason = reportReason(payload.value?.reason)
  if (!reason.ok) return fail(reason.error, 400, context.cookies, reason)
  const reviewId = String(payload.value?.reviewId ?? '')
  if (!USER_ID.test(reviewId)) return fail('report-missing', 404, context.cookies)
  const reported = await context.store.reportReview({
    reviewId,
    reporterId: required.user.id,
    reason: reason.text,
  })
  if (!reported.ok) return storeFailure(reported, context.cookies)
  return json(
    { ok: true, reported: true, message: 'Nahlášení je uložené. Uvidí ho jen tvůj účet a databáze.' },
    200,
    context.cookies,
  )
}

export async function communityHttp(request, deps = {}) {
  const url = new URL(request.url)
  if (url.pathname === '/api/favorites') return favoritesHttp(request, url, deps)
  if (url.pathname === '/api/reviews') return reviewsHttp(request, url, deps)
  if (url.pathname === '/api/review-reports') return reportsHttp(request, deps)
  return json({ ok: false, message: 'Neznámá adresa.' }, 404)
}
