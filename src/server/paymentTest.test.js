import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { applySponsorships, showSponsoredLabel } from '../constants/monetization.js'
import {
  buildGatewayPayment,
  createComgatePayment,
  mayActivateFromComgate,
  paymentConfig,
  paymentCreateHttp,
  paymentReturnHttp,
  paymentTestConfirmHttp,
  paymentWebhookHttp,
} from './payments.js'
import {
  adminPromotionOrdersHttp,
  createMemoryPromotionStore,
  promotionOrdersHttp,
  resetPromotionOrderLimits,
  sponsorshipsHttp,
} from './promotionOrders.js'

const now = Date.parse('2026-06-15T12:00:00.000Z')
const secret = 'test-secret-value'
const merchant = 'merchant-1'
const gatewaySecret = 'comgate-secret-value'
const env = {
  RESEND_API_KEY: 'test-key',
  INQUIRY_TO_EMAIL: 'owner@example.com',
  EMAIL_FROM: 'FoodGo <mail@example.com>',
  PAYMENT_PROVIDER: 'comgate',
  PAYMENT_MERCHANT_ID: merchant,
  PAYMENT_SECRET: gatewaySecret,
  PAYMENTS_TEST_MODE: 'true',
  PAYMENT_TEST_SECRET: secret,
  PAYMENTS_LIVE: 'false',
  PAYMENTS_SANDBOX_OUTBOUND: 'true',
  VERCEL_ENV: 'preview',
}

function payload(overrides = {}) {
  return {
    planId: 'plus',
    periodId: 'mesicne',
    businessName: 'Bistro Test',
    companyName: 'Bistro Test s.r.o.',
    contactName: 'Anna Nová',
    email: 'anna-test@example.com',
    phone: '+420777000111',
    billingAddress: 'Testovací 1, Brno',
    placeId: 'bistro-test',
    termsAck: true,
    openedAt: now - 5000,
    ...overrides,
  }
}

function postOrder(store, body = payload()) {
  return promotionOrdersHttp(
    new Request('https://cheapeats.local/api/promotion-orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { env, store, now, fetchImpl: async () => ({ ok: true, status: 200 }) },
  )
}

function confirm(store, body, { header = secret, testEnv = env } = {}) {
  return paymentTestConfirmHttp(
    new Request('https://cheapeats.local/api/payments/test-confirm', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-foodgo-test-secret': header,
      },
      body: JSON.stringify(body),
    }),
    { env: testEnv, store, now },
  )
}

function statusFetch(overrides = {}) {
  return async (url) => {
    if (String(url).includes('/status')) {
      return {
        ok: true,
        text: async () => new URLSearchParams({
          code: '0',
          message: 'OK',
          transId: overrides.transId || 'AB12-CD34-EF56',
          status: overrides.status || 'PAID',
          price: String(overrides.price ?? 19900),
          curr: overrides.curr || 'CZK',
          refId: overrides.refId || '',
          test: overrides.test ?? 'true',
        }).toString(),
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  }
}

async function comgatePush(store, fields, { testEnv = env, fetchImpl } = {}) {
  const body = new URLSearchParams({
    merchant,
    secret: gatewaySecret,
    transId: 'AB12-CD34-EF56',
    status: 'PAID',
    price: '19900',
    curr: 'CZK',
    test: 'true',
    ...fields,
  })
  return paymentWebhookHttp(
    new Request('https://cheapeats.local/api/payments/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    }),
    {
      env: testEnv,
      store,
      now,
      debugJson: true,
      fetchImpl: fetchImpl || statusFetch({ refId: fields.refId, ...fields }),
    },
  )
}

beforeEach(() => {
  resetPromotionOrderLimits()
})

describe('testovací potvrzení platby', () => {
  it('bez režimu nebo se špatným tajemstvím nic nezapne', async () => {
    const store = createMemoryPromotionStore()
    const created = await (await postOrder(store)).json()
    const off = await confirm(store, {
      eventId: 'evt-off',
      reference: created.reference,
      status: 'paid',
    }, {
      testEnv: { ...env, PAYMENTS_TEST_MODE: 'false' },
    })
    assert.equal(off.status, 404)
    assert.equal((await off.json()).activated, false)

    const denied = await confirm(store, {
      eventId: 'evt-denied',
      reference: created.reference,
      status: 'paid',
    }, { header: 'spatne-tajemstvi' })
    assert.equal(denied.status, 401)
    const listed = await store.list()
    assert.equal(listed.rows[0].paymentStatus, 'none')
    assert.equal(listed.rows[0].status, 'inquiry')
  })

  it('po simulované úhradě zapne propagaci, duplicitu a zamítnutí neprodlouží', async () => {
    const store = createMemoryPromotionStore()
    store.grantAdmin('admin-1')
    const created = await (await postOrder(store)).json()
    assert.equal(created.paid, false)

    const back = await paymentReturnHttp(
      new Request(`https://cheapeats.local/api/payments/return?reference=${created.reference}&status=paid`),
    )
    assert.equal((await back.json()).activated, false)

    const failed = await confirm(store, {
      eventId: 'evt-fail',
      reference: created.reference,
      status: 'failed',
    })
    const failedBody = await failed.json()
    assert.equal(failed.status, 200)
    assert.equal(failedBody.paid, false)
    assert.equal(failedBody.activated, false)

    const paid = await confirm(store, {
      eventId: 'evt-paid',
      reference: created.reference,
      status: 'paid',
      placeId: 'jiny-podnik',
    })
    const paidBody = await paid.json()
    assert.equal(paid.status, 200)
    assert.equal(paidBody.paid, true)
    assert.equal(paidBody.activated, true)
    assert.equal(paidBody.renewal, 'none')
    const listed = await store.list()
    assert.equal(listed.rows[0].placeId, 'bistro-test')
    const endsAt = listed.rows[0].endsAt

    const again = await confirm(store, {
      eventId: 'evt-paid',
      reference: created.reference,
      status: 'paid',
    })
    assert.equal((await again.json()).duplicate, true)
    assert.equal((await store.list()).rows[0].endsAt, endsAt)

    const publicRows = await (await sponsorshipsHttp(
      new Request('https://cheapeats.local/api/sponsorships'),
      { store, now },
    )).json()
    const places = applySponsorships([{ id: 'bistro-test', name: 'Bistro', sponsored: true }], publicRows.sponsorships, now)
    assert.equal(showSponsoredLabel(places[0], now), true)

    const later = now + 31 * 24 * 60 * 60 * 1000
    const expired = await (await sponsorshipsHttp(
      new Request('https://cheapeats.local/api/sponsorships'),
      { store, now: later },
    )).json()
    const after = applySponsorships([{ id: 'bistro-test', name: 'Bistro' }], expired.sponsorships, later)
    assert.equal(showSponsoredLabel(after[0], later), false)

    const admin = await (await adminPromotionOrdersHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders'),
      { store, user: { id: 'admin-1' }, now },
    )).json()
    assert.equal(admin.stats.recordedRevenueCzk, 199)
    assert.equal(admin.stats.paidOrders, 1)
  })

  it('Comgate push ověří /status, aktivuje sandbox a odmítne špatný secret i částku', async () => {
    const store = createMemoryPromotionStore()
    const created = await (await postOrder(store, payload({ email: 'webhook-test@example.com' }))).json()

    const bad = await comgatePush(store, { refId: created.reference, secret: 'wrong' }, {
      fetchImpl: statusFetch({ refId: created.reference }),
    })
    assert.equal(bad.status, 401)

    const mismatch = await comgatePush(store, { refId: created.reference, price: '100' }, {
      fetchImpl: statusFetch({ refId: created.reference, price: 100 }),
    })
    assert.equal(mismatch.status, 400)
    assert.equal((await mismatch.json()).error, 'amount-mismatch')

    const ok = await comgatePush(store, { refId: created.reference }, {
      fetchImpl: statusFetch({ refId: created.reference, test: 'true' }),
    })
    const body = await ok.json()
    assert.equal(ok.status, 200)
    assert.equal(body.paid, true)
    assert.equal(body.activated, true)
    assert.equal((await store.list()).rows[0].status, 'active')

    assert.equal(mayActivateFromComgate({ status: 'paid', test: true }, { ...env, PAYMENTS_LIVE: 'true', VERCEL_ENV: 'production' }).ok, false)
  })

  it('v produkci ani při zapnutém testovacím přepínači simulaci nepustí', async () => {
    const store = createMemoryPromotionStore()
    const created = await (await postOrder(store, payload({ email: 'prod-test@example.com' }))).json()
    const response = await confirm(store, {
      eventId: 'evt-prod',
      reference: created.reference,
      status: 'paid',
    }, { testEnv: { ...env, VERCEL_ENV: 'production' } })
    assert.equal(response.status, 404)
    assert.equal((await store.list()).rows[0].paymentStatus, 'none')
  })

  it('Comgate create bez outbound flagu nic neodešle; se sandboxem vrátí redirect', async () => {
    assert.equal(paymentConfig({ ...env, PAYMENTS_SANDBOX_OUTBOUND: 'false', PAYMENTS_LIVE: 'false' }).enabled, false)
    assert.equal(buildGatewayPayment({ amount: 199, reference: 'CE1' }, { ...env, PAYMENTS_SANDBOX_OUTBOUND: 'false' }).error, 'not-configured')

    const built = buildGatewayPayment({
      amount: 199,
      reference: 'CE1',
      planName: 'Plus',
      email: 'anna@example.com',
    }, env)
    assert.equal(built.ok, true)
    assert.equal(built.request.price, 19900)
    assert.equal(built.request.test, true)
    assert.equal(built.request.prepareOnly, true)

    const created = await createComgatePayment(
      { amount: 199, reference: 'CE1', planName: 'Plus', email: 'anna@example.com' },
      {
        env,
        fetchImpl: async () => ({
          ok: true,
          text: async () => 'code=0&message=OK&transId=ABC-1&redirect=https%3A%2F%2Fpayments.comgate.cz%2Fpay%2Fabc',
        }),
      },
    )
    assert.equal(created.ok, true)
    assert.equal(created.redirect, 'https://payments.comgate.cz/pay/abc')
    assert.equal(created.test, true)

    const store = createMemoryPromotionStore()
    const order = await (await postOrder(store, payload({ email: 'comgate-create@example.com' }))).json()
    const response = await paymentCreateHttp(
      new Request('https://cheapeats.local/api/payments/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference: order.reference, accessKey: order.accessKey }),
      }),
      {
        env,
        store,
        fetchImpl: async () => ({
          ok: true,
          text: async () => 'code=0&message=OK&transId=XYZ&redirect=https%3A%2F%2Fpayments.comgate.cz%2Fpay%2Fxyz',
        }),
      },
    )
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.redirect, 'https://payments.comgate.cz/pay/xyz')
    assert.equal(body.paid, false)
  })
})
