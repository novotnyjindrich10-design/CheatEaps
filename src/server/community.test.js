import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, it } from 'node:test'
import { loginPath } from '../utils/authReturn.js'
import { cheapEatsSummary, cleanText, authorLabel } from '../utils/communityText.js'
import { communityHttp, createMemoryCommunity, resetCommunityLimits } from './community.js'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const PLACE = 'forkys-vankovka'
const accountA = { id: USER_A, email: 'a@student.cz' }
const accountB = { id: USER_B, email: 'b@student.cz' }

function call(path, { method = 'GET', user = null, body, store, now } = {}) {
  return communityHttp(
    new Request(`http://127.0.0.1${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    { user, store, now },
  )
}

beforeEach(() => {
  resetCommunityLimits()
})

describe('text recenzí a průměr CheapEats', () => {
  it('odstraní HTML a skript a nenechá prázdnou značku', () => {
    assert.equal(cleanText('<script>alert(1)</script><img src=x onerror=alert(1)>Dobré jídlo'), 'Dobré jídlo')
    assert.equal(cleanText('<b>Ahoj</b>'), 'Ahoj')
    assert.equal(cleanText('   '), '')
  })

  it('přezdívka nesmí být e-mail a bez ní vznikne Host s kódem', () => {
    assert.equal(authorLabel('a@student.cz', USER_A), 'Host 111111')
    assert.equal(authorLabel('Alex', USER_A), 'Alex')
    assert.equal(authorLabel('Alex', USER_A).includes('@'), false)
  })

  it('bez recenzí nevrátí hvězdičky a Google hodnocení do průměru nepočítá', () => {
    const empty = cheapEatsSummary([])
    assert.equal(empty.count, 0)
    assert.equal(empty.average, null)
    assert.equal(empty.label, 'Zatím bez hodnocení')
    const mixed = cheapEatsSummary([
      { rating: 1, googleRating: 5 },
      { rating: 5, googleReviewCount: 80 },
    ])
    assert.equal(mixed.count, 2)
    assert.equal(mixed.average, 3)
    assert.notEqual(mixed.average, 5)
  })

  it('návrat po přihlášení míří na původní restauraci', () => {
    assert.equal(loginPath(`/restaurant/${PLACE}`), `/prihlaseni?next=${encodeURIComponent(`/restaurant/${PLACE}`)}`)
    assert.equal(loginPath('/oblibene', 'signup'), `/registrace?next=${encodeURIComponent('/oblibene')}`)
  })
})

describe('oblíbené restaurace', () => {
  it('nepřihlášený uživatel oblíbenou nepřidá', async () => {
    const store = createMemoryCommunity()
    let writes = 0
    const guarded = {
      ...store,
      addFavorite: async (...args) => {
        writes += 1
        return store.addFavorite(...args)
      },
    }
    const response = await call('/api/favorites', {
      method: 'POST',
      user: null,
      store: guarded,
      body: { restaurantId: PLACE },
    })
    const body = await response.json()
    assert.equal(response.status, 401)
    assert.equal(body.error, 'auth-required')
    assert.equal(writes, 0)
  })

  it('přidá a odebere restauraci a po dalším načtení ji stejný účet vidí', async () => {
    const store = createMemoryCommunity()
    const added = await call('/api/favorites', {
      method: 'POST',
      user: accountA,
      store,
      body: { restaurantId: PLACE, userId: USER_B },
    })
    const again = await call('/api/favorites', {
      method: 'POST',
      user: accountA,
      store,
      body: { restaurantId: PLACE },
    })
    const listed = await call('/api/favorites', { user: accountA, store })
    const other = await call('/api/favorites', { user: accountB, store })
    const removed = await call(`/api/favorites?restaurantId=${PLACE}`, {
      method: 'DELETE',
      user: accountA,
      store,
    })
    assert.equal((await added.json()).favorite, true)
    assert.deepEqual((await again.json()).ids, [PLACE])
    assert.deepEqual((await listed.json()).ids, [PLACE])
    assert.deepEqual((await other.json()).ids, [])
    const after = await removed.json()
    assert.equal(after.favorite, false)
    assert.deepEqual(after.ids, [])
  })

  it('neznámou restauraci neuloží a bez konfigurace úspěch nepředstírá', async () => {
    const store = createMemoryCommunity()
    const missing = await call('/api/favorites', {
      method: 'POST',
      user: accountA,
      store,
      body: { restaurantId: 'tohle-v-katalogu-neni' },
    })
    assert.equal(missing.status, 404)
    assert.deepEqual((await call('/api/favorites', { user: accountA, store }).then((response) => response.json())).ids, [])
    let called = false
    const offline = await communityHttp(new Request('http://127.0.0.1/api/favorites'), {
      env: {},
      fetchImpl: () => {
        called = true
        throw new Error('síť')
      },
    })
    const body = await offline.json()
    assert.equal(offline.status, 503)
    assert.equal(body.error, 'auth-not-configured')
    assert.equal(body.ok, false)
    assert.equal(called, false)
  })
})

describe('recenze', () => {
  it('vytvoří, upraví a smaže jen vlastní recenzi a druhou stejnému účtu odmítne', async () => {
    const store = createMemoryCommunity()
    let stamp = Date.parse('2026-10-30T10:00:00.000Z')
    const now = () => new Date(stamp)
    const created = await call('/api/reviews', {
      method: 'POST',
      user: accountA,
      store,
      now,
      body: {
        restaurantId: PLACE,
        rating: 5,
        body: '<script>alert(1)</script><img src=x onerror=alert(1)>Dobré jídlo',
        displayName: 'a@student.cz',
        userId: USER_B,
      },
    })
    assert.equal(created.status, 400)
    const saved = await call('/api/reviews', {
      method: 'POST',
      user: accountA,
      store,
      now,
      body: {
        restaurantId: PLACE,
        rating: 4,
        body: '<b>Dobré</b> jídlo',
        displayName: 'Alex',
        userId: USER_B,
        googleRating: 5,
      },
    })
    const first = await saved.json()
    assert.equal(saved.status, 200)
    assert.equal(first.saved, true)
    assert.equal(first.reviews[0].body, 'Dobré jídlo')
    assert.equal(first.reviews[0].authorLabel, 'Alex')
    assert.equal(first.reviews[0].authorId, USER_A)
    assert.equal(JSON.stringify(first).includes('a@student.cz'), false)
    assert.equal(JSON.stringify(first).includes('<'), false)
    stamp += 60_000
    const duplicate = await call('/api/reviews', {
      method: 'POST',
      user: accountA,
      store,
      now,
      body: { restaurantId: PLACE, rating: 1, body: 'Druhá recenze' },
    })
    assert.equal(duplicate.status, 409)
    const updated = await call('/api/reviews', {
      method: 'PUT',
      user: accountA,
      store,
      now,
      body: { restaurantId: PLACE, rating: 2, body: 'Upraveno' },
    })
    const edited = await updated.json()
    assert.equal(edited.reviews[0].body, 'Upraveno')
    assert.equal(edited.reviews[0].rating, 2)
    assert.equal(edited.summary.average, 2)
    const foreign = await call('/api/reviews', {
      method: 'PUT',
      user: accountB,
      store,
      now,
      body: { restaurantId: PLACE, rating: 1, body: 'Cizí úprava' },
    })
    assert.equal(foreign.status, 403)
    const foreignDelete = await call(`/api/reviews?restaurantId=${PLACE}`, {
      method: 'DELETE',
      user: accountB,
      store,
    })
    assert.equal(foreignDelete.status, 403)
    stamp += 60_000
    const other = await call('/api/reviews', {
      method: 'POST',
      user: accountB,
      store,
      now,
      body: { restaurantId: PLACE, rating: 4, body: 'Také dobré' },
    })
    const both = await other.json()
    assert.equal(both.summary.count, 2)
    assert.equal(both.summary.average, 3)
    assert.equal(both.reviews[0].body, 'Také dobré')
    assert.equal(both.reviews[1].authorId, USER_A)
    const removed = await call(`/api/reviews?restaurantId=${PLACE}`, {
      method: 'DELETE',
      user: accountA,
      store,
    })
    const left = await removed.json()
    assert.equal(left.deleted, true)
    assert.equal(left.reviews.length, 1)
    assert.equal(left.reviews[0].authorId, USER_B)
  })

  it('prázdný stav nemá průměr a nahlásit jde cizí recenzi jen jednou', async () => {
    const store = createMemoryCommunity()
    const empty = await call(`/api/reviews?restaurantId=${PLACE}`, { user: null, store })
    const blank = await empty.json()
    assert.equal(blank.summary.average, null)
    assert.equal(blank.summary.label, 'Zatím bez hodnocení')
    assert.equal(blank.reviews.length, 0)
    const saved = await call('/api/reviews', {
      method: 'POST',
      user: accountA,
      store,
      body: { restaurantId: PLACE, rating: 5, body: 'Jedna recenze' },
    })
    const reviewId = (await saved.json()).reviews[0].id
    const ownReport = await call('/api/review-reports', {
      method: 'POST',
      user: accountA,
      store,
      body: { reviewId, reason: 'vlastní' },
    })
    assert.equal(ownReport.status, 403)
    const guest = await call('/api/review-reports', {
      method: 'POST',
      user: null,
      store,
      body: { reviewId, reason: 'host' },
    })
    assert.equal(guest.status, 401)
    const reported = await call('/api/review-reports', {
      method: 'POST',
      user: accountB,
      store,
      body: { reviewId, reason: '<b>Nevhodné</b> oslovení' },
    })
    assert.equal((await reported.json()).reported, true)
    const repeat = await call('/api/review-reports', {
      method: 'POST',
      user: accountB,
      store,
      body: { reviewId, reason: 'znovu' },
    })
    assert.equal(repeat.status, 409)
  })

  it('zobrazení recenze neskládá HTML', () => {
    const source = readFileSync(new URL('../components/RestaurantReviews.jsx', import.meta.url), 'utf8')
    assert.equal(source.includes('dangerouslySetInnerHTML'), false)
    assert.equal(source.includes('Hodnocení na Google'), false)
    assert.match(source, /source="CheapEats"/)
  })
})

describe('SQL recenzí a oblíbených', () => {
  it('zapíná RLS, jeden záznam na dvojici a neukládá e-mail do recenze', () => {
    const sql = readFileSync(new URL('../../supabase/community.sql', import.meta.url), 'utf8')
    assert.match(sql, /alter table public\.favorites enable row level security/)
    assert.match(sql, /alter table public\.reviews enable row level security/)
    assert.match(sql, /alter table public\.review_reports enable row level security/)
    assert.match(sql, /primary key \(user_id, restaurant_id\)/)
    assert.match(sql, /constraint reviews_one_per_user unique \(user_id, restaurant_id\)/)
    assert.match(sql, /auth\.uid\(\) = user_id/)
    assert.match(sql, /grant select on table public\.reviews to anon, authenticated/)
    assert.doesNotMatch(sql, /email text/)
    assert.match(sql, /author_label/)
  })
})

describe('zápis do Supabase', () => {
  it('oblíbenou váže na účet z relace a recenze čte bez e-mailu', async () => {
    const env = { SUPABASE_URL: 'https://projekt.supabase.co', SUPABASE_ANON_KEY: 'anon-test-key' }
    let posted = null
    let listed = null
    const fetchImpl = (url, options) => {
      const href = String(url)
      if (href.endsWith('/auth/v1/user')) {
        return Response.json({ id: USER_A, email: 'a@student.cz' })
      }
      if (href.includes('/rest/v1/favorites') && options?.method === 'POST') {
        posted = {
          authorization: options.headers.get('authorization'),
          body: JSON.parse(options.body),
        }
        return Response.json({}, { status: 201 })
      }
      if (href.includes('/rest/v1/favorites')) {
        return Response.json([{ restaurant_id: PLACE, created_at: '2026-10-30T10:00:00.000Z' }])
      }
      if (href.includes('/rest/v1/reviews')) {
        listed = options.headers.get('authorization')
        assert.equal(href.includes('email'), false)
        return Response.json([])
      }
      return Response.json({}, { status: 404 })
    }
    const saved = await communityHttp(
      new Request('http://127.0.0.1/api/favorites', {
        method: 'POST',
        headers: { cookie: 'ce_access=access-token', 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId: PLACE, userId: USER_B }),
      }),
      { env, fetchImpl },
    )
    const body = await saved.json()
    assert.equal(saved.status, 200)
    assert.equal(posted.authorization, 'Bearer access-token')
    assert.equal(posted.body.user_id, USER_A)
    assert.deepEqual(body.ids, [PLACE])
    const reviews = await communityHttp(
      new Request(`http://127.0.0.1/api/reviews?restaurantId=${PLACE}`),
      { env, fetchImpl },
    )
    const listedBody = await reviews.json()
    assert.equal(reviews.status, 200)
    assert.equal(listed, 'Bearer anon-test-key')
    assert.equal(listedBody.summary.label, 'Zatím bez hodnocení')
    assert.equal(JSON.stringify(listedBody).includes('a@student.cz'), false)
  })
})
