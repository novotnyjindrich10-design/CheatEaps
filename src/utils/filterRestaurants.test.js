import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FOOD_CATEGORIES } from '../constants/filters.js'
import { filterAndSortRestaurants } from './filterRestaurants.js'

const SOURCE = 'https://example.com/menu'
const VERIFIED_AT = '2026-10-10'

function place(id, extra) {
  return {
    id,
    name: id,
    type: 'Test',
    category: 'pizza',
    description: '',
    address: 'Brno',
    ...extra,
  }
}

function menu(id, price) {
  return place(id, {
    price,
    priceKind: 'menu',
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
  })
}

function range(id, min, max) {
  return place(id, {
    price: min,
    priceMax: max,
    priceKind: 'range',
    priceEstimate: true,
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
  })
}

function ids(list, budget) {
  return filterAndSortRestaurants(list, { maxBudget: String(budget), sortBy: 'rating' }).map(
    (item) => item.id,
  )
}

describe('filtr maximální ceny', () => {
  const places = [
    range('range-under', 120, 300),
    range('range-over', 180, 300),
    range('range-edge', 150, 300),
    menu('menu-149', 149),
    menu('menu-150', 150),
    menu('menu-151', 151),
    place('estimate', {
      price: 90,
      priceMax: 140,
      priceKind: 'estimate',
    }),
    place('no-price', { description: 'hlavní jídlo od 100 Kč' }),
  ]

  it('rozmezí 120–300 se při limitu 150 zobrazí, 180–300 ne', () => {
    const matched = ids(places, 150)
    assert.ok(matched.includes('range-under'))
    assert.equal(matched.includes('range-over'), false)
  })

  it('konkrétní cena 149 a 150 projde, 151 ne', () => {
    const matched = ids(places, 150)
    assert.ok(matched.includes('menu-149'))
    assert.ok(matched.includes('menu-150'))
    assert.equal(matched.includes('menu-151'), false)
  })

  it('dolní mez přesně na limitu projde', () => {
    assert.ok(ids(places, 150).includes('range-edge'))
    assert.equal(ids(places, 149).includes('range-edge'), false)
  })

  it('samotný odhad ani text v popisu filtr nesplní', () => {
    const matched = ids(places, 150)
    assert.equal(matched.includes('estimate'), false)
    assert.equal(matched.includes('no-price'), false)
  })

  it('bez cenového filtru odhad v seznamu zůstane', () => {
    const matched = filterAndSortRestaurants(places, { maxBudget: '' }).map((item) => item.id)
    assert.ok(matched.includes('estimate'))
    assert.ok(matched.includes('no-price'))
  })
})

describe('hledání restaurace', () => {
  it('hledá název a adresu, ne samotný typ jídla', () => {
    const places = [
      place('type-only', {
        name: 'La Strada',
        type: 'Pizza',
        category: 'pizza',
        description: 'nejlepší pizza',
        address: 'Česká',
      }),
      place('named', { name: 'Pizza Bistro', type: 'Burger', category: 'burger', address: 'Veveří' }),
      place('street', { name: 'U Lípy', type: 'Česká', category: 'ceske', address: 'Pekařská 12' }),
    ]
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'pizza' }).map((item) => item.id),
      ['named'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'pekařská' }).map((item) => item.id),
      ['street'],
    )
  })
})

describe('filtr a řazení vzdálenosti', () => {
  const places = [
    place('near', { distanceKm: 1.2 }),
    place('edge', { distanceKm: 2 }),
    place('far', { distanceKm: 2.4 }),
    place('unknown', { distanceKm: null }),
  ]

  it('při zapnuté poloze bere jen známou vzdálenost v limitu', () => {
    const matched = filterAndSortRestaurants(places, {
      maxDistance: '2',
      hasOrigin: true,
      sortBy: 'distance',
    }).map((item) => item.id)
    assert.deepEqual(matched, ['near', 'edge'])
  })

  it('bez polohy filtr vzdálenosti seznam neomezí', () => {
    const matched = filterAndSortRestaurants(places, { maxDistance: '2', hasOrigin: false }).map(
      (item) => item.id,
    )
    assert.equal(matched.length, 4)
  })

  it('neznámou vzdálenost řadí nakonec', () => {
    const matched = filterAndSortRestaurants(places, { sortBy: 'distance', hasOrigin: true }).map(
      (item) => item.id,
    )
    assert.deepEqual(matched, ['near', 'edge', 'far', 'unknown'])
  })
})

describe('kategorie', () => {
  const places = [
    place('pizza', { category: 'pizza', name: 'Pizzerie' }),
    place('burger', { category: 'burger', name: 'Burger bar' }),
    place('veganske', { category: 'veganske', name: 'Vegan bistro' }),
  ]

  it('každá kategorie vrátí jen své podniky', () => {
    for (const value of ['pizza', 'burger', 'veganske']) {
      const matched = filterAndSortRestaurants(places, { cuisineType: value }).map((item) => item.id)
      assert.deepEqual(matched, [value])
    }
  })

  it('filtruje všechna tlačítka kategorií', () => {
    const all = FOOD_CATEGORIES.map((category) =>
      place(category.value, { category: category.value, name: category.label }),
    )
    for (const category of FOOD_CATEGORIES) {
      const matched = filterAndSortRestaurants(all, { cuisineType: category.value }).map((item) => item.id)
      assert.deepEqual(matched, [category.value])
    }
  })
})
