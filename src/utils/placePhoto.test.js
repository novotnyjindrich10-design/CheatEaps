import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  foodIllustration,
  licenseLabel,
  needsAttribution,
  officialHero,
  resolveDetailHero,
} from './placePhoto.js'

describe('placePhoto', () => {
  it('officialHero vyžaduje kind official a URL', () => {
    assert.equal(officialHero({ heroImageKind: 'official' }), null)
    assert.equal(officialHero({ heroImageUrl: '/x.jpg' }), null)
    const photo = officialHero({
      name: 'Test',
      heroImageKind: 'official',
      heroImageUrl: '/official.jpg',
      heroImageAlt: 'Oficiální jídlo',
    })
    assert.equal(photo.kind, 'official')
    assert.equal(photo.url, '/official.jpg')
    assert.equal(photo.alt, 'Oficiální jídlo')
  })

  it('foodIllustration vyžaduje openverse kind a URL', () => {
    assert.equal(foodIllustration({ foodIllustrationKind: 'openverse' }), null)
    assert.equal(foodIllustration({ foodIllustrationUrl: '/f.jpg' }), null)
    const photo = foodIllustration({
      name: 'Pizzerie',
      foodIllustrationKind: 'openverse',
      foodIllustrationUrl: '/food-illustrations/x.jpg',
      foodIllustrationDish: 'pizza',
      foodIllustrationLicense: 'cc0',
      foodIllustrationSourceUrl: 'https://example.com/source',
    })
    assert.equal(photo.kind, 'illustration')
    assert.equal(photo.url, '/food-illustrations/x.jpg')
    assert.match(photo.alt, /Ilustrační/)
    assert.match(photo.alt, /pizza/)
  })

  it('resolveDetailHero dává přednost oficiální fotce před ilustrací', () => {
    const restaurant = {
      name: 'Test',
      heroImageKind: 'official',
      heroImageUrl: '/official.jpg',
      foodIllustrationKind: 'openverse',
      foodIllustrationUrl: '/food-illustrations/x.jpg',
      foodIllustrationDish: 'pizza',
    }
    assert.equal(resolveDetailHero(restaurant).kind, 'official')
    assert.equal(resolveDetailHero(restaurant).url, '/official.jpg')
  })

  it('resolveDetailHero použije ilustraci, když oficiální chybí', () => {
    const restaurant = {
      name: 'Test',
      foodIllustrationKind: 'openverse',
      foodIllustrationUrl: '/food-illustrations/x.jpg',
      foodIllustrationDish: 'burger',
      foodIllustrationLicense: 'by',
      foodIllustrationCreator: 'Autor',
    }
    const photo = resolveDetailHero(restaurant)
    assert.equal(photo.kind, 'illustration')
    assert.equal(photo.dish, 'burger')
    assert.equal(photo.creator, 'Autor')
  })

  it('resolveDetailHero vrátí null bez fotografie (fallback na SVG kuchyni)', () => {
    assert.equal(resolveDetailHero({ name: 'Bez fotky' }), null)
    assert.equal(resolveDetailHero(null), null)
  })

  it('licence a atribuce', () => {
    assert.equal(licenseLabel('cc0'), 'CC0')
    assert.equal(licenseLabel('pdm'), 'Public Domain')
    assert.equal(licenseLabel('by'), 'CC BY')
    assert.equal(licenseLabel('by-sa'), 'CC BY-SA')
    assert.equal(needsAttribution('cc0'), false)
    assert.equal(needsAttribution('pdm'), false)
    assert.equal(needsAttribution('by'), true)
    assert.equal(needsAttribution('by-sa'), true)
  })
})
