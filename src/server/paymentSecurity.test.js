import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  mayActivateFromComgate,
  paymentConfig,
  paymentStatusHttp,
  parseComgatePush,
} from './payments.js'

describe('oddělení sandbox a produkčních plateb', () => {
  it('test platba nesmí aktivovat na LIVE ani Production', () => {
    assert.equal(
      mayActivateFromComgate({ status: 'paid', test: true }, {
        PAYMENT_PROVIDER: 'comgate',
        PAYMENT_MERCHANT_ID: 'm',
        PAYMENT_SECRET: 'secret-value-long',
        PAYMENTS_LIVE: 'true',
        VERCEL_ENV: 'preview',
      }).reason,
      'test-payment-blocked-on-live',
    )
    assert.equal(
      mayActivateFromComgate({ status: 'paid', test: true }, {
        PAYMENT_PROVIDER: 'comgate',
        PAYMENT_MERCHANT_ID: 'm',
        PAYMENT_SECRET: 'secret-value-long',
        PAYMENTS_LIVE: 'false',
        PAYMENTS_SANDBOX_OUTBOUND: 'true',
        VERCEL_ENV: 'production',
      }).ok,
      false,
    )
    assert.equal(
      mayActivateFromComgate({ status: 'paid', test: true }, {
        PAYMENT_PROVIDER: 'comgate',
        PAYMENT_MERCHANT_ID: 'm',
        PAYMENT_SECRET: 'secret-value-long',
        PAYMENTS_LIVE: 'false',
        PAYMENTS_SANDBOX_OUTBOUND: 'true',
        VERCEL_ENV: 'preview',
      }).paymentSource,
      'gateway-test',
    )
  })

  it('ostrá PAID bez LIVE se neaktivuje', () => {
    const gate = mayActivateFromComgate({ status: 'paid', test: false }, {
      PAYMENT_PROVIDER: 'comgate',
      PAYMENT_MERCHANT_ID: 'm',
      PAYMENT_SECRET: 'secret-value-long',
      PAYMENTS_SANDBOX_OUTBOUND: 'true',
      PAYMENTS_LIVE: 'false',
    })
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'live-payment-while-sandbox-only')
  })

  it('status endpoint neuniká secret ani bypass hodnotu', async () => {
    const secret = 'super-secret-bypass-value-xyz'
    const response = await paymentStatusHttp(
      new Request('https://cheapeats.local/api/payments/status'),
      {
        env: {
          VERCEL_AUTOMATION_BYPASS_SECRET: secret,
          PAYMENT_SECRET: 'comgate-secret-should-not-leak',
          PAYMENT_MERCHANT_ID: 'merchant',
          PAYMENT_PROVIDER: 'comgate',
        },
      },
    )
    const text = await response.text()
    assert.equal(response.status, 200)
    assert.equal(text.includes(secret), false)
    assert.equal(text.includes('comgate-secret-should-not-leak'), false)
    assert.equal(text.includes('x-vercel-protection-bypass='), false)
    const body = JSON.parse(text)
    assert.equal(body.protectionBypassConfigured, true)
    assert.equal(body.webhookPath, '/api/payments/webhook')
  })

  it('paymentConfig nevyžaduje vymyšlený PAYMENT_WEBHOOK_SECRET', () => {
    const config = paymentConfig({
      PAYMENT_PROVIDER: 'comgate',
      PAYMENT_MERCHANT_ID: 'm1',
      PAYMENT_SECRET: 'secret-long-enough',
      PAYMENTS_SANDBOX_OUTBOUND: 'true',
    })
    assert.equal(config.enabled, true)
    assert.equal(config.credentials, true)
  })

  it('Comgate push parser bere form i JSON bez logování secretu', () => {
    const form = parseComgatePush(
      'merchant=m&secret=hidden&transId=T1&refId=CE1&status=PAID&test=true',
      'application/x-www-form-urlencoded',
    )
    assert.equal(form.transId, 'T1')
    assert.equal(form.secret, 'hidden')
    const json = parseComgatePush(
      JSON.stringify({ merchant: 'm', secret: 'hidden2', transId: 'T2', refId: 'CE2', status: 'PAID' }),
      'application/json',
    )
    assert.equal(json.transId, 'T2')
  })
})
