import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { apiRouter } from './apiRouter.js'

const ROUTES = [
  { path: '/api/auth/login', method: 'GET' },
  { path: '/api/auth/signup', method: 'GET' },
  { path: '/api/auth/logout', method: 'GET' },
  { path: '/api/auth/session', method: 'GET' },
  { path: '/api/auth/recover', method: 'GET' },
  { path: '/api/auth/prepare-recovery', method: 'GET' },
  { path: '/api/auth/update-password', method: 'GET' },
  { path: '/api/deal-detail', method: 'GET' },
  { path: '/api/favorites', method: 'GET' },
  { path: '/api/reviews?restaurantId=demo', method: 'GET' },
  { path: '/api/review-reports', method: 'POST' },
  { path: '/api/published-places', method: 'GET' },
  { path: '/api/business-applications', method: 'POST' },
  { path: '/api/business-description-review', method: 'POST' },
  { path: '/api/business-existence-check', method: 'POST' },
  { path: '/api/admin/me', method: 'GET' },
  { path: '/api/admin/business-applications', method: 'GET' },
  { path: '/api/admin/business-applications/review', method: 'POST' },
  { path: '/api/admin/business-applications/resend-email', method: 'POST' },
  { path: '/api/promotion-request', method: 'GET', expectStatus: 405 },
  { path: '/api/quote-promotion', method: 'GET', expectStatus: 405 },
]

function req(path, init = {}) {
  return new Request(`http://127.0.0.1${path}`, init)
}

async function assertRouted(path, init = {}) {
  const response = await apiRouter(req(path, init))
  const body = await response.json().catch(() => ({}))
  assert.notEqual(body.message, 'Neznámá adresa.', `${path} nesmí skončit na router 404`)
  return { response, body }
}

describe('apiRouter', () => {
  it('neznámou /api cestu vrátí 404 a auth/session i quote-promotion dál obslouží', async () => {
    const unknown = await apiRouter(req('/api/does-not-exist'))
    assert.equal(unknown.status, 404)
    assert.equal((await unknown.json()).message, 'Neznámá adresa.')

    const session = await apiRouter(req('/api/auth/session'))
    assert.ok([200, 503].includes(session.status))

    const quote = await apiRouter(
      req('/api/quote-promotion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId: 'start', periodId: 'mesicne' }),
      }),
    )
    assert.equal(quote.status, 200)
    const body = await quote.json()
    assert.equal(body.ok, true)
    assert.equal(body.planId, 'start')
  })

  it('směruje všechny známé endpointy a neplete si admin cesty', async () => {
    for (const route of ROUTES) {
      const { response, body } = await assertRouted(route.path, { method: route.method })
      if (route.expectStatus != null) {
        assert.equal(response.status, route.expectStatus, route.path)
      }
      assert.notEqual(body.message, 'Neznámá adresa.', route.path)
    }

    const collision = await apiRouter(req('/api/admin/business-applications/review', { method: 'GET' }))
    assert.equal(collision.status, 404)
    assert.match((await collision.json()).message || '', /business|Neznámá/i)

    await assertRouted('/api/admin/business-applications?status=pending', { method: 'GET' })
  })

  it('zachová query, cookies, metodu i JSON body a snese trailing slash', async () => {
    const { response: deal, body: dealBody } = await assertRouted(
      '/api/deal-detail/?id=kfc-isic-twister--kfc-masarykova-39',
      { headers: { cookie: 'ce_access=test-token' } },
    )
    assert.ok([401, 404, 503].includes(deal.status))
    assert.ok(dealBody.error || dealBody.message)

    const { response: login } = await assertRouted('/api/auth/login/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: 'ce_access=stale',
        origin: 'http://127.0.0.1',
      },
      body: JSON.stringify({ email: 'not-an-email', password: 'x' }),
    })
    assert.ok([400, 503].includes(login.status))

    const { response: slashSession } = await assertRouted('/api/auth/session/')
    assert.ok([200, 503].includes(slashSession.status))
  })

  it('nesměruje prefixové kolize ani SPA cesty', async () => {
    for (const path of ['/api/auth', '/api/admin', '/api/reviews-extra', '/restaurant/demo']) {
      const response = await apiRouter(req(path))
      assert.equal(response.status, 404, path)
      assert.equal((await response.json()).message, 'Neznámá adresa.')
    }
  })
})
