import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PRICE_KIND_ESTIMATE,
  PRICE_KIND_MENU,
  PRICE_KIND_RANGE,
  getBudgetComparePrice,
  getVerifiedPriceCeiling,
  hasVerifiedPrice,
} from './price.js'

const SOURCE = 'https://example.com/menu'
const VERIFIED_AT = '2026-10-10'

function menu(price, extra = {}) {
  return {
    name: 'Menu',
    price,
    priceKind: PRICE_KIND_MENU,
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
    ...extra,
  }
}

function range(min, max, extra = {}) {
  return {
    name: 'Range',
    price: min,
    priceMax: max,
    priceKind: PRICE_KIND_RANGE,
    priceEstimate: true,
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
    ...extra,
  }
}

function estimate(min, max) {
  return {
    name: 'Estimate',
    price: min,
    priceMax: max,
    priceKind: PRICE_KIND_ESTIMATE,
  }
}

describe('getBudgetComparePrice', () => {
  it('u rozmezí bere dolní doloženou cenu, ne horní', () => {
    const place = range(120, 300)
    assert.equal(hasVerifiedPrice(place), true)
    assert.equal(getBudgetComparePrice(place), 120)
    assert.equal(getVerifiedPriceCeiling(place), 300)
  })

  it('u konkrétní ceny bere tu cenu', () => {
    assert.equal(getBudgetComparePrice(menu(149)), 149)
    assert.equal(getBudgetComparePrice(menu(151)), 151)
  })

  it('neověřený odhad filtr nesplní, i když je nízký', () => {
    assert.equal(getBudgetComparePrice(estimate(80, 120)), null)
    assert.equal(hasVerifiedPrice(estimate(80, 120)), false)
  })

  it('bez zdroje menu nebo bez čísla cenu nevymyslí', () => {
    assert.equal(getBudgetComparePrice(menu(120, { priceSource: '' })), null)
    assert.equal(getBudgetComparePrice({ price: 100, note: 'od 90 Kč' }), null)
    assert.equal(getBudgetComparePrice(range(120, 100)), null)
  })
})
