import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { applySponsorships, showSponsoredLabel } from '../constants/monetization.js'
import { paymentReturnHttp, paymentWebhookHttp } from './payments.js'
import {
  adminPromotionOrdersHttp,
  adminPromotionReviewHttp,
  createMemoryPromotionStore,
  createSupabasePromotionStore,
  promotionOrdersHttp,
  resetPromotionOrderLimits,
  sponsorshipsHttp,
} from './promotionOrders.js'

const now = Date.parse('2026-06-15T12:00:00.000Z')
const merchant = 'merchant-1'
const gatewaySecret = 'comgate-secret-value'
const env = {
  RESEND_API_KEY: 'test-key',
  INQUIRY_TO_EMAIL: 'owner@example.com',
  EMAIL_FROM: 'FoodGo <mail@example.com>',
  PAYMENT_PROVIDER: 'comgate',
  PAYMENT_MERCHANT_ID: merchant,
  PAYMENT_SECRET: gatewaySecret,
  PAYMENTS_SANDBOX_OUTBOUND: 'true',
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
    email: 'anna@example.com',
    phone: '+420777000111',
    billingAddress: 'Testovací 1, Brno',
    placeId: 'bistro-test',
    termsAck: true,
    openedAt: now - 5000,
    amount: 1,
    paymentStatus: 'paid',
    status: 'active',
    paid: true,
    ...overrides,
  }
}

function post(body, store, extra = {}) {
  return promotionOrdersHttp(
    new Request('https://cheapeats.local/api/promotion-orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { env, store, now, fetchImpl: async () => ({ ok: true, status: 200 }), ...extra },
  )
}

beforeEach(() => {
  resetPromotionOrderLimits()
})

describe('poptávky propagace', () => {
  it('uloží nezávaznou poptávku a ignoruje pokus o zaplacení i aktivaci', async () => {
    const store = createMemoryPromotionStore()
    const response = await post(payload(), store)
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.stored, true)
    assert.equal(body.paid, false)
    assert.equal(body.activated, false)
    assert.equal(body.renewal, 'none')
    assert.equal(body.order.amount, 199)
    assert.equal(body.order.paymentStatus, 'none')
    assert.equal(body.order.status, 'inquiry')
    assert.notEqual(body.order.amount, 1)

    const own = await promotionOrdersHttp(
      new Request(`https://cheapeats.local/api/promotion-orders?reference=${body.reference}`, {
        headers: { 'x-foodgo-order-key': body.accessKey },
      }),
      { store },
    )
    assert.equal((await own.json()).order.businessName, 'Bistro Test')

    const leaked = await promotionOrdersHttp(
      new Request(`https://cheapeats.local/api/promotion-orders?reference=${body.reference}&key=${body.accessKey}`),
      { store },
    )
    assert.equal(leaked.status, 400)

    const stranger = await promotionOrdersHttp(
      new Request(`https://cheapeats.local/api/promotion-orders?reference=${body.reference}`, {
        headers: { 'x-foodgo-order-key': 'jiny-klic' },
      }),
      { store },
    )
    assert.equal(stranger.status, 404)
  })

  it('stejnou otevřenou poptávku znovu nezaloží a cizí seznam neukáže', async () => {
    const store = createMemoryPromotionStore()
    assert.equal((await post(payload(), store)).status, 200)
    const again = await post(payload({ openedAt: now - 8000 }), store)
    assert.equal(again.status, 409)
    assert.equal((await again.json()).accepted, false)

    const hidden = await adminPromotionOrdersHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders'),
      { store, user: { id: 'user-1' } },
    )
    assert.equal(hidden.status, 403)

    store.grantAdmin('admin-1')
    const listed = await adminPromotionOrdersHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders'),
      { store, user: { id: 'admin-1' }, now },
    )
    const adminBody = await listed.json()
    assert.equal(listed.status, 200)
    assert.equal(adminBody.orders.length, 1)
    assert.equal(adminBody.stats.impressionsMeasured, false)
    assert.equal(adminBody.stats.recordedRevenueCzk, 0)
    assert.equal(adminBody.stats.webhookErrorsStored, false)
    assert.equal(Object.hasOwn(adminBody.orders[0], 'accessHash'), false)
  })

  it('reklamu zapne jen administrátor po ověřené úhradě a po expiraci ji stáhne', async () => {
    const store = createMemoryPromotionStore()
    store.grantAdmin('admin-1')
    const created = await (await post(payload(), store)).json()
    const id = (await (await adminPromotionOrdersHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders'),
      { store, user: { id: 'admin-1' } },
    )).json()).orders[0].id

    const tooSoon = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'activate', placeId: 'bistro-test' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    assert.equal(tooSoon.status, 400)
    assert.equal((await tooSoon.json()).activated, false)

    const missingNumber = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'invoice', invoiceNumber: '' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    assert.equal(missingNumber.status, 400)

    const invoiced = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'invoice', invoiceNumber: '2026-001', adminNote: 'ruční podklad' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    const invoicedBody = await invoiced.json()
    assert.equal(invoiced.status, 200)
    assert.equal(invoicedBody.paid, false)
    assert.equal(invoicedBody.activated, false)
    assert.equal(invoicedBody.order.invoiceNumber, '2026-001')
    assert.equal(invoicedBody.order.paymentStatus, 'invoiced')
    assert.equal(invoicedBody.order.status, 'accepted')

    const paid = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'mark_paid' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    const paidBody = await paid.json()
    assert.equal(paidBody.paid, true)
    assert.equal(paidBody.activated, false)

    const live = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'activate', placeId: 'bistro-test' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    const liveBody = await live.json()
    assert.equal(liveBody.activated, true)
    assert.equal(liveBody.renewal, 'none')

    const publicRows = await (await sponsorshipsHttp(
      new Request('https://cheapeats.local/api/sponsorships'),
      { store, now },
    )).json()
    const places = applySponsorships([{ id: 'bistro-test', name: 'Bistro' }], publicRows.sponsorships, now)
    assert.equal(showSponsoredLabel(places[0], now), true)

    const later = now + 31 * 24 * 60 * 60 * 1000
    const expired = await (await sponsorshipsHttp(
      new Request('https://cheapeats.local/api/sponsorships'),
      { store, now: later },
    )).json()
    const after = applySponsorships([{ id: 'bistro-test', name: 'Bistro' }], expired.sponsorships, later)
    assert.equal(showSponsoredLabel(after[0], later), false)
    assert.equal(created.reference.length > 4, true)
  })
})

describe('platební stavy', () => {
  it('návrat z brány ani špatný secret úhradu nezapíšou a stejný Comgate push se vezme jednou', async () => {
    const store = createMemoryPromotionStore()
    const created = await (await post(payload({ email: 'platba@example.com' }), store)).json()
    const back = await paymentReturnHttp(
      new Request(`https://cheapeats.local/api/payments/return?reference=${created.reference}&status=paid`),
    )
    const backBody = await back.json()
    assert.equal(backBody.paid, false)
    assert.equal(backBody.activated, false)

    const form = (secret) => new URLSearchParams({
      merchant,
      secret,
      transId: 'AB12-CD34-EF56',
      status: 'PAID',
      price: '19900',
      curr: 'CZK',
      refId: created.reference,
      test: 'true',
    }).toString()

    const statusOk = async () => ({
      ok: true,
      text: async () => new URLSearchParams({
        code: '0',
        message: 'OK',
        transId: 'AB12-CD34-EF56',
        status: 'PAID',
        price: '19900',
        curr: 'CZK',
        refId: created.reference,
        test: 'true',
      }).toString(),
    })

    const bad = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form('spatne'),
      }),
      { env, store, now, fetchImpl: statusOk },
    )
    assert.equal(bad.status, 401)

    const first = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form(gatewaySecret),
      }),
      { env, store, now, debugJson: true, fetchImpl: statusOk },
    )
    const firstBody = await first.json()
    assert.equal(first.status, 200)
    assert.equal(firstBody.paid, true)
    assert.equal(firstBody.activated, true)

    const second = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form(gatewaySecret),
      }),
      { env, store, now, fetchImpl: statusOk },
    )
    assert.equal(second.status, 200)
    assert.equal(await second.text(), 'OK')

    const listed = await store.list()
    assert.equal(listed.rows[0].paymentStatus, 'paid')
    assert.equal(listed.rows[0].status, 'active')
    assert.equal(listed.rows[0].renewal, 'none')
    assert.ok(listed.rows[0].endsAt)
  })

  it('bez tajemství webhook nic nezmění', async () => {
    const store = createMemoryPromotionStore()
    const response = await paymentWebhookHttp(
      new Request('https://cheapeats.local/api/payments/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'merchant=x&secret=y&transId=T&refId=CEX&status=PAID',
      }),
      { env: {}, store },
    )
    assert.equal(response.status, 503)
    assert.equal((await response.json()).paid, false)
    assert.equal((await store.list()).rows.length, 0)
  })

  it('Supabase create volá rpc/submit_promotion_inquiry a readOwn rpc/read_promotion_inquiry', async () => {
    const calls = []
    const store = createSupabasePromotionStore({
      config: {
        url: 'https://example.supabase.co',
        anonKey: 'anon-test',
        serviceRoleKey: 'sb_secret_inquiry_test',
        configured: true,
      },
      fetchImpl: async (url, init) => {
        calls.push({
          url,
          method: init.method,
          body: init.body ? JSON.parse(init.body) : null,
          apiKey: init.headers.apikey,
          auth: init.headers.Authorization,
        })
        if (String(url).includes('submit_promotion_inquiry')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ ok: true, id: '11111111-1111-4111-8111-111111111111', reference: 'CEABC12345' }),
          }
        }
        if (String(url).includes('read_promotion_inquiry')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              ok: true,
              order: {
                reference: 'CEABC12345',
                status: 'inquiry',
                paymentStatus: 'none',
                planId: 'plus',
                planName: 'Plus',
                periodId: 'mesicne',
                amount: 199,
                currency: 'CZK',
                serviceDays: 30,
                serviceLabel: '30 dní',
                vatStatus: 'unconfirmed',
                vatNote: '',
                placeId: 'bistro-test',
                businessName: 'Bistro Test',
              },
            }),
          }
        }
        if (String(url).includes('promotion_sponsorships_public')) {
          return { ok: true, status: 200, json: async () => [] }
        }
        return { ok: false, status: 500, json: async () => ({}) }
      },
    })

    const created = await store.create({
      planId: 'plus',
      planName: 'Plus',
      periodId: 'mesicne',
      businessName: 'Bistro Test',
      companyName: 'Bistro Test s.r.o.',
      contactName: 'Anna',
      email: 'anna@example.com',
      phone: '+420777000111',
      billingAddress: 'Test 1',
      placeId: 'bistro-test',
      termsAck: true,
      amount: 199,
      currency: 'CZK',
      serviceDays: 30,
      serviceLabel: '30 dní',
      renewal: 'none',
      vatStatus: 'unconfirmed',
      vatNote: '',
    })
    assert.equal(created.ok, true)
    assert.equal(created.row.reference, 'CEABC12345')
    assert.match(calls[0].url, /rpc\/submit_promotion_inquiry$/)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].apiKey, 'sb_secret_inquiry_test')
    assert.equal(calls[0].auth, undefined)
    assert.equal(calls[0].body.p_record.planId, 'plus')
    assert.equal(calls[0].body.p_record.termsAck, true)
    assert.match(calls[0].body.p_access_hash, /^[a-f0-9]{64}$/)
    assert.match(calls[0].body.p_reference, /^CE[A-F0-9]+$/)

    const own = await store.readOwn('CEABC12345', created.accessKey)
    assert.equal(own.ok, true)
    assert.equal(own.row.businessName, 'Bistro Test')
    assert.match(calls[1].url, /rpc\/read_promotion_inquiry$/)
    assert.equal(calls[1].apiKey, 'sb_secret_inquiry_test')
    assert.equal(calls[1].body.p_reference, 'CEABC12345')
    assert.equal(calls[1].body.p_access_key, created.accessKey)

    const ads = await store.activeSponsorships()
    assert.deepEqual(ads, [])
    assert.match(calls[2].url, /promotion_sponsorships_public\?select=place_id,plan_id,starts_at,ends_at/)
  })

  it('Supabase zápis úhrady vyžaduje service_role a nevolá anon RPC', async () => {
    const calls = []
    const config = {
      url: 'https://example.supabase.co',
      anonKey: 'anon-test',
      serviceRoleKey: '',
      configured: true,
    }
    const blocked = createSupabasePromotionStore({
      config,
      fetchImpl: async (url) => {
        calls.push(url)
        return { ok: false, status: 500, json: async () => ({}) }
      },
    })
    assert.equal(
      (await blocked.applyPayment({ eventId: 'e1', reference: 'CE1', status: 'paid' })).error,
      'service-role-required',
    )
    assert.equal(calls.length, 0)

    config.serviceRoleKey = 'service-test'
    const allowed = createSupabasePromotionStore({
      config,
      fetchImpl: async (url, init) => {
        calls.push({
          url,
          auth: init.headers.Authorization,
          apiKey: init.headers.apikey,
          body: JSON.parse(init.body),
        })
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, duplicate: false, activated: false }),
        }
      },
    })
    process.env.PAYMENT_WEBHOOK_SECRET = 'webhook-secret-at-least'
    const applied = await allowed.applyPayment({ eventId: 'e2', reference: 'CE2', status: 'paid' })
    assert.equal(applied.ok, true)
    assert.equal(applied.activated, false)
    assert.match(calls[0].url, /rpc\/record_verified_payment/)
    assert.equal(calls[0].auth, 'Bearer service-test')
    assert.equal(calls[0].apiKey, 'service-test')
    assert.notEqual(calls[0].auth, 'Bearer anon-test')

    calls.length = 0
    config.serviceRoleKey = 'sb_secret_payment_test'
    const withNewSecret = createSupabasePromotionStore({
      config,
      fetchImpl: async (url, init) => {
        calls.push({
          url,
          auth: init.headers.Authorization,
          apiKey: init.headers.apikey,
        })
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, duplicate: false, activated: false }),
        }
      },
    })
    const paidNew = await withNewSecret.applyPayment({
      eventId: 'e3',
      reference: 'CE3',
      status: 'paid',
    })
    assert.equal(paidNew.ok, true)
    assert.equal(calls[0].apiKey, 'sb_secret_payment_test')
    assert.equal(calls[0].auth, undefined)
  })
})

describe('doručení a prázdné nastavení', () => {
  it('bez databáze a bez Resend úspěch nepředstírá', async () => {
    const response = await promotionOrdersHttp(
      new Request('https://cheapeats.local/api/promotion-orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload({ email: 'prazdne@example.com' })),
      }),
      { env: {}, now, fetchImpl: async () => { throw new Error('nemá se volat') } },
    )
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.equal(body.ok, false)
    assert.equal(body.stored, false)
    assert.equal(body.paid, false)
    assert.equal(body.activated, false)
  })

  it('při pádu Resendu poptávku v evidenci ponechá', async () => {
    const store = createMemoryPromotionStore()
    const response = await post(payload({ email: 'resend-pad@example.com' }), store, {
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ message: 'boom' }) }),
    })
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.equal(body.ok, true)
    assert.equal(body.stored, true)
    assert.equal(body.operatorNotified, false)
    assert.equal(body.restaurantNotified, false)
    assert.equal(body.paid, false)
    assert.equal(body.activated, false)
    assert.match(body.message, /uložená/i)
    assert.match(body.message, /E-mail se nepodařilo odeslat/i)
    assert.equal((await store.list()).rows.length, 1)
    assert.equal((await store.list()).rows[0].reference, body.reference)
  })

  it('uloží poptávku a pošle upozornění provozovateli i potvrzení restauraci', async () => {
    const store = createMemoryPromotionStore()
    const calls = []
    const response = await post(payload({ email: 'restaurace@example.com' }), store, {
      fetchImpl: async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) })
        return { ok: true, status: 200 }
      },
    })
    const body = await response.json()
    assert.equal(body.stored, true)
    assert.equal(body.operatorNotified, true)
    assert.equal(body.restaurantNotified, true)
    assert.equal(body.paid, false)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].url, 'https://api.resend.com/emails')
    assert.equal(calls[0].body.to[0], 'owner@example.com')
    assert.match(calls[0].body.text, /Číslo evidence:/)
    assert.equal(calls[1].body.to[0], 'restaurace@example.com')
    assert.equal(calls[1].body.reply_to, 'owner@example.com')
    assert.match(calls[1].body.text, /Nic se nezaplatilo/)
    assert.match(calls[1].body.text, new RegExp(body.reference))
    assert.equal(JSON.stringify(calls).includes('test-key'), false)
  })

  it('odmítnutou poptávku neoznačí jako uhrazenou', async () => {
    const store = createMemoryPromotionStore()
    store.grantAdmin('admin-1')
    await post(payload({ email: 'uzavrena@example.com', placeId: 'uzavrene-bistro' }), store)
    const id = (await (await adminPromotionOrdersHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders'),
      { store, user: { id: 'admin-1' } },
    )).json()).orders[0].id
    const declined = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'decline' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    assert.equal((await declined.json()).order.status, 'declined')
    const paid = await adminPromotionReviewHttp(
      new Request('https://cheapeats.local/api/admin/promotion-orders/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action: 'mark_paid' }),
      }),
      { store, user: { id: 'admin-1' }, now },
    )
    assert.equal(paid.status, 400)
    assert.equal((await paid.json()).paid, false)
  })
})
