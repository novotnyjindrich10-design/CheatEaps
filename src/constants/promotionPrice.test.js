/**
 * Testy čisté funkce quoteTrustedPrice v Node.
 * Neověřují server, databázi ani to, že prohlížeč nemůže cenu obejít.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { quotePlan, reviewOrder } from './businessPlans.js'
import { quoteTrustedPrice, yearlySavings } from './promotionPrice.js'

const CASES = [
  ['start', 'mesicne', 99, 990, 99, 0],
  ['start', 'rocne', 99, 990, 990, 198],
  ['plus', 'mesicne', 199, 1990, 199, 0],
  ['plus', 'rocne', 199, 1990, 1990, 398],
  ['premium', 'mesicne', 399, 3990, 399, 0],
  ['premium', 'rocne', 399, 3990, 3990, 798],
]

const draft = {
  businessName: 'Bistro Test',
  contactName: 'Anna Nová',
  email: 'anna@example.com',
  planId: 'plus',
  periodId: 'mesicne',
  website: '',
  description: '',
  socials: '',
  extra: '',
  photos: [],
}

describe('důvěryhodná cena propagace', () => {
  it('spočítá všechny balíčky, období a roční úsporu', () => {
    for (const [planId, periodId, monthly, yearly, amount, savings] of CASES) {
      const quote = quoteTrustedPrice(planId, periodId)
      assert.equal(quote.ok, true)
      assert.equal(quote.planId, planId)
      assert.equal(quote.periodId, periodId)
      assert.equal(quote.monthly, monthly)
      assert.equal(quote.yearly, yearly)
      assert.equal(quote.amount, amount)
      assert.equal(quote.savings, savings)
      assert.equal(quote.currency, 'CZK')
    }
    assert.equal(yearlySavings(99), 198)
    assert.equal(yearlySavings(199), 398)
    assert.equal(yearlySavings(399), 798)
  })

  it('odmítne neznámý balíček i období a nevrátí částku', () => {
    for (const planId of ['vip', 'Start', 'plus ', '', null, undefined, 199, { id: 'plus' }]) {
      const quote = quoteTrustedPrice(planId, 'mesicne')
      assert.equal(quote.ok, false)
      assert.equal(quote.error, 'unknown-plan')
      assert.equal(Object.hasOwn(quote, 'amount'), false)
    }
    for (const periodId of ['rocni', 'yearly', 'Rocne', 'mesicne ', '', null, undefined]) {
      const quote = quoteTrustedPrice('plus', periodId)
      assert.equal(quote.ok, false)
      assert.equal(quote.error, 'unknown-period')
      assert.equal(Object.hasOwn(quote, 'amount'), false)
    }
  })

  it('ignoruje cenu dodanou volajícím', () => {
    const quoted = quoteTrustedPrice('premium', 'rocne', 1, { amount: 1, monthlyPrice: 1 })
    assert.equal(quoted.amount, 3990)
    assert.equal(quoted.savings, 798)
    assert.equal(quoted.monthly, 399)

    const forged = { id: 'start', monthlyPrice: 1, amount: 1, price: 1 }
    const planQuote = quotePlan(forged, 'rocne')
    assert.equal(planQuote.amount, 990)
    assert.equal(planQuote.monthly, 99)
    assert.equal(planQuote.savings, 198)

    assert.throws(() => quotePlan({ id: 'vip', monthlyPrice: 99 }, 'mesicne'), /Neznámý balíček/)

    const review = reviewOrder({ ...draft, amount: 1, price: 1, monthlyPrice: 1 })
    assert.equal(review.ok, true)
    assert.equal(review.summary.priceText, '199 Kč za měsíc')
  })
})
