import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PRICE_KIND_ESTIMATE,
  PRICE_KIND_MENU,
  PRICE_KIND_RANGE,
  compareByPrice,
  formatCardPrice,
  getBudgetComparePrice,
  getVerifiedPriceCeiling,
  getVerifiedPriceFloor,
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
  it('u rozmezí bere horní doloženou cenu, ne dolní', () => {
    const place = range(120, 300)
    assert.equal(hasVerifiedPrice(place), true)
    assert.equal(getBudgetComparePrice(place), 300)
    assert.equal(getVerifiedPriceCeiling(place), 300)
    assert.equal(getVerifiedPriceFloor(place), 120)
  })

  it('u konkrétní ceny bere tu cenu', () => {
    assert.equal(getBudgetComparePrice(menu(149)), 149)
    assert.equal(getBudgetComparePrice(menu(151)), 151)
    assert.equal(getVerifiedPriceFloor(menu(149)), 149)
    assert.equal(getVerifiedPriceCeiling(menu(149)), 149)
  })

  it('neověřený odhad filtr nesplní, i když je nízký', () => {
    assert.equal(getBudgetComparePrice(estimate(80, 120)), null)
    assert.equal(getVerifiedPriceFloor(estimate(80, 120)), null)
    assert.equal(getVerifiedPriceCeiling(estimate(80, 120)), null)
    assert.equal(hasVerifiedPrice(estimate(80, 120)), false)
  })

  it('bez zdroje menu nebo bez čísla cenu nevymyslí', () => {
    assert.equal(getBudgetComparePrice(menu(120, { priceSource: '' })), null)
    assert.equal(getBudgetComparePrice({ price: 100, note: 'od 90 Kč' }), null)
    assert.equal(getBudgetComparePrice(range(120, 100)), null)
  })

  it('štítek rozliší ověřenou cenu a odhad', () => {
    assert.equal(formatCardPrice(range(120, 300)).status, 'Ověřeno')
    assert.equal(formatCardPrice(range(120, 300)).primary, '120–300 Kč')
    assert.equal(formatCardPrice(estimate(80, 120)).status, 'Odhad')
    assert.match(formatCardPrice(estimate(80, 120)).primary, /^~/)
    assert.equal(formatCardPrice({ name: 'Bez ceny' }).status, 'Neověřeno')
  })
})

describe('compareByPrice', () => {
  it('u rozmezí řadí podle dolní meze a odděluje to od limitu rozpočtu', () => {
    const cheapRange = range(95, 169)
    const midMenu = menu(150)
    const wideCheapFloor = range(120, 360)
    const ordered = [midMenu, wideCheapFloor, cheapRange].sort((a, b) => compareByPrice(a, b, 'asc'))
    assert.deepEqual(
      ordered.map((place) => place.price),
      [95, 120, 150],
    )
    assert.equal(getBudgetComparePrice(cheapRange) <= 150, false)
    assert.equal(getBudgetComparePrice(wideCheapFloor) <= 150, false)
    assert.equal(getBudgetComparePrice(midMenu) <= 150, true)
  })

  it('ověřené řadí před odhady a neznámou cenou', () => {
    const ordered = [
      estimate(80, 100),
      { name: 'Bez ceny' },
      menu(200),
      range(90, 110),
    ].sort((a, b) => compareByPrice(a, b, 'asc'))
    assert.equal(ordered[0].priceKind, PRICE_KIND_RANGE)
    assert.equal(ordered[1].priceKind, PRICE_KIND_MENU)
    assert.equal(ordered[2].priceKind, PRICE_KIND_ESTIMATE)
    assert.equal(ordered[3].priceKind, undefined)
  })
})
