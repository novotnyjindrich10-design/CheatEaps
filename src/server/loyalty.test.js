import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMemoryLoyalty, loyaltyHttp, REVIEW_REWARD_POINTS } from './loyalty.js'

const USER = '11111111-1111-4111-8111-111111111111'
const ADMIN = '33333333-3333-4333-8333-333333333333'
const REVIEW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const account = { id: USER, email: 'user@test.cz' }
const admin = { id: ADMIN, email: 'admin@test.cz' }

function call(path, { method = 'GET', user = null, body, store, admin: isAdmin = false } = {}) {
  return loyaltyHttp(
    new Request(`http://127.0.0.1${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    { user, store, admin: isAdmin },
  )
}

async function seedAvailableReward(store, { pointsCost = 20, codes = ['KOD-1'] } = {}) {
  const created = await store.upsertReward({
    slug: 'test-odmena',
    title: 'Test odměna',
    description: 'Popis',
    partnerName: 'Test Partner',
    pointsCost,
    status: 'available',
    terms: 'Jen test',
  })
  await store.addCodes(created.reward.id, codes)
  return created.reward
}

describe('věrnostní body a odměny', () => {
  it('připíše 5 bodů jen jednou za schválenou recenzi', async () => {
    const store = createMemoryLoyalty()
    store._setAdmin(ADMIN)
    store._seedReview({
      id: REVIEW,
      userId: USER,
      restaurantId: 'forkys-vankovka',
      moderationStatus: 'pending',
    })

    const first = await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: admin,
      store,
      admin: true,
      body: { reviewId: REVIEW, action: 'approve' },
    })
    const awarded = await first.json()
    assert.equal(first.status, 200)
    assert.equal(awarded.awarded, true)
    assert.equal(awarded.amount, REVIEW_REWARD_POINTS)

    const me = await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())
    assert.equal(me.points, 5)

    const again = await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: admin,
      store,
      admin: true,
      body: { reviewId: REVIEW, action: 'approve' },
    })
    const repeated = await again.json()
    assert.equal(repeated.awarded, false)
    assert.equal(repeated.already, true)
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 5)

    const history = await call('/api/loyalty/history', { user: account, store }).then((r) => r.json())
    assert.equal(history.transactions.length, 1)
    assert.equal(history.transactions[0].kind, 'review_reward')
    assert.equal(history.transactions[0].amount, 5)
  })

  it('neodečte body u Připravujeme a při nedostatku bodů nebo chybějícím kódu', async () => {
    const store = createMemoryLoyalty()
    store._seedReview({ id: REVIEW, userId: USER, restaurantId: 'x', moderationStatus: 'pending' })
    store._setAdmin(ADMIN)
    await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: admin,
      store,
      admin: true,
      body: { reviewId: REVIEW, action: 'approve' },
    })

    const soon = await store.upsertReward({
      slug: 'kfc-ukazka',
      title: 'Ukázka KFC',
      pointsCost: 20,
      status: 'coming_soon',
      description: 'Bez partnerství',
    })
    const blocked = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: soon.reward.id },
    })
    assert.equal(blocked.status, 409)
    assert.equal((await blocked.json()).error, 'coming-soon')
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 5)

    const reward = await seedAvailableReward(store, { pointsCost: 20, codes: ['REAL-1'] })
    const poor = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: reward.id },
    })
    assert.equal(poor.status, 409)
    assert.equal((await poor.json()).error, 'insufficient-points')
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 5)

    // Doplň body přes druhou recenzi a vyčerpej kódy
    const review2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    store._seedReview({ id: review2, userId: USER, restaurantId: 'y', moderationStatus: 'pending' })
    await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: admin,
      store,
      admin: true,
      body: { reviewId: review2, action: 'approve' },
    })
    // 10 bodů — pořád málo
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 10)

    for (let i = 0; i < 2; i += 1) {
      const id = `cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12, '0')}`
      store._seedReview({ id, userId: USER, restaurantId: `z${i}`, moderationStatus: 'pending' })
      // unique restaurant per review in real DB; memory loyalty doesn't care
      await call('/api/admin/reviews/moderate', {
        method: 'POST',
        user: admin,
        store,
        admin: true,
        body: { reviewId: id, action: 'approve' },
      })
    }
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 20)

    const emptyCodes = await store.upsertReward({
      slug: 'bez-kodu',
      title: 'Bez kódu',
      pointsCost: 5,
      status: 'available',
    })
    const noCode = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: emptyCodes.reward.id },
    })
    assert.equal(noCode.status, 409)
    assert.equal((await noCode.json()).error, 'code-unavailable')
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 20)
  })

  it('uplatní odměnu atomicky a odmítne dvojité uplatnění stejného kódu', async () => {
    const store = createMemoryLoyalty()
    store._setAdmin(ADMIN)
    for (let i = 0; i < 4; i += 1) {
      const id = `dddddddd-dddd-4ddd-8ddd-${String(i).padStart(12, '0')}`
      store._seedReview({ id, userId: USER, restaurantId: `r${i}`, moderationStatus: 'pending' })
      await call('/api/admin/reviews/moderate', {
        method: 'POST',
        user: admin,
        store,
        admin: true,
        body: { reviewId: id, action: 'approve' },
      })
    }
    const reward = await seedAvailableReward(store, { pointsCost: 20, codes: ['UNIQUE-ONLY'] })
    const ok = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: reward.id },
    })
    const body = await ok.json()
    assert.equal(ok.status, 200)
    assert.equal(body.code, 'UNIQUE-ONLY')
    assert.equal(body.points, 0)

    const again = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: reward.id },
    })
    assert.equal(again.status, 409)
    assert.equal((await again.json()).error, 'code-unavailable')
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 0)

    const mine = await call('/api/loyalty/redemptions', { user: account, store }).then((r) => r.json())
    assert.equal(mine.redemptions.length, 1)
    assert.equal(mine.redemptions[0].code, 'UNIQUE-ONLY')

    const history = await call('/api/loyalty/history', { user: account, store }).then((r) => r.json())
    assert.ok(history.transactions.some((row) => row.kind === 'redemption' && row.amount === -20))
  })

  it('uživatel nemůže měnit body ani schvalovat recenze', async () => {
    const store = createMemoryLoyalty()
    store._seedReview({ id: REVIEW, userId: USER, restaurantId: 'x', moderationStatus: 'pending' })
    const forbidden = await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: account,
      store,
      admin: false,
      body: { reviewId: REVIEW, action: 'approve' },
    })
    assert.equal(forbidden.status, 403)
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 0)

    const rewards = await call('/api/loyalty/rewards', { user: null, store }).then((r) => r.json())
    assert.equal(rewards.ok, true)
    assert.ok(Array.isArray(rewards.rewards))
  })

  it('admin schválí cizí recenzi a uživatel nemůže utratit body dvakrát ani bez kódu', async () => {
    const store = createMemoryLoyalty()
    store._setAdmin(ADMIN)
    store._seedReview({
      id: REVIEW,
      userId: USER,
      restaurantId: 'forkys-vankovka',
      moderationStatus: 'pending',
    })

    const selfApprove = await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: account,
      store,
      admin: false,
      body: { reviewId: REVIEW, action: 'approve' },
    })
    assert.equal(selfApprove.status, 403)

    const approved = await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: admin,
      store,
      admin: true,
      body: { reviewId: REVIEW, action: 'approve' },
    })
    assert.equal(approved.status, 200)
    assert.equal((await approved.json()).awarded, true)

    for (let i = 0; i < 3; i += 1) {
      const id = `eeeeeeee-eeee-4eee-8eee-${String(i).padStart(12, '0')}`
      store._seedReview({ id, userId: USER, restaurantId: `p${i}`, moderationStatus: 'pending' })
      await call('/api/admin/reviews/moderate', {
        method: 'POST',
        user: admin,
        store,
        admin: true,
        body: { reviewId: id, action: 'approve' },
      })
    }
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 20)

    const reward = await seedAvailableReward(store, { pointsCost: 20, codes: ['ONCE'] })
    const first = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: reward.id },
    })
    assert.equal(first.status, 200)
    assert.equal((await first.json()).code, 'ONCE')

    const second = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: reward.id },
    })
    assert.equal(second.status, 409)
    assert.equal((await second.json()).error, 'code-unavailable')
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, 0)

    const empty = await store.upsertReward({
      slug: 'empty-stock',
      title: 'Bez skladu',
      pointsCost: 5,
      status: 'available',
    })
    // Doplň body bez kódu u nové odměny
    const extra = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
    store._seedReview({ id: extra, userId: USER, restaurantId: 'extra', moderationStatus: 'pending' })
    await call('/api/admin/reviews/moderate', {
      method: 'POST',
      user: admin,
      store,
      admin: true,
      body: { reviewId: extra, action: 'approve' },
    })
    const before = (await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points
    const noCode = await call('/api/loyalty/redeem', {
      method: 'POST',
      user: account,
      store,
      body: { rewardId: empty.reward.id },
    })
    assert.equal(noCode.status, 409)
    assert.equal((await noCode.json()).error, 'code-unavailable')
    assert.equal((await call('/api/loyalty/me', { user: account, store }).then((r) => r.json())).points, before)
  })
})

