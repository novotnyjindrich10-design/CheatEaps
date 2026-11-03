import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  adminMeHttp,
  adminReviewApplicationHttp,
  createMemoryBusinessStore,
  listPublishedPlacesHttp,
  resetBusinessLimits,
  submitBusinessApplicationHttp,
} from './businessApplications.js'
import { buildApprovalEmail, sendBusinessApprovalEmail } from './businessMail.js'
import { resetPublishedPlaceIds, isPublishedPlaceId } from './publishedPlaceIds.js'

const sample = {
  planId: 'start',
  businessName: 'KFC Svoboďák 45',
  address: 'náměstí Svobody 45, Brno',
  locality: 'Brno',
  category: 'fastfood',
  cuisineFocus: 'Fast food / Street food',
  description:
    'Fast food s kuřecími produkty na náměstí Svobody. Ideální rychlé občerstvení v centru Brna.',
  descriptionOriginal:
    'Fast food s kuřecími produkty na náměstí Svobody. Ideální rychlé občerstvení v centru Brna.',
  ownerEmail: 'majitel@example.cz',
  website: '',
  keepDescriptionExact: true,
  existenceStatus: 'unavailable',
  existenceSummary: 'Kontrola existence zatím neproběhla.',
  existenceRequiresManual: true,
  existenceCandidates: [],
}

function req(url, { method = 'GET', body, headers = {} } = {}) {
  return new Request(url, {
    method,
    headers: body ? { 'content-type': 'application/json', ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('API žádostí o podnik', () => {
  it('uloží pending žádost a nezveřejní podnik automaticky', async () => {
    resetBusinessLimits()
    resetPublishedPlaceIds()
    const store = createMemoryBusinessStore()
    const response = await submitBusinessApplicationHttp(
      req('http://127.0.0.1/api/business-applications', { method: 'POST', body: sample }),
      { store, skipRateLimit: true },
    )
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.status, 'pending')
    const published = await listPublishedPlacesHttp(req('http://127.0.0.1/api/published-places'), { store })
    const listed = await published.json()
    assert.equal(listed.places.length, 0)
  })

  it('odmítne neoprávněné schválení', async () => {
    resetBusinessLimits()
    const store = createMemoryBusinessStore()
    const created = await submitBusinessApplicationHttp(
      req('http://127.0.0.1/api/business-applications', { method: 'POST', body: sample }),
      { store, skipRateLimit: true },
    )
    const createdBody = await created.json()
    const response = await adminReviewApplicationHttp(
      req('http://127.0.0.1/api/admin/business-applications/review', {
        method: 'POST',
        body: { id: createdBody.id, action: 'approve' },
      }),
      { store, user: { id: 'user-1', email: 'user@example.cz' }, accessToken: 't' },
    )
    assert.equal(response.status, 403)
  })

  it('admin schválí, vytvoří podnik bez duplicity a připraví e-mail', async () => {
    resetBusinessLimits()
    resetPublishedPlaceIds()
    const store = createMemoryBusinessStore()
    store.grantAdmin('admin-1')
    const created = await submitBusinessApplicationHttp(
      req('http://127.0.0.1/api/business-applications', { method: 'POST', body: sample }),
      { store, skipRateLimit: true },
    )
    const createdBody = await created.json()

    const fetches = []
    const fetchImpl = async (url, init) => {
      fetches.push({ url, init })
      return new Response(JSON.stringify({ id: 'mail-1' }), { status: 200 })
    }

    const approved = await adminReviewApplicationHttp(
      req('http://127.0.0.1/api/admin/business-applications/review', {
        method: 'POST',
        body: { id: createdBody.id, action: 'approve' },
        headers: { host: 'localhost:5173' },
      }),
      {
        store,
        user: { id: 'admin-1', email: 'admin@example.cz' },
        accessToken: 't',
        env: {
          RESEND_API_KEY: 're_test',
          EMAIL_FROM: 'CheapEats <onboarding@resend.dev>',
          PUBLIC_SITE_URL: 'http://localhost:5173',
        },
        fetchImpl,
      },
    )
    const approvedBody = await approved.json()
    assert.equal(approved.status, 200)
    assert.equal(approvedBody.ok, true)
    assert.equal(approvedBody.emailStatus, 'sent')
    assert.ok(approvedBody.placeId)
    assert.equal(isPublishedPlaceId(approvedBody.placeId), true)
    assert.equal(fetches.length, 1)
    const mailPayload = JSON.parse(fetches[0].init.body)
    assert.equal(mailPayload.subject, 'Váš podnik je nyní na CheapEats!')
    assert.match(mailPayload.text, /zveřejněný na CheapEats/i)
    assert.match(mailPayload.text, /restaurant\//)
    assert.match(mailPayload.text, /novotnyjindrich10@gmail\.com/)

    const again = await adminReviewApplicationHttp(
      req('http://127.0.0.1/api/admin/business-applications/review', {
        method: 'POST',
        body: { id: createdBody.id, action: 'approve' },
        headers: { host: 'localhost:5173' },
      }),
      {
        store,
        user: { id: 'admin-1', email: 'admin@example.cz' },
        accessToken: 't',
        env: { RESEND_API_KEY: 're_test', EMAIL_FROM: 'a@b.cz' },
        fetchImpl,
      },
    )
    const againBody = await again.json()
    assert.equal(againBody.createdPlace, false)

    const published = await listPublishedPlacesHttp(req('http://127.0.0.1/api/published-places'), { store })
    const listed = await published.json()
    assert.equal(listed.places.length, 1)
    assert.equal(listed.places[0].id, approvedBody.placeId)
  })

  it('neoznačí e-mail za odeslaný, když Resend není nastavený', async () => {
    const letter = buildApprovalEmail({
      businessName: 'Test',
      ownerEmail: 'a@b.cz',
      placeUrl: 'http://localhost/restaurant/test',
    })
    assert.equal(letter.subject, 'Váš podnik je nyní na CheapEats!')
    const result = await sendBusinessApprovalEmail(
      { businessName: 'Test', ownerEmail: 'a@b.cz', placeUrl: 'http://x/restaurant/test' },
      {},
    )
    assert.equal(result.ok, false)
    assert.equal(result.status, 'skipped')
  })

  it('validace odmítne nesmyslný název', async () => {
    resetBusinessLimits()
    const store = createMemoryBusinessStore()
    const response = await submitBusinessApplicationHttp(
      req('http://127.0.0.1/api/business-applications', {
        method: 'POST',
        body: { ...sample, businessName: 'asdf', description: 'Krátký.' },
      }),
      { store, skipRateLimit: true },
    )
    assert.equal(response.status, 400)
  })
})

const sessionEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test-key',
}

function sessionFetch() {
  const calls = []
  const fetchImpl = async (url, init) => {
    const href = String(url)
    const headers = init?.headers
    const authorization =
      headers && typeof headers.get === 'function'
        ? headers.get('authorization') || ''
        : headers?.authorization || headers?.Authorization || ''
    calls.push({ href, authorization: String(authorization) })
    if (!href.startsWith('https://example.supabase.co/')) {
      return new Response(JSON.stringify({ message: 'cizí host' }), { status: 500 })
    }
    if (href.includes('/auth/v1/user')) {
      if (authorization.includes('admin-access')) {
        return new Response(
          JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.cz' }),
          { status: 200 },
        )
      }
      if (authorization.includes('user-access')) {
        return new Response(
          JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', email: 'user@example.cz' }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ message: 'bad token' }), { status: 401 })
    }
    if (href.includes('/rest/v1/profiles')) {
      const admin = href.includes('11111111-1111-4111-8111-111111111111')
      return new Response(JSON.stringify([{ is_admin: admin }]), { status: 200 })
    }
    if (href.includes('/rest/v1/published_places')) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    return new Response(JSON.stringify({ message: 'neočekávaná adresa' }), { status: 500 })
  }
  return { fetchImpl, calls }
}

describe('session u zveřejněných podniků a administrace', () => {
  it('bez přihlášení vrátí katalog a neoznačí nikoho za administrátora', async () => {
    const { fetchImpl, calls } = sessionFetch()
    const published = await listPublishedPlacesHttp(req('http://127.0.0.1/api/published-places'), {
      env: sessionEnv,
      fetchImpl,
    })
    const publishedBody = await published.json()
    assert.equal(published.status, 200)
    assert.equal(publishedBody.ok, true)
    assert.deepEqual(publishedBody.places, [])
    assert.equal(calls.length, 1)
    assert.match(calls[0].href, /^https:\/\/example\.supabase\.co\/rest\/v1\/published_places/)
    assert.match(calls[0].authorization, /anon-test-key/)

    const me = await adminMeHttp(req('http://127.0.0.1/api/admin/me'), { env: sessionEnv, fetchImpl })
    const meBody = await me.json()
    assert.equal(me.status, 200)
    assert.equal(meBody.authenticated, false)
    assert.equal(meBody.admin, false)
    assert.equal(calls.length, 1)
  })

  it('přihlášený uživatel načte katalog a není administrátor', async () => {
    const { fetchImpl, calls } = sessionFetch()
    const headers = { cookie: 'ce_access=user-access' }
    const published = await listPublishedPlacesHttp(req('http://127.0.0.1/api/published-places', { headers }), {
      env: sessionEnv,
      fetchImpl,
    })
    const publishedBody = await published.json()
    assert.equal(published.status, 200)
    assert.equal(publishedBody.ok, true)
    assert.equal(calls[0].href, 'https://example.supabase.co/auth/v1/user')
    assert.match(calls[0].authorization, /user-access/)

    const me = await adminMeHttp(req('http://127.0.0.1/api/admin/me', { headers }), {
      env: sessionEnv,
      fetchImpl,
    })
    const meBody = await me.json()
    assert.equal(me.status, 200)
    assert.equal(meBody.authenticated, true)
    assert.equal(meBody.admin, false)
    assert.equal(meBody.email, 'user@example.cz')
    assert.ok(calls.some((call) => call.href.includes('/rest/v1/profiles') && call.href.includes('22222222-2222-4222-8222-222222222222')))
    assert.equal(calls.some((call) => call.authorization.includes('admin-access')), false)
  })

  it('přihlášený administrátor dostane příznak z profilu, ne z těla požadavku', async () => {
    const { fetchImpl, calls } = sessionFetch()
    const headers = { cookie: 'ce_access=admin-access' }
    const me = await adminMeHttp(req('http://127.0.0.1/api/admin/me', { headers }), {
      env: sessionEnv,
      fetchImpl,
    })
    const meBody = await me.json()
    assert.equal(me.status, 200)
    assert.equal(meBody.authenticated, true)
    assert.equal(meBody.admin, true)
    assert.ok(calls.some((call) => call.href.includes('11111111-1111-4111-8111-111111111111')))
    assert.equal(
      calls.every((call) => call.href.startsWith('https://example.supabase.co/')),
      true,
    )
  })

  it('neplatná session neshodí katalog a administrátora z ní neudělá', async () => {
    const { fetchImpl } = sessionFetch()
    const headers = { cookie: 'ce_access=stolen' }
    const published = await listPublishedPlacesHttp(req('http://127.0.0.1/api/published-places', { headers }), {
      env: sessionEnv,
      fetchImpl,
    })
    assert.equal(published.status, 200)
    const me = await adminMeHttp(req('http://127.0.0.1/api/admin/me', { headers }), {
      env: sessionEnv,
      fetchImpl,
    })
    const meBody = await me.json()
    assert.equal(meBody.authenticated, false)
    assert.equal(meBody.admin, false)
  })

  it('bez nastavení serveru nikoho nevolá a úspěch nepředstírá', async () => {
    let called = false
    const fetchImpl = async () => {
      called = true
      throw new Error('síť se nesmí volat')
    }
    const env = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' }
    const published = await listPublishedPlacesHttp(req('http://127.0.0.1/api/published-places'), {
      env,
      fetchImpl,
    })
    const me = await adminMeHttp(req('http://127.0.0.1/api/admin/me'), { env, fetchImpl })
    assert.equal(published.status, 503)
    assert.equal(me.status, 503)
    assert.equal(called, false)
    assert.equal((await published.json()).error, 'auth-not-configured')
  })
})
