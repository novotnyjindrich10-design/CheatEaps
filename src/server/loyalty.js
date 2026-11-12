/**
 * Věrnostní body a odměny. Zůstatek a uplatnění jen na serveru.
 * Uživatel nemůže měnit body přes API — jen číst a uplatnit odměnu.
 */
import { authConfig, resolveUser } from './supabaseAuth.js'

export const REVIEW_REWARD_POINTS = 5

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REWARD_ID = USER_ID
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/

function json(body, status = 200, cookies = []) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  for (const cookie of cookies) headers.append('set-cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

function notConfigured(cookies = []) {
  return json(
    {
      ok: false,
      configured: false,
      error: 'auth-not-configured',
      message: 'Přihlášení teď není k dispozici. Zkus to později.',
    },
    503,
    cookies,
  )
}

const MESSAGES = {
  'auth-required': 'Nejdřív se přihlas.',
  forbidden: 'Na tuhle akci nemáš oprávnění.',
  'insufficient-points': 'Nemáš dost bodů na tuhle odměnu.',
  'code-unavailable': 'Právě není volný slevový kód. Body jsme neodečetli.',
  'coming-soon': 'Tuhle odměnu ještě připravujeme. Body jsme neodečetli.',
  'reward-unavailable': 'Odměna není k dispozici.',
  'reward-missing': 'Odměna neexistuje.',
  'reward-expired': 'Platnost odměny už skončila.',
  'review-missing': 'Recenze neexistuje.',
  'review-rejected': 'Recenze je zamítnutá.',
  'not-ready': 'Věrnostní body teď nejsou zapnuté. Připravujeme je.',
  failed: 'Požadavek se nepovedl.',
}

function fail(error, status, cookies = [], extra = {}) {
  return json(
    { ok: false, error, message: MESSAGES[error] || extra.message || MESSAGES.failed, ...extra },
    status,
    cookies,
  )
}

async function readBody(request) {
  const text = await request.text()
  if (text.length > 40_000) return { ok: false, message: 'Požadavek je moc velký.' }
  try {
    return { ok: true, value: text ? JSON.parse(text) : {} }
  } catch {
    return { ok: false, message: 'Požadavek nemá platné JSON.' }
  }
}

function publicReward(row, { availableCodes = 0 } = {}) {
  const comingSoon = row.status === 'coming_soon' || (row.status === 'available' && availableCodes === 0)
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    partnerName: row.partnerName,
    pointsCost: row.pointsCost,
    status: comingSoon && row.status !== 'disabled' ? 'coming_soon' : row.status,
    label: comingSoon && row.status !== 'disabled' ? 'Připravujeme' : row.status === 'available' ? 'Dostupné' : 'Nedostupné',
    terms: row.terms,
    validUntil: row.validUntil,
    availableCodes: row.status === 'available' ? availableCodes : 0,
  }
}

function pointsToNext(balance, rewards) {
  const costs = rewards
    .filter((r) => r.status === 'available' || r.status === 'coming_soon')
    .map((r) => r.pointsCost)
    .filter((cost) => cost > balance)
    .sort((a, b) => a - b)
  if (costs.length === 0) return { nextCost: null, missing: 0 }
  return { nextCost: costs[0], missing: costs[0] - balance }
}

export function createMemoryLoyalty() {
  const balances = new Map()
  const transactions = []
  const rewards = []
  const codes = []
  const redemptions = []
  const reviews = new Map()
  const admins = new Set()
  let seq = 0
  const nextId = () => {
    seq += 1
    return `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`
  }

  return {
    async isAdmin(userId) {
      return admins.has(userId)
    },
    _setAdmin(userId) {
      admins.add(userId)
    },
    _seedReview(review) {
      reviews.set(review.id, { ...review })
    },
    async getBalance(userId) {
      return { ok: true, points: balances.get(userId) || 0 }
    },
    async listTransactions(userId) {
      return {
        ok: true,
        transactions: transactions
          .filter((row) => row.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }
    },
    async listRewards() {
      return {
        ok: true,
        rewards: rewards
          .filter((r) => r.status !== 'disabled')
          .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title))
          .map((row) => {
            const availableCodes = codes.filter((c) => c.rewardId === row.id && c.status === 'available').length
            return publicReward(row, { availableCodes })
          }),
      }
    },
    async listRedemptions(userId) {
      return {
        ok: true,
        redemptions: redemptions
          .filter((row) => row.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((row) => {
            const reward = rewards.find((r) => r.id === row.rewardId)
            return {
              id: row.id,
              rewardId: row.rewardId,
              title: reward?.title || 'Odměna',
              partnerName: reward?.partnerName || '',
              code: row.codeSnapshot,
              pointsSpent: row.pointsSpent,
              createdAt: row.createdAt,
            }
          }),
      }
    },
    async listPendingReviews() {
      return {
        ok: true,
        reviews: [...reviews.values()].filter((r) => r.moderationStatus === 'pending'),
      }
    },
    async approveReview(reviewId, adminId) {
      const review = reviews.get(reviewId)
      if (!review) return { ok: false, status: 404, error: 'review-missing' }
      if (review.moderationStatus === 'rejected') return { ok: false, status: 400, error: 'review-rejected' }
      review.moderationStatus = 'approved'
      review.moderatedAt = new Date().toISOString()
      review.moderatedBy = adminId

      const already = transactions.some(
        (t) =>
          t.userId === review.userId &&
          t.kind === 'review_reward' &&
          t.referenceType === 'review' &&
          t.referenceId === reviewId,
      )
      if (already) {
        return { ok: true, awarded: false, already: true, points: balances.get(review.userId) || 0, reviewId }
      }

      const points = (balances.get(review.userId) || 0) + REVIEW_REWARD_POINTS
      balances.set(review.userId, points)
      const tx = {
        id: nextId(),
        userId: review.userId,
        amount: REVIEW_REWARD_POINTS,
        kind: 'review_reward',
        referenceType: 'review',
        referenceId: reviewId,
        note: 'Body za schválenou recenzi',
        balanceAfter: points,
        createdAt: new Date().toISOString(),
      }
      transactions.push(tx)
      return { ok: true, awarded: true, amount: REVIEW_REWARD_POINTS, points, transactionId: tx.id, reviewId }
    },
    async rejectReview(reviewId, adminId) {
      const review = reviews.get(reviewId)
      if (!review || review.moderationStatus !== 'pending') {
        return { ok: false, status: 404, error: 'review-missing' }
      }
      review.moderationStatus = 'rejected'
      review.moderatedAt = new Date().toISOString()
      review.moderatedBy = adminId
      return { ok: true, rejected: true, reviewId }
    },
    async redeem(userId, rewardId) {
      const reward = rewards.find((r) => r.id === rewardId)
      if (!reward) return { ok: false, status: 404, error: 'reward-missing' }
      if (reward.status === 'coming_soon') return { ok: false, status: 409, error: 'coming-soon' }
      if (reward.status !== 'available') return { ok: false, status: 409, error: 'reward-unavailable' }
      if (reward.validUntil && new Date(reward.validUntil).getTime() < Date.now()) {
        return { ok: false, status: 409, error: 'reward-expired' }
      }

      const code = codes.find((c) => c.rewardId === rewardId && c.status === 'available')
      if (!code) return { ok: false, status: 409, error: 'code-unavailable' }

      const balance = balances.get(userId) || 0
      if (balance < reward.pointsCost) {
        return {
          ok: false,
          status: 409,
          error: 'insufficient-points',
          points: balance,
          needed: reward.pointsCost,
        }
      }

      // Atomicky v paměti: nejdřív rezervuj kód, pak body.
      code.status = 'redeemed'
      code.redeemedBy = userId
      code.redeemedAt = new Date().toISOString()

      const next = balance - reward.pointsCost
      balances.set(userId, next)
      const redemption = {
        id: nextId(),
        userId,
        rewardId,
        codeId: code.id,
        pointsSpent: reward.pointsCost,
        codeSnapshot: code.code,
        createdAt: new Date().toISOString(),
      }
      redemptions.push(redemption)
      code.redemptionId = redemption.id
      const tx = {
        id: nextId(),
        userId,
        amount: -reward.pointsCost,
        kind: 'redemption',
        referenceType: 'reward',
        referenceId: rewardId,
        note: `Uplatnění odměny: ${reward.title}`,
        balanceAfter: next,
        createdAt: new Date().toISOString(),
      }
      transactions.push(tx)
      return {
        ok: true,
        redemptionId: redemption.id,
        rewardId,
        code: code.code,
        pointsSpent: reward.pointsCost,
        points: next,
        transactionId: tx.id,
      }
    },
    async upsertReward(input) {
      const existing = rewards.find((r) => r.id === input.id || r.slug === input.slug)
      if (existing) {
        Object.assign(existing, {
          title: input.title,
          description: input.description,
          partnerName: input.partnerName,
          pointsCost: input.pointsCost,
          status: input.status,
          terms: input.terms,
          validUntil: input.validUntil,
          sortOrder: input.sortOrder ?? existing.sortOrder,
          updatedAt: new Date().toISOString(),
        })
        return { ok: true, reward: existing }
      }
      const row = {
        id: input.id || nextId(),
        slug: input.slug,
        title: input.title,
        description: input.description || '',
        partnerName: input.partnerName || '',
        pointsCost: input.pointsCost,
        status: input.status || 'coming_soon',
        terms: input.terms || '',
        validUntil: input.validUntil || null,
        sortOrder: input.sortOrder ?? 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      rewards.push(row)
      return { ok: true, reward: row }
    },
    async addCodes(rewardId, codeList) {
      const reward = rewards.find((r) => r.id === rewardId)
      if (!reward) return { ok: false, status: 404, error: 'reward-missing' }
      let added = 0
      for (const raw of codeList) {
        const code = String(raw || '').trim()
        if (code.length < 4 || code.length > 64) continue
        if (codes.some((c) => c.rewardId === rewardId && c.code === code)) continue
        codes.push({
          id: nextId(),
          rewardId,
          code,
          status: 'available',
          redeemedBy: null,
          redeemedAt: null,
          redemptionId: null,
          createdAt: new Date().toISOString(),
        })
        added += 1
      }
      if (added > 0 && reward.status === 'coming_soon') {
        // Admin musí explicitně nastavit available; kódy samotné status nemění.
      }
      return { ok: true, added }
    },
  }
}

function restProblem(body, status) {
  const record = Array.isArray(body) ? body[0] || {} : body || {}
  const blob = `${record.code || ''} ${record.message || ''} ${record.error || ''}`.toLowerCase()
  if (blob.includes('pgrst205') || blob.includes('42p01') || blob.includes('does not exist')) {
    return { ok: false, status: 503, error: 'not-ready' }
  }
  if (status === 401 || blob.includes('jwt')) return { ok: false, status: 401, error: 'auth' }
  return { ok: false, status: status || 502, error: 'failed', detail: record.message || '' }
}

async function rest(config, token, fetchImpl, path, { method = 'GET', body, prefer, headers: extra } = {}) {
  const headers = new Headers({
    apikey: config.anonKey,
    authorization: `Bearer ${token || config.anonKey}`,
    accept: 'application/json',
    ...(extra || {}),
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

async function rpc(config, token, fetchImpl, fn, args) {
  const headers = new Headers({
    apikey: config.anonKey,
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    accept: 'application/json',
  })
  const response = await fetchImpl(`${config.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) return restProblem(payload, response.status)
  return { ok: true, body: payload }
}

export function createSupabaseLoyalty({ config, accessToken, fetchImpl }) {
  const authed = (path, options) => {
    if (!accessToken) return Promise.resolve({ ok: false, status: 401, error: 'auth' })
    return rest(config, accessToken, fetchImpl, path, options)
  }

  return {
    async isAdmin(userId) {
      if (!accessToken || !userId) return false
      const result = await authed(`profiles?id=eq.${encodeURIComponent(userId)}&select=is_admin`)
      if (!result.ok) return false
      return Boolean(result.body?.[0]?.is_admin)
    },
    async getBalance(userId) {
      const result = await authed(`profiles?id=eq.${encodeURIComponent(userId)}&select=loyalty_points`)
      if (!result.ok) return result
      return { ok: true, points: Number(result.body?.[0]?.loyalty_points) || 0 }
    },
    async listTransactions(userId) {
      const result = await authed(
        `loyalty_transactions?user_id=eq.${encodeURIComponent(userId)}&select=id,amount,kind,reference_type,reference_id,note,balance_after,created_at&order=created_at.desc`,
      )
      if (!result.ok) return result
      return {
        ok: true,
        transactions: (result.body || []).map((row) => ({
          id: row.id,
          amount: row.amount,
          kind: row.kind,
          referenceType: row.reference_type,
          referenceId: row.reference_id,
          note: row.note,
          balanceAfter: row.balance_after,
          createdAt: row.created_at,
        })),
      }
    },
    async listRewards() {
      const result = await rest(
        config,
        accessToken,
        fetchImpl,
        'loyalty_rewards?status=in.(coming_soon,available)&select=id,slug,title,description,partner_name,points_cost,status,terms,valid_until,sort_order&order=sort_order.asc',
      )
      if (!result.ok) return result
      const rows = result.body || []
      const withCounts = []
      for (const row of rows) {
        let availableCodes = 0
        if (row.status === 'available' && accessToken) {
          const count = await authed(
            `loyalty_reward_codes?reward_id=eq.${encodeURIComponent(row.id)}&status=eq.available&select=id`,
            {},
          )
          // Bez přímého SELECT na kódy (RLS zakazuje) — počet jen přes admin, jinak 0.
          // Pro veřejnost: coming_soon pokud status coming_soon; available ukážeme jako available
          // a při redeem RPC ověří zásobu. Count přes admin RPC není nutný.
          if (count.ok) availableCodes = (count.body || []).length
        }
        withCounts.push(
          publicReward(
            {
              id: row.id,
              slug: row.slug,
              title: row.title,
              description: row.description,
              partnerName: row.partner_name,
              pointsCost: row.points_cost,
              status: row.status,
              terms: row.terms,
              validUntil: row.valid_until,
            },
            { availableCodes },
          ),
        )
      }
      // Bez přístupu ke kódům: available bez zjištěného počtu necháme available (redeem ověří).
      return {
        ok: true,
        rewards: withCounts.map((r) => {
          if (r.status === 'available' && r.availableCodes === 0) {
            return { ...r, label: 'Dostupné', availableCodes: 0 }
          }
          return r
        }),
      }
    },
    async listRedemptions(userId) {
      const result = await authed(
        `loyalty_redemptions?user_id=eq.${encodeURIComponent(userId)}&select=id,reward_id,points_spent,code_snapshot,created_at,loyalty_rewards(title,partner_name)&order=created_at.desc`,
      )
      if (!result.ok) return result
      return {
        ok: true,
        redemptions: (result.body || []).map((row) => ({
          id: row.id,
          rewardId: row.reward_id,
          title: row.loyalty_rewards?.title || 'Odměna',
          partnerName: row.loyalty_rewards?.partner_name || '',
          code: row.code_snapshot,
          pointsSpent: row.points_spent,
          createdAt: row.created_at,
        })),
      }
    },
    async listPendingReviews() {
      const result = await authed(
        `reviews?moderation_status=eq.pending&select=id,user_id,restaurant_id,rating,body,author_label,created_at&order=created_at.asc`,
      )
      if (!result.ok) return result
      return {
        ok: true,
        reviews: (result.body || []).map((row) => ({
          id: row.id,
          userId: row.user_id,
          restaurantId: row.restaurant_id,
          rating: row.rating,
          body: row.body,
          authorLabel: row.author_label,
          createdAt: row.created_at,
          moderationStatus: 'pending',
        })),
      }
    },
    async approveReview(reviewId) {
      const result = await rpc(config, accessToken, fetchImpl, 'loyalty_award_review_points', {
        p_review_id: reviewId,
      })
      if (!result.ok) return result
      const body = result.body || {}
      if (!body.ok) return { ok: false, status: 400, error: body.error || 'failed' }
      return body
    },
    async rejectReview(reviewId) {
      const result = await rpc(config, accessToken, fetchImpl, 'loyalty_reject_review', {
        p_review_id: reviewId,
      })
      if (!result.ok) return result
      const body = result.body || {}
      if (!body.ok) return { ok: false, status: 400, error: body.error || 'failed' }
      return body
    },
    async redeem(userId, rewardId) {
      const result = await rpc(config, accessToken, fetchImpl, 'loyalty_redeem_reward', {
        p_reward_id: rewardId,
      })
      if (!result.ok) return result
      const body = result.body || {}
      if (!body.ok) {
        const status = body.error === 'insufficient-points' || body.error === 'code-unavailable' ? 409 : 400
        return { ok: false, status, error: body.error || 'failed', points: body.points, needed: body.needed }
      }
      return body
    },
    async upsertReward(input) {
      const payload = {
        slug: input.slug,
        title: input.title,
        description: input.description || '',
        partner_name: input.partnerName || '',
        points_cost: input.pointsCost,
        status: input.status || 'coming_soon',
        terms: input.terms || '',
        valid_until: input.validUntil || null,
        sort_order: input.sortOrder ?? 100,
        updated_at: new Date().toISOString(),
      }
      if (input.id) {
        const updated = await authed(`loyalty_rewards?id=eq.${encodeURIComponent(input.id)}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: payload,
        })
        if (!updated.ok) return updated
        return { ok: true, reward: updated.body?.[0] || payload }
      }
      const created = await authed('loyalty_rewards', {
        method: 'POST',
        prefer: 'return=representation',
        body: payload,
      })
      if (!created.ok) return created
      return { ok: true, reward: created.body?.[0] || payload }
    },
    async addCodes(rewardId, codeList) {
      let added = 0
      for (const raw of codeList) {
        const code = String(raw || '').trim()
        if (code.length < 4 || code.length > 64) continue
        const result = await authed('loyalty_reward_codes', {
          method: 'POST',
          prefer: 'return=minimal',
          body: { reward_id: rewardId, code, status: 'available' },
        })
        if (result.ok) added += 1
      }
      return { ok: true, added }
    },
  }
}

async function openContext(request, deps) {
  if ('user' in deps && deps.store) {
    return { user: deps.user, store: deps.store, cookies: [], admin: Boolean(deps.admin) }
  }
  const config = authConfig(deps.env ?? process.env)
  if (!config.configured) return { error: notConfigured() }
  const fetchImpl = deps.fetchImpl ?? fetch
  const resolved = await resolveUser(request, config, fetchImpl)
  const store = createSupabaseLoyalty({ config, accessToken: resolved.accessToken || '', fetchImpl })
  const admin = resolved.user ? await store.isAdmin(resolved.user.id) : false
  return { user: resolved.user, store, cookies: resolved.cookies, admin }
}

function requireUser(context) {
  if (!context.user?.id || !USER_ID.test(context.user.id)) {
    return { error: fail('auth-required', 401, context.cookies) }
  }
  return { user: context.user }
}

function requireAdmin(context) {
  const user = requireUser(context)
  if (user.error) return user
  if (!context.admin) return { error: fail('forbidden', 403, context.cookies) }
  return user
}

function storeFail(result, cookies) {
  if (!result?.error) return fail('failed', 502, cookies)
  if (result.error === 'not-ready') return fail('not-ready', 503, cookies)
  if (result.error === 'auth') return fail('auth-required', 401, cookies)
  return fail(result.error, result.status || 400, cookies, {
    points: result.points,
    needed: result.needed,
  })
}

async function meHttp(request, deps) {
  if (request.method !== 'GET') return json({ ok: false, message: 'Tahle adresa bere jen GET.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireUser(context)
  if (required.error) return required.error
  const balance = await context.store.getBalance(required.user.id)
  if (!balance.ok) return storeFail(balance, context.cookies)
  const rewards = await context.store.listRewards()
  if (!rewards.ok) return storeFail(rewards, context.cookies)
  const progress = pointsToNext(balance.points, rewards.rewards)
  return json(
    {
      ok: true,
      points: balance.points,
      reviewRewardPoints: REVIEW_REWARD_POINTS,
      nextRewardCost: progress.nextCost,
      pointsMissing: progress.missing,
    },
    200,
    context.cookies,
  )
}

async function historyHttp(request, deps) {
  if (request.method !== 'GET') return json({ ok: false, message: 'Tahle adresa bere jen GET.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireUser(context)
  if (required.error) return required.error
  const listed = await context.store.listTransactions(required.user.id)
  if (!listed.ok) return storeFail(listed, context.cookies)
  return json({ ok: true, transactions: listed.transactions }, 200, context.cookies)
}

async function rewardsHttp(request, deps) {
  if (request.method !== 'GET') return json({ ok: false, message: 'Tahle adresa bere jen GET.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) {
    // Veřejný katalog odměn i bez přihlášení — když chybí config, 503.
    return context.error
  }
  const listed = await context.store.listRewards()
  if (!listed.ok) return storeFail(listed, context.cookies)
  let points = null
  let progress = { nextCost: null, missing: 0 }
  if (context.user?.id) {
    const balance = await context.store.getBalance(context.user.id)
    if (balance.ok) {
      points = balance.points
      progress = pointsToNext(balance.points, listed.rewards)
    }
  }
  return json(
    {
      ok: true,
      rewards: listed.rewards,
      points,
      nextRewardCost: progress.nextCost,
      pointsMissing: progress.missing,
      reviewRewardPoints: REVIEW_REWARD_POINTS,
    },
    200,
    context.cookies,
  )
}

async function redemptionsHttp(request, deps) {
  if (request.method !== 'GET') return json({ ok: false, message: 'Tahle adresa bere jen GET.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireUser(context)
  if (required.error) return required.error
  const listed = await context.store.listRedemptions(required.user.id)
  if (!listed.ok) return storeFail(listed, context.cookies)
  return json({ ok: true, redemptions: listed.redemptions }, 200, context.cookies)
}

async function redeemHttp(request, deps) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Tahle adresa bere jen POST.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireUser(context)
  if (required.error) return required.error
  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, context.cookies)
  const rewardId = String(payload.value?.rewardId || '')
  if (!REWARD_ID.test(rewardId)) return fail('reward-missing', 404, context.cookies)
  const result = await context.store.redeem(required.user.id, rewardId)
  if (!result.ok) return storeFail(result, context.cookies)
  return json(
    {
      ok: true,
      redemptionId: result.redemptionId,
      rewardId: result.rewardId,
      code: result.code,
      pointsSpent: result.pointsSpent,
      points: result.points,
      message: 'Odměna je uplatněná. Kód si ulož.',
    },
    200,
    context.cookies,
  )
}

async function adminModerateHttp(request, deps) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Tahle adresa bere jen POST.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireAdmin(context)
  if (required.error) return required.error
  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, context.cookies)
  const reviewId = String(payload.value?.reviewId || '')
  const action = String(payload.value?.action || '')
  if (!USER_ID.test(reviewId)) return fail('review-missing', 404, context.cookies)
  if (action === 'approve') {
    const result = await context.store.approveReview(reviewId, required.user.id)
    if (!result.ok) return storeFail(result, context.cookies)
    return json({ ok: true, ...result, message: result.awarded ? 'Recenze schválena, body připsány.' : 'Recenze už byla schválená.' }, 200, context.cookies)
  }
  if (action === 'reject') {
    const result = await context.store.rejectReview(reviewId, required.user.id)
    if (!result.ok) return storeFail(result, context.cookies)
    return json({ ok: true, ...result, message: 'Recenze je zamítnutá.' }, 200, context.cookies)
  }
  return json({ ok: false, message: 'Neznámá akce.' }, 400, context.cookies)
}

async function adminPendingHttp(request, deps) {
  if (request.method !== 'GET') return json({ ok: false, message: 'Tahle adresa bere jen GET.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireAdmin(context)
  if (required.error) return required.error
  const listed = await context.store.listPendingReviews()
  if (!listed.ok) return storeFail(listed, context.cookies)
  return json({ ok: true, reviews: listed.reviews }, 200, context.cookies)
}

async function adminRewardsHttp(request, deps) {
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireAdmin(context)
  if (required.error) return required.error

  if (request.method === 'GET') {
    const listed = await context.store.listRewards()
    if (!listed.ok) return storeFail(listed, context.cookies)
    return json({ ok: true, rewards: listed.rewards }, 200, context.cookies)
  }

  if (request.method !== 'POST') return json({ ok: false, message: 'Tahle adresa bere GET nebo POST.' }, 405)
  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, context.cookies)
  const slug = String(payload.value?.slug || '').trim()
  const title = String(payload.value?.title || '').trim()
  const pointsCost = Number(payload.value?.pointsCost)
  const status = String(payload.value?.status || 'coming_soon')
  if (!SLUG.test(slug) || title.length < 2 || !Number.isInteger(pointsCost) || pointsCost < 1) {
    return json({ ok: false, message: 'Neplatné údaje odměny.' }, 400, context.cookies)
  }
  if (!['coming_soon', 'available', 'disabled'].includes(status)) {
    return json({ ok: false, message: 'Neplatný stav odměny.' }, 400, context.cookies)
  }
  const result = await context.store.upsertReward({
    id: payload.value?.id || undefined,
    slug,
    title,
    description: String(payload.value?.description || ''),
    partnerName: String(payload.value?.partnerName || ''),
    pointsCost,
    status,
    terms: String(payload.value?.terms || ''),
    validUntil: payload.value?.validUntil || null,
    sortOrder: Number(payload.value?.sortOrder) || 100,
  })
  if (!result.ok) return storeFail(result, context.cookies)
  return json({ ok: true, reward: result.reward }, 200, context.cookies)
}

async function adminCodesHttp(request, deps) {
  if (request.method !== 'POST') return json({ ok: false, message: 'Tahle adresa bere jen POST.' }, 405)
  const context = await openContext(request, deps)
  if (context.error) return context.error
  const required = requireAdmin(context)
  if (required.error) return required.error
  const payload = await readBody(request)
  if (!payload.ok) return json({ ok: false, message: payload.message }, 400, context.cookies)
  const rewardId = String(payload.value?.rewardId || '')
  if (!REWARD_ID.test(rewardId)) return fail('reward-missing', 404, context.cookies)
  const codes = Array.isArray(payload.value?.codes) ? payload.value.codes : []
  if (codes.length === 0 || codes.length > 500) {
    return json({ ok: false, message: 'Pošli 1 až 500 unikátních kódů.' }, 400, context.cookies)
  }
  const result = await context.store.addCodes(rewardId, codes)
  if (!result.ok) return storeFail(result, context.cookies)
  return json({ ok: true, added: result.added, message: `Přidané kódy: ${result.added}.` }, 200, context.cookies)
}

export async function loyaltyHttp(request, deps = {}) {
  const pathname = new URL(request.url).pathname
  if (pathname === '/api/loyalty/me') return meHttp(request, deps)
  if (pathname === '/api/loyalty/history') return historyHttp(request, deps)
  if (pathname === '/api/loyalty/rewards') return rewardsHttp(request, deps)
  if (pathname === '/api/loyalty/redemptions') return redemptionsHttp(request, deps)
  if (pathname === '/api/loyalty/redeem') return redeemHttp(request, deps)
  if (pathname === '/api/admin/reviews/pending') return adminPendingHttp(request, deps)
  if (pathname === '/api/admin/reviews/moderate') return adminModerateHttp(request, deps)
  if (pathname === '/api/admin/loyalty/rewards') return adminRewardsHttp(request, deps)
  if (pathname === '/api/admin/loyalty/rewards/codes') return adminCodesHttp(request, deps)
  return json({ ok: false, message: 'Neznámá adresa.' }, 404)
}
