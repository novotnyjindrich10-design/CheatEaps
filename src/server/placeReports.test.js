import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  PLACE_REPORTS_SQL,
  createMemoryPlaceReportStore,
  createSupabasePlaceReportStore,
  placeReportsHttp,
  resetPlaceReportLimits,
} from './placeReports.js'

function req(path, init = {}) {
  return new Request(`http://127.0.0.1${path}`, init)
}

const valid = {
  restaurantId: 'dhaba-beas-panska',
  reason: 'address',
  details: 'Špatné číslo popisné na štítku.',
  contact: null,
  website: '',
}

describe('placeReports SQL kontrakt', () => {
  it('zapíná RLS, omezuje důvody a dává RPC jen na insert', () => {
    assert.match(PLACE_REPORTS_SQL, /enable row level security/)
    assert.match(PLACE_REPORTS_SQL, /submit_place_report/)
    assert.match(PLACE_REPORTS_SQL, /is_cheapeats_admin/)
    assert.match(PLACE_REPORTS_SQL, /grant execute on function public\.submit_place_report/)
    assert.match(PLACE_REPORTS_SQL, /revoke all on table public\.place_reports from anon/)
    assert.doesNotMatch(PLACE_REPORTS_SQL, /create policy \w+[\s\S]*for insert[\s\S]*to anon/)
  })
})

describe('placeReports HTTP', () => {
  beforeEach(() => resetPlaceReportLimits())

  it('bez úložiště nepotvrdí úspěch', async () => {
    const response = await placeReportsHttp(
      req('/api/place-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(valid),
      }),
      { placeExists: () => true, store: null, env: {} },
    )
    assert.equal(response.status, 503)
    const body = await response.json()
    assert.equal(body.ok, false)
    assert.equal(body.stored, false)
  })

  it('s testovacím store uloží a admin načte, host ne', async () => {
    const store = createMemoryPlaceReportStore()
    const post = await placeReportsHttp(
      req('/api/place-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(valid),
      }),
      { placeExists: () => true, store },
    )
    assert.equal(post.status, 200)
    const saved = await post.json()
    assert.equal(saved.ok, true)
    assert.equal(saved.stored, true)

    const guestGet = await placeReportsHttp(req('/api/place-reports'), {
      store,
      isAdmin: async () => false,
    })
    assert.equal(guestGet.status, 403)

    const adminGet = await placeReportsHttp(req('/api/place-reports'), {
      store,
      isAdmin: async () => true,
    })
    assert.equal(adminGet.status, 200)
    const listed = await adminGet.json()
    assert.equal(listed.reports.length, 1)
    assert.equal(listed.reports[0].restaurantId, 'dhaba-beas-panska')
  })

  it('odmítne honeypot a neznámý podnik', async () => {
    const store = createMemoryPlaceReportStore()
    const honey = await placeReportsHttp(
      req('/api/place-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...valid, website: 'http://spam.test' }),
      }),
      { placeExists: () => true, store },
    )
    assert.equal(honey.status, 400)

    const missing = await placeReportsHttp(
      req('/api/place-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(valid),
      }),
      { placeExists: () => false, store },
    )
    assert.equal(missing.status, 404)
  })

  it('Supabase store při chybějící RPC hlásí not-ready', async () => {
    const store = createSupabasePlaceReportStore({
      config: { url: 'https://example.supabase.co', anonKey: 'anon' },
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: 'Could not find the function' }), { status: 404 }),
    })
    const result = await store.insert(valid)
    assert.equal(result.ok, false)
    assert.equal(result.error, 'not-ready')
  })
})
