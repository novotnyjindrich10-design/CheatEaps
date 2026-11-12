import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  PLACE_STATS_SQL,
  createMemoryPlaceStatsStore,
  createSupabasePlaceStatsStore,
  placeStatsHttp,
  resetPlaceStatLimits,
} from './placeStats.js'

function req(path, init = {}) {
  return new Request(`http://127.0.0.1${path}`, init)
}

describe('placeStats SQL kontrakt', () => {
  it('agreguje denně, RLS jen pro admina a RPC přijímá directions_click', () => {
    assert.match(PLACE_STATS_SQL, /place_stats_daily/)
    assert.match(PLACE_STATS_SQL, /enable row level security/)
    assert.match(PLACE_STATS_SQL, /record_place_stat/)
    assert.match(PLACE_STATS_SQL, /directions_click/)
    assert.match(PLACE_STATS_SQL, /is_cheapeats_admin/)
    assert.match(PLACE_STATS_SQL, /revoke all on table public\.place_stats_daily from anon/)
  })
})

describe('placeStats HTTP', () => {
  beforeEach(() => resetPlaceStatLimits())

  it('bez úložiště nepotvrdí zápis', async () => {
    const response = await placeStatsHttp(
      req('/api/place-stats/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId: 'dhaba-beas-panska', event: 'profile_view' }),
      }),
      { placeExists: () => true, store: null, env: {} },
    )
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.stored, false)
  })

  it('Supabase store potvrdí jen trvalý zápis; legacy route_click mapuje na directions', async () => {
    const calls = []
    const store = createSupabasePlaceStatsStore({
      config: { url: 'https://example.supabase.co', anonKey: 'anon' },
      fetchImpl: async (_url, init) => {
        calls.push(JSON.parse(init.body))
        return new Response('true', { status: 200 })
      },
    })
    const response = await placeStatsHttp(
      req('/api/place-stats/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId: 'dhaba-beas-panska', event: 'route_click' }),
      }),
      { placeExists: () => true, store },
    )
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(body.persistent, true)
    assert.equal(calls[0].p_event, 'directions_click')
  })

  it('GET bez admina je 403; admin dostane agregaci z memory helperu přes store.get', async () => {
    const memory = createMemoryPlaceStatsStore()
    await memory.record('dhaba-beas-panska', 'profile_view')
    const wrapped = {
      kind: 'supabase',
      persistent: true,
      record: memory.record.bind(memory),
      async get(id) {
        const stats = await memory.get(id)
        return { ok: true, stats }
      },
    }
    const denied = await placeStatsHttp(req('/api/place-stats?restaurantId=dhaba-beas-panska'), {
      store: wrapped,
      isAdmin: async () => false,
    })
    assert.equal(denied.status, 403)

    const allowed = await placeStatsHttp(req('/api/place-stats?restaurantId=dhaba-beas-panska'), {
      store: wrapped,
      isAdmin: async () => true,
    })
    assert.equal(allowed.status, 200)
    const body = await allowed.json()
    assert.equal(body.stats.profileViews, 1)
  })

  it('odmítne neplatný event a neznámý podnik', async () => {
    const store = createSupabasePlaceStatsStore({
      config: { url: 'https://example.supabase.co', anonKey: 'anon' },
      fetchImpl: async () => new Response('true', { status: 200 }),
    })
    const bad = await placeStatsHttp(
      req('/api/place-stats/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId: 'dhaba-beas-panska', event: 'hack' }),
      }),
      { placeExists: () => true, store },
    )
    assert.equal(bad.status, 400)

    const missing = await placeStatsHttp(
      req('/api/place-stats/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ restaurantId: 'nope', event: 'profile_view' }),
      }),
      { placeExists: () => false, store },
    )
    assert.equal(missing.status, 404)
  })
})
