import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { categoryOverrides } from '../data/categoryOverrides.js'
import { curatedPlaces } from '../data/curatedPlaces.js'
import { estimatedPrices } from '../data/estimatedPrices.js'
import { osmFacts } from '../data/osmFacts.js'
import { osmPlaces } from '../data/osmPlaces.js'
import { verifiedPrices } from '../data/verifiedPrices.js'
import { filterAndSortRestaurants } from './filterRestaurants.js'
import { foldSearchText } from './smartSearch.js'
import { getVerifiedPriceCeiling, hasEstimatePrice, hasVerifiedPrice } from './price.js'

function catalog() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  }
  return [...byId.values()].map((entry) => {
    const override = categoryOverrides[entry.id]
    return {
      ...entry,
      ...(estimatedPrices[entry.id] || {}),
      ...(verifiedPrices[entry.id] || {}),
      ...(osmFacts[entry.id] || {}),
      category: override?.category || entry.category,
      type: override?.type || entry.type,
      description: override?.description || entry.description,
    }
  })
}

const places = catalog()

function ids(query, extra = {}) {
  return filterAndSortRestaurants(places, { search: query, sortBy: 'relevance', ...extra }).map(
    (item) => item.id,
  )
}

function unique(list) {
  return new Set(list).size === list.length
}

describe('hledání nad katalogem', () => {
  it('najde kuchyně, ulici, název a překlep bez falešných slov', () => {
    for (const query of ['pizza', 'burger', 'kebab', 'sushi', 'kavárna', 'kavarna']) {
      const matched = ids(query)
      assert.ok(matched.length > 0, query)
      assert.equal(unique(matched), true, query)
    }
    assert.equal(ids('pizza').includes('gelateria-piazza-namesti-svobody-9'), false)
    assert.equal(ids('piza').includes('gelateria-piazza-namesti-svobody-9'), false)
    const kings = filterAndSortRestaurants(places, { search: 'Burger King', sortBy: 'name' })
    assert.ok(kings.length >= 5)
    assert.ok(kings.every((item) => foldSearchText(item.name) === 'burger king'))
    assert.equal(kings.some((item) => item.id === 'let-s-steaking-dominikanska-3'), false)
    assert.equal(ids('Prime Steak').includes('prime-steak-palackeho-trida-162'), true)
    const street = ids('Pekařská')
    assert.ok(street.length > 0)
    assert.deepEqual(street, ids('pekarska'))
    assert.ok(street.every((id) => foldSearchText(places.find((item) => item.id === id).address).includes('pekarska')))
  })

  it('cenový dotaz bere jen ověřenou cenu a bez masa není burger s jednou položkou', () => {
    const under150 = filterAndSortRestaurants(places, { search: 'jídlo do 150 Kč' })
    assert.ok(under150.length > 0)
    for (const place of under150) {
      assert.equal(hasVerifiedPrice(place), true, place.id)
      assert.equal(hasEstimatePrice(place), false, place.id)
      assert.ok(getVerifiedPriceCeiling(place) <= 150, place.id)
    }
    const pizza200 = filterAndSortRestaurants(places, { search: 'pizza do 200 Kč' })
    assert.ok(pizza200.length > 0)
    for (const place of pizza200) {
      assert.equal(place.category, 'pizza', place.id)
      assert.equal(hasVerifiedPrice(place), true, place.id)
      assert.ok(getVerifiedPriceCeiling(place) <= 200, place.id)
    }
    const meatFree = ids('bez masa')
    assert.ok(meatFree.includes('dhaba-beas-panska'))
    assert.equal(meatFree.some((id) => id.startsWith('burger-king-')), false)
    const vegan = ids('vegan')
    assert.ok(vegan.length > 0)
    assert.equal(unique(vegan), true)
  })

  it('kebab v lokalitě nevrátí jinou kuchyni a oběd neslibuje menu, které v datech není', () => {
    const local = filterAndSortRestaurants(places, { search: 'kebab Královo Pole' })
    assert.ok(local.every((place) => place.category === 'kebab'))
    assert.ok(
      local.every((place) => foldSearchText(`${place.name} ${place.address}`).includes('kralovo')),
    )
    const lunch = filterAndSortRestaurants(places, { search: 'levný oběd' })
    for (const place of lunch) {
      assert.equal(place.lunchMenu, true, place.id)
      assert.equal(hasVerifiedPrice(place), true, place.id)
      assert.ok(getVerifiedPriceCeiling(place) <= 120, place.id)
    }
  })
})
