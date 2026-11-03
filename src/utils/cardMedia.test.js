import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveCardMedia } from './cardMedia.js'

describe('media na kartě', () => {
  it('upřednostní oficiální foto před ilustrací', () => {
    const media = resolveCardMedia({
      heroImageKind: 'official',
      heroImageUrl: 'https://example.cz/a.jpg',
      foodIllustrationKind: 'openverse',
      foodIllustrationUrl: 'https://example.cz/b.jpg',
    })
    assert.equal(media.kind, 'official')
    assert.equal(media.url, 'https://example.cz/a.jpg')
  })

  it('ilustrace z Pixabay nahradí nedoložený hotlink z webu podniku', () => {
    const media = resolveCardMedia({
      heroImageKind: 'official',
      heroImageUrl: 'https://example.cz/og.jpg',
      foodIllustrationKind: 'pixabay',
      foodIllustrationUrl: '/food-illustrations/pixabay/1.jpg',
      foodIllustrationDish: 'burger',
      foodIllustrationPixabayId: 1,
    })
    assert.equal(media.kind, 'illustration')
    assert.equal(media.provider, 'pixabay')
    assert.equal(media.url, '/food-illustrations/pixabay/1.jpg')
  })

  it('bez fotky vrátí null', () => {
    assert.equal(resolveCardMedia({ name: 'Test' }), null)
  })
})
