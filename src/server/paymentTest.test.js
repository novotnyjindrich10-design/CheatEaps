import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import { applySponsorships, showSponsoredLabel } from '../constants/monetization.js'
import {
  buildGatewayPayment,
  createComgatePayment,
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
const env = {
  RESEND_API_KEY: 'test-key',
  INQUIRY_TO_EMAIL: 'owner@example.com',
  EMAIL_FROM: 'FoodGo <mail@example.com>',
  PAYMENT_WEBHOOK_SECRET: 'webhook-secret',
  PAYMENTS_TEST_MODE: 'true',
  PAYMENT_TEST_SECRET: secret,
  PAYMENTS_LIVE: 'false',
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
    assert.equal(places.find((place) => place.id === 'jiny-podnik'), undefined)

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

  it('ověřený webhook aktivuje propagaci; špatný podpis a částka odmítne', async () => {
    const store = createMemoryPromotionStore()
    const created = await (await postOrder(store, payload({ email: 'webhook-test@example.com' }))).json()
    const raw = JSON.stringify({
      eventId: 'evt-live',
      reference: created.reference,
      status: 'paid',
      amount: 199,
      currency: 'CZK',
    })
    const bad = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-cheapeats-signature': 'ne', 'content-type': 'application/json' },
        body: raw,
      }),
      { env, store, now },
    )
    assert.equal(bad.status, 401)

    const wrongAmount = JSON.stringify({
      eventId: 'evt-wrong-amount',
      reference: created.reference,
      status: 'paid',
      amount: 1,
      currency: 'CZK',
    })
    const wrongSig = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(wrongAmount).digest('hex')
    const rejected = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-cheapeats-signature': wrongSig, 'content-type': 'application/json' },
        body: wrongAmount,
      }),
      { env, store, now },
    )
    assert.equal(rejected.status, 400)
    assert.equal((await rejected.json()).error, 'amount-mismatch')

    const signature = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(raw).digest('hex')
    const ok = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'x-cheapeats-signature': signature, 'content-type': 'application/json' },
        body: raw,
      }),
      { env, store, now },
    )
    const body = await ok.json()
    assert.equal(body.paid, true)
    assert.equal(body.activated, true)
    assert.equal((await store.list()).rows[0].status, 'active')
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
    assert.equal(paymentConfig(env).enabled, false)
    assert.equal(buildGatewayPayment({ amount: 199, reference: 'CE1' }, env).error, 'not-configured')

    const sandboxEnv = {
      ...env,
      PAYMENT_PROVIDER: 'comgate',
      PAYMENT_MERCHANT_ID: 'merchant-1',
      PAYMENT_SECRET: 'secret-value-long',
      PAYMENTS_SANDBOX_OUTBOUND: 'true',
      PAYMENTS_LIVE: 'false',
    }
    const built = buildGatewayPayment({
      amount: 199,
      reference: 'CE1',
      planName: 'Plus',
      email: 'anna@example.com',
    }, sandboxEnv)
    assert.equal(built.ok, true)
    assert.equal(built.request.price, 19900)
    assert.equal(built.request.test, true)

    const created = await createComgatePayment(
      { amount: 199, reference: 'CE1', planName: 'Plus', email: 'anna@example.com' },
      {
        env: sandboxEnv,
        fetchImpl: async () => ({
          ok: true,
          text: async () => JSON.stringify({ code: 0, redirect: 'https://payments.comgate.cz/pay/abc', transId: 'ABC-1' }),
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
        env: sandboxEnv,
        store,
        fetchImpl: async () => ({
          ok: true,
          text: async () => JSON.stringify({ code: 0, redirect: 'https://payments.comgate.cz/pay/xyz', transId: 'XYZ' }),
        }),
      },
    )
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.redirect, 'https://payments.comgate.cz/pay/xyz')
    assert.equal(body.paid, false)
  })
})
