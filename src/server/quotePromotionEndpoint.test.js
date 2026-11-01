/**
 * Lokální test HTTP obsluhy v Node přes Fetch API.
 * Nespouští Vercel a neověřuje, že je endpoint nasazený.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import handler, { quotePromotionHttp } from './quotePromotion.js'

const CASES = [
  ['start', 'mesicne', 99, 990, 99, 0],
  ['start', 'rocne', 99, 990, 990, 198],
  ['plus', 'mesicne', 199, 1990, 199, 0],
  ['plus', 'rocne', 199, 1990, 1990, 398],
  ['premium', 'mesicne', 399, 3990, 399, 0],
  ['premium', 'rocne', 399, 3990, 3990, 798],
]

function post(body, { raw, contentType = 'application/json' } = {}) {
  return handler.fetch(
    new Request('https://cheapeats.local/api/quote-promotion', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: raw === undefined ? JSON.stringify(body) : raw,
    }),
  )
}

describe('POST /api/quote-promotion', () => {
  it('spočítá všech šest kombinací z cenové tabulky', async () => {
    for (const [planId, periodId, monthly, yearly, amount, savings] of CASES) {
      const response = await post({ planId, periodId })
      const body = await response.json()
      assert.equal(response.status, 200)
      assert.equal(body.ok, true)
      assert.equal(body.planId, planId)
      assert.equal(body.periodId, periodId)
      assert.equal(body.monthly, monthly)
      assert.equal(body.yearly, yearly)
      assert.equal(body.amount, amount)
      assert.equal(body.savings, savings)
      assert.equal(body.currency, 'CZK')
    }
  })

  it('odmítne neznámý balíček, neznámé období, špatný JSON, chybějící pole i jinou metodu', async () => {
    const unknownPlan = await post({ planId: 'vip', periodId: 'mesicne' })
    assert.equal(unknownPlan.status, 400)
    assert.equal((await unknownPlan.json()).error, 'unknown-plan')

    const unknownPeriod = await post({ planId: 'plus', periodId: 'rocni' })
    assert.equal(unknownPeriod.status, 400)
    assert.equal((await unknownPeriod.json()).error, 'unknown-period')

    const broken = await post(undefined, { raw: '{' })
    assert.equal(broken.status, 400)
    assert.equal((await broken.json()).error, 'invalid-json')

    for (const raw of ['null', '[]', '1', '"plus"']) {
      const response = await post(undefined, { raw })
      assert.equal(response.status, 400)
      assert.equal((await response.json()).error, 'invalid-json')
    }

    const text = await post({ planId: 'plus', periodId: 'mesicne' }, { contentType: 'text/plain' })
    assert.equal(text.status, 400)
    assert.equal((await text.json()).error, 'invalid-json')

    const charset = await post(
      { planId: 'start', periodId: 'mesicne' },
      { contentType: 'application/json; charset=utf-8' },
    )
    assert.equal(charset.status, 200)
    assert.equal((await charset.json()).amount, 99)

    const empty = await post({})
    assert.equal(empty.status, 400)
    assert.deepEqual(await empty.json(), {
      ok: false,
      error: 'missing-field',
      field: 'planId',
      message: 'Chybí planId.',
    })

    const noPeriod = await post({ planId: 'premium' })
    assert.equal(noPeriod.status, 400)
    assert.equal((await noPeriod.json()).field, 'periodId')

    const blank = await post({ planId: '', periodId: 'mesicne' })
    assert.equal(blank.status, 400)
    assert.equal((await blank.json()).field, 'planId')

    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      const response = await handler.fetch(
        new Request('https://cheapeats.local/api/quote-promotion', { method }),
      )
      assert.equal(response.status, 405)
      assert.equal(response.headers.get('allow'), 'POST')
      assert.equal((await response.json()).error, 'method-not-allowed')
    }
  })

  it('podvržená částka nezmění cenu', async () => {
    for (const [planId, periodId, monthly, yearly, amount, savings] of CASES) {
      const response = await post({
        planId,
        periodId,
        amount: 12345,
        price: 12345,
        monthlyPrice: 12345,
        yearly: 1,
        savings: 1,
        currency: 'EUR',
      })
      const body = await response.json()
      assert.equal(response.status, 200)
      assert.equal(body.monthly, monthly)
      assert.equal(body.yearly, yearly)
      assert.equal(body.amount, amount)
      assert.equal(body.savings, savings)
      assert.equal(body.currency, 'CZK')
      assert.equal(JSON.stringify(body).includes('12345'), false)
      assert.equal(JSON.stringify(body).includes('EUR'), false)
    }
  })

  it('interní chybu vrátí bez textu výjimky', async () => {
    const response = await quotePromotionHttp(
      new Request('https://cheapeats.local/api/quote-promotion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planId: 'plus', periodId: 'mesicne' }),
      }),
      () => {
        throw new Error('TAJNY_VYPIS_databaze')
      },
    )
    const text = await response.text()
    assert.equal(response.status, 500)
    assert.equal(text.includes('TAJNY_VYPIS_databaze'), false)
    assert.deepEqual(JSON.parse(text), {
      ok: false,
      error: 'internal-error',
      message: 'Cenu se nepodařilo spočítat.',
    })
  })
})
