/**
 * Testy žádosti o zkušební měsíc v Node.
 * Resend se nahrazuje zkušební funkcí. Test e-mail opravdu neodesílá
 * a neověřuje nasazení na Vercelu.
 */
import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import handler from '../../api/promotion-request.js'
import {
  assessPromotionRequest,
  deliverPromotionRequest,
  promotionRequestHttp,
  resetPromotionRequestLimits,
} from './promotionRequest.js'

const now = 1_700_000_000_000
const env = {
  RESEND_API_KEY: 'test-key',
  INQUIRY_TO_EMAIL: 'owner@example.com',
  EMAIL_FROM: 'CheapEats <onboarding@resend.dev>',
}

function payload(overrides = {}) {
  return {
    planId: 'plus',
    periodId: 'mesicne',
    businessName: 'Bistro Test',
    contactName: 'Anna Nová',
    email: 'anna@example.com',
    website: 'https://bistro.cz',
    description: 'Krátký popis',
    socials: 'https://instagram.com/bistro',
    extra: 'Telefon po domluvě',
    photoNames: ['vydej.jpg'],
    openedAt: now - 5000,
    amount: 12345,
    price: 1,
    monthlyPrice: 1,
    paid: true,
    ...overrides,
  }
}

function mockFetch(status = 200, responseBody = '{"id":"email_test"}') {
  const calls = []
  const fetchImpl = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), authorization: init.headers.Authorization })
    return { ok: status >= 200 && status < 300, status, text: async () => responseBody }
  }
  return { fetchImpl, calls }
}

beforeEach(() => {
  resetPromotionRequestLimits()
})

describe('žádost o měsíc zdarma', () => {
  it('složí e-mail se všemi balíčky a ignoruje částku od klienta', async () => {
    const cases = [
      ['start', 99],
      ['plus', 199],
      ['premium', 399],
    ]
    for (const [planId, monthly] of cases) {
      const assessment = assessPromotionRequest(
        payload({ planId, email: `${planId}@example.com`, periodId: 'rocne' }),
        now,
      )
      assert.equal(assessment.ok, true)
      const { fetchImpl, calls } = mockFetch()
      const sent = await deliverPromotionRequest(assessment, env, fetchImpl, now, '')
      assert.equal(sent.status, 200)
      assert.equal(sent.body.accepted, true)
      assert.equal(sent.body.paid, false)
      assert.equal(sent.body.activated, false)
      const text = calls[0].body.text
      assert.match(text, new RegExp(`${monthly} Kč měsíčně`))
      assert.match(text, /První měsíc: zdarma/)
      assert.match(text, /Bistro Test/)
      assert.match(text, new RegExp(`${planId}@example.com`))
      assert.match(text, /vydej.jpg/)
      assert.match(text, /Krátký popis/)
      assert.match(text, /instagram.com\/bistro/)
      assert.match(text, /Platba neproběhla/)
      assert.match(text, /Propagace není aktivní/)
      assert.match(text, /není objednávka/)
      assert.equal(text.includes('12345'), false)
      assert.equal(text.includes('zaplaceno'), false)
      assert.equal(calls[0].body.to[0], 'owner@example.com')
      assert.equal(calls[0].authorization, 'Bearer test-key')
    }
  })

  it('odmítne neplatný balíček, období, pole, spam i prázdné nastavení e-mailu', async () => {
    const unknownPlan = assessPromotionRequest(payload({ planId: 'vip' }), now)
    assert.equal(unknownPlan.status, 400)
    assert.equal(unknownPlan.body.error, 'unknown-plan')

    const unknownPeriod = assessPromotionRequest(payload({ periodId: 'tydne' }), now)
    assert.equal(unknownPeriod.body.error, 'unknown-period')

    const missing = assessPromotionRequest(payload({ businessName: '  ' }), now)
    assert.equal(missing.body.field, 'businessName')

    const badEmail = assessPromotionRequest(payload({ email: 'anna' }), now)
    assert.equal(badEmail.body.field, 'email')

    const longName = assessPromotionRequest(payload({ contactName: 'A'.repeat(101) }), now)
    assert.equal(longName.body.field, 'contactName')

    const files = assessPromotionRequest(payload({ photos: [{ name: 'a.jpg' }] }), now)
    assert.match(files.body.message, /neodesílají/)

    const honeypot = assessPromotionRequest(payload({ ceLeaveBlank: 'bot' }), now)
    assert.equal(honeypot.body.error, 'rejected')

    const tooSoon = assessPromotionRequest(payload({ openedAt: now - 200 }), now)
    assert.equal(tooSoon.body.error, 'too-soon')

    const links = assessPromotionRequest(
      payload({ description: Array.from({ length: 9 }, (_, i) => `https://spam${i}.example`).join(' ') }),
      now,
    )
    assert.equal(links.body.error, 'rejected')

    const { fetchImpl, calls } = mockFetch()
    const unconfigured = await deliverPromotionRequest(
      assessPromotionRequest(payload(), now),
      {},
      fetchImpl,
      now,
      '',
    )
    assert.equal(unconfigured.status, 503)
    assert.equal(unconfigured.body.accepted, false)
    assert.equal(calls.length, 0)
  })

  it('při chybě Resendu žádost nepřijme a neprozradí text služby', async () => {
    const assessment = assessPromotionRequest(payload({ email: 'fail@example.com' }), now)
    const leaked = mockFetch(500, 'TAJNY_VYPIS_resend')
    const failed = await deliverPromotionRequest(assessment, env, leaked.fetchImpl, now, '')
    assert.equal(failed.status, 502)
    assert.equal(failed.body.accepted, false)
    assert.equal(JSON.stringify(failed.body).includes('TAJNY_VYPIS_resend'), false)

    const thrown = await deliverPromotionRequest(
      assessPromotionRequest(payload({ email: 'throw@example.com' }), now),
      env,
      async () => {
        throw new Error('TAJNY_SOCKET')
      },
      now,
      '',
    )
    assert.equal(thrown.status, 502)
    assert.equal(JSON.stringify(thrown.body).includes('TAJNY_SOCKET'), false)

    const retry = mockFetch()
    const again = await deliverPromotionRequest(
      assessPromotionRequest(payload({ email: 'throw@example.com' }), now),
      env,
      retry.fetchImpl,
      now,
      '',
    )
    assert.equal(again.body.accepted, true)
  })

  it('po třech přijatých žádostech ze stejného e-mailu další odmítne', async () => {
    const { fetchImpl } = mockFetch()
    for (let i = 0; i < 3; i += 1) {
      const sent = await deliverPromotionRequest(
        assessPromotionRequest(payload(), now + i),
        env,
        fetchImpl,
        now + i,
        '',
      )
      assert.equal(sent.status, 200)
    }
    const blocked = await deliverPromotionRequest(
      assessPromotionRequest(payload(), now + 4),
      env,
      fetchImpl,
      now + 4,
      '',
    )
    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.accepted, false)
  })

  it('HTTP obsluha rozliší metodu, JSON a úspěch', async () => {
    const denied = await promotionRequestHttp(
      new Request('https://cheapeats.local/api/promotion-request', { method: 'GET' }),
      { env, now },
    )
    assert.equal(denied.status, 405)
    assert.equal(denied.headers.Allow, 'POST')

    const broken = await promotionRequestHttp(
      new Request('https://cheapeats.local/api/promotion-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      { env, now },
    )
    assert.equal(broken.status, 400)
    assert.equal(broken.body.error, 'invalid-json')

    const { fetchImpl, calls } = mockFetch()
    const accepted = await promotionRequestHttp(
      new Request('https://cheapeats.local/api/promotion-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload({ email: 'http@example.com' })),
      }),
      { env, fetchImpl, now },
    )
    assert.equal(accepted.status, 200)
    assert.equal(accepted.body.accepted, true)
    assert.equal(accepted.body.paid, false)
    assert.equal(calls[0].body.text.includes('12345'), false)

    const wrapped = await handler.fetch(
      new Request('https://cheapeats.local/api/promotion-request', { method: 'PUT' }),
    )
    assert.equal(wrapped.status, 405)
    assert.equal((await wrapped.json()).accepted, false)
  })
})
