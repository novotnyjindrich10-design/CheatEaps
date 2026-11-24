import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { healthHttp, healthSnapshot } from './health.js'

describe('health', () => {
  it('nevrací tajné hodnoty', async () => {
    const snap = healthSnapshot({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'sb_publishable_test',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_SHOULD_NOT_LEAK',
      RESEND_API_KEY: 're_test',
      PAYMENT_SECRET: 'comgate-secret',
      PAYMENTS_LIVE: 'false',
      PUBLIC_SITE_URL: 'https://example.test',
    })
    const text = JSON.stringify(snap)
    assert.equal(snap.ok, true)
    assert.equal(snap.checks.supabaseConfigured, true)
    assert.equal(snap.checks.emailConfigured, true)
    assert.equal(snap.checks.paymentsLive, false)
    assert.equal(text.includes('sb_secret_'), false)
    assert.equal(text.includes('comgate-secret'), false)
    assert.equal(text.includes('re_test'), false)

    const response = await healthHttp(new Request('https://foodgo.local/api/health'))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.ok, true)
    assert.equal(JSON.stringify(body).includes('sb_secret_'), false)
  })
})
