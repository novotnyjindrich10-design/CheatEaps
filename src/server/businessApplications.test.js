import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
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
