import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { compareByRecordQuality, recordQualityParts, recordQualityScore } from './recordQuality.js'

const SOURCE = 'https://example.com/menu'
const WEB = 'https://example.com/'

function place(extra) {
  return {
    id: 'a',
    name: 'Podnik',
    category: 'pizza',
    address: 'Panská 12, 602 00 Brno',
    lat: 49.2,
    lon: 16.61,
    description: 'Záznam z OpenStreetMap (restaurace).',
    ...extra,
  }
}

function verified(extra) {
  return place({
    price: 169,
    priceKind: 'menu',
    priceSource: SOURCE,
    priceVerifiedAt: '2026-10-29',
    ...extra,
  })
}

describe('kvalita záznamu', () => {
  it('ověřená cena je nad odhadem', () => {
    const documented = verified()
    const estimate = place({ price: 99, priceMax: 149, priceKind: 'estimate' })
    assert.ok(recordQualityScore(documented) > recordQualityScore(estimate))
    assert.equal(recordQualityParts(estimate).price, 0)
  })

  it('oficiální fotka je nad ilustrací jídla a chybějící obrázek má nulu', () => {
    const official = place({
      heroImageKind: 'official',
      heroImageUrl: 'https://example.com/jidlo.jpg',
    })
    const food = place({
      foodIllustrationKind: 'openverse',
      foodIllustrationUrl: '/food-illustrations/shared/pizza.jpg',
    })
    const missing = place({ imageUrl: 'https://images.unsplash.com/photo-1' })
    const broken = place({ heroImageKind: 'official', heroImageUrl: 'javascript:alert(1)' })
    assert.ok(recordQualityParts(official).photo > recordQualityParts(food).photo)
    assert.equal(recordQualityParts(food).photo > 0, true)
    assert.equal(recordQualityParts(missing).photo, 0)
    assert.equal(recordQualityParts(broken).photo, 0)
  })

  it('neověřené hodnocení a sociální síť body nepřidají', () => {
    const bare = place()
    const mapsOnly = place({
      googleRating: 4.8,
      googleReviewCount: 400,
      googleRatingStatus: 'maps_search',
      website: 'https://facebook.com/podnik',
    })
    assert.equal(recordQualityParts(mapsOnly).rating, 0)
    assert.equal(recordQualityScore(mapsOnly), recordQualityScore(bare))
  })

  it('ověřené hodnocení roste s počtem recenzí a zůstane pod ověřenou cenou', () => {
    const few = place({
      googleRating: 4,
      googleReviewCount: 3,
      googleRatingStatus: 'verified',
    })
    const many = place({
      googleRating: 4,
      googleReviewCount: 120,
      googleRatingStatus: 'verified',
    })
    const priced = verified()
    assert.ok(recordQualityParts(many).rating > recordQualityParts(few).rating)
    assert.ok(recordQualityScore(priced) > recordQualityScore(many))
  })

  it('skutečný popis a web jsou nad obecným zápisem z mapy', () => {
    const osm = place()
    const documented = place({
      description:
        'Veganské bistro s burgery a seitanovým kebabem. Burger na oficiálním menu od 169 Kč.',
      officialWebsite: WEB,
    })
    assert.ok(recordQualityParts(documented).information > recordQualityParts(osm).information)
    assert.equal(recordQualityParts(place({ category: 'neuvedeno' })).other < recordQualityParts(osm).other, true)
  })

  it('řazení dává výš úplnější záznam', () => {
    const rich = verified({
      id: 'rich',
      name: 'Z',
      officialWebsite: WEB,
      heroImageKind: 'official',
      heroImageUrl: 'https://example.com/jidlo.jpg',
      description: 'Sezonní bistro s snídaněmi, obědy a výběrovou kávou na Veveří.',
    })
    const thin = place({ id: 'thin', name: 'A', price: 80, priceMax: 120, priceKind: 'estimate' })
    assert.deepEqual([thin, rich].sort(compareByRecordQuality).map((item) => item.id), ['rich', 'thin'])
  })
})
