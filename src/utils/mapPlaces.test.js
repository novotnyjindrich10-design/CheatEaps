import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { GOOGLE_STATUS_NEEDS_REVIEW, GOOGLE_STATUS_VERIFIED } from './googleRating.js'
import { boundsFromPlaces, placesFingerprint, placesForMap, pickVisibleLabels, escapeMapLabel } from './mapPlaces.js'

describe('mapPlaces', () => {
  it('vynechá neplatné a mimo Brno souřadnice', () => {
    const places = placesForMap([
      { id: 'ok', name: 'OK', lat: 49.2, lon: 16.6 },
      { id: 'missing', name: 'X' },
      { id: 'prague', name: 'Praha', lat: 50.08, lon: 14.42 },
      { id: 'nan', name: 'NaN', lat: Number.NaN, lon: 16.6 },
    ])
    assert.deepEqual(
      places.map((row) => row.id),
      ['ok'],
    )
  })

  it('označí sponzorované body a připraví cenu do popupu', () => {
    const [place] = placesForMap([
      {
        id: 's',
        name: 'S',
        lat: 49.2,
        lon: 16.6,
        sponsored: true,
        price: 149,
        priceKind: 'menu',
        priceVerified: true,
        priceVerifiedAt: '2026-10-10',
        priceSource: 'https://example.com',
      },
    ])
    assert.equal(place.sponsored, true)
    assert.match(String(place.priceLabel || ''), /149/)
  })

  it('fingerprint je stabilní bez ohledu na pořadí', () => {
    assert.equal(
      placesFingerprint([
        { id: 'b' },
        { id: 'a' },
      ]),
      placesFingerprint([{ id: 'a' }, { id: 'b' }]),
    )
    assert.equal(placesFingerprint([]), '')
  })

  it('karta má kuchyni, ověřenou cenu, hodnocení a navigaci jen na cíl', () => {
    const [hidden, shown] = placesForMap([
      {
        id: 'hidden',
        name: 'Bez ověření',
        lat: 49.2,
        lon: 16.61,
        category: 'pizza',
        price: 99,
        priceVerified: false,
        googleRating: 4.9,
        googleRatingStatus: GOOGLE_STATUS_NEEDS_REVIEW,
        distanceKm: 0.4,
        distanceState: 'air',
        foodIllustrationKind: 'pixabay',
        foodIllustrationUrl: 'javascript:alert(1)',
      },
      {
        id: 'shown',
        name: 'S ověřením',
        lat: 49.21,
        lon: 16.62,
        category: 'kava',
        price: 89,
        priceKind: 'menu',
        priceVerified: true,
        priceVerifiedAt: '2026-10-10',
        priceSource: 'https://example.com',
        googleRating: 4.5,
        googleRatingStatus: GOOGLE_STATUS_VERIFIED,
        googleReviewCount: 12,
        distanceKm: 1.2,
        distanceState: 'air',
        foodIllustrationKind: 'pixabay',
        foodIllustrationUrl: 'https://cdn.example/food.jpg',
        foodIllustrationAlt: 'Ilustrace kávy',
      },
    ])
    assert.equal(hidden.priceLabel, '')
    assert.equal(hidden.ratingLabel, '')
    assert.equal(hidden.photoUrl, '')
    assert.equal(hidden.cuisineLabel, 'Pizza')
    assert.match(hidden.distanceLabel, /m/)
    assert.equal(hidden.detailPath, '/restaurant/hidden')
    assert.match(hidden.navigateUrl, /openstreetmap\.org/)
    assert.equal(hidden.navigateUrl.includes('48.1'), false)
    assert.match(shown.priceLabel, /89/)
    assert.match(shown.ratingLabel, /Google/)
    assert.equal(shown.photoUrl, 'https://cdn.example/food.jpg')
    assert.equal(shown.cuisineLabel, 'Kavárny')
    assert.match(shown.navigateUrl, /49\.21/)
  })

  it('prázdný výsledek nemá bounds', () => {
    assert.equal(boundsFromPlaces([]), null)
    assert.ok(boundsFromPlaces([{ id: 'a', lat: 49.2, lon: 16.6 }]))
  })

  it('popisky blízko sebe schová a vybraný bod nechá', () => {
    const visible = pickVisibleLabels([
      { id: 'a', x: 0, y: 0, priority: 1 },
      { id: 'b', x: 10, y: 0, priority: 1 },
      { id: 'c', x: 200, y: 0, priority: 1 },
      { id: 'vybrany', x: 8, y: 4, priority: 3 },
    ])
    assert.equal(visible.includes('vybrany'), true)
    assert.equal(visible.includes('a'), false)
    assert.equal(visible.includes('b'), false)
    assert.equal(visible.includes('c'), true)
    assert.equal(escapeMapLabel('<b>"A"&'), '&lt;b&gt;&quot;A&quot;&amp;')
  })
})
