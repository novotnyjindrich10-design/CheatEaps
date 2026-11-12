import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  foodIllustration,
  licenseLabel,
  needsAttribution,
  officialHero,
  resolveDetailHero,
  googlePlacesPhoto,
  shareImageUrl,
  toMediaRecord,
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

  it('nedoložená fotka z webu ustoupí ilustraci z Pixabay', () => {
    const restaurant = {
      name: 'Test',
      heroImageKind: 'official',
      heroImageUrl: 'https://example.cz/og.jpg',
      foodIllustrationKind: 'pixabay',
      foodIllustrationUrl: '/food-illustrations/pixabay/1.jpg',
      foodIllustrationDetailUrl: '/food-illustrations/pixabay/1.jpg',
      foodIllustrationDish: 'pizza',
      foodIllustrationPixabayId: 1,
      foodIllustrationLicense: 'pixabay',
    }
    const photo = resolveDetailHero(restaurant)
    assert.equal(photo.provider, 'pixabay')
    assert.equal(photo.kind, 'illustration')
    assert.match(photo.alt, /Ilustrační/)
    assert.match(photo.alt, /pizza/)
  })

  it('doložená oficiální fotka má přednost před Pixabay', () => {
    const photo = resolveDetailHero({
      name: 'Test',
      heroImageKind: 'official',
      heroImageRights: 'documented',
      heroImageUrl: 'https://example.cz/oficialni.jpg',
      foodIllustrationKind: 'pixabay',
      foodIllustrationUrl: '/food-illustrations/pixabay/1.jpg',
      foodIllustrationDish: 'pizza',
    })
    assert.equal(photo.kind, 'official')
    assert.equal(photo.rights, 'documented')
    assert.equal(photo.url, 'https://example.cz/oficialni.jpg')
  })

  it('licence a atribuce', () => {
    assert.equal(licenseLabel('cc0'), 'CC0')
    assert.equal(licenseLabel('pdm'), 'Public Domain')
    assert.equal(licenseLabel('by'), 'CC BY')
    assert.equal(licenseLabel('by-sa'), 'CC BY-SA')
    assert.equal(licenseLabel('pixabay'), 'Pixabay')
    assert.equal(needsAttribution('cc0'), false)
    assert.equal(needsAttribution('pdm'), false)
    assert.equal(needsAttribution('by'), true)
    assert.equal(needsAttribution('by-sa'), true)
  })

  it('googlePlacesPhoto bez explicitního zapnutí nic nevrátí a nepřijme vzdálenou URL', () => {
    assert.equal(googlePlacesPhoto({ googlePhotoUrl: '/food-illustrations/x.jpg' }), null)
    assert.equal(
      googlePlacesPhoto({
        googlePhotoEnabled: true,
        googlePhotoUrl: 'https://maps.googleapis.com/photo',
      }),
      null,
    )
    const photo = googlePlacesPhoto({
      name: 'Test',
      googlePhotoEnabled: true,
      googlePhotoUrl: '/places/google/test.jpg',
      googlePhotoAttribution: 'Google',
    })
    assert.equal(photo.kind, 'google_places')
    assert.equal(photo.url, '/places/google/test.jpg')
  })

  it('shareImageUrl bere same-origin cestu a jinak logo', () => {
    const origin = 'https://cheat-eaps.vercel.app'
    assert.equal(shareImageUrl({}, origin), `${origin}/logo-mark.png`)
    assert.equal(
      shareImageUrl(
        {
          foodIllustrationKind: 'pixabay',
          foodIllustrationUrl: '/food-illustrations/pixabay/1.jpg',
          foodIllustrationLicense: 'pixabay',
        },
        origin,
      ),
      `${origin}/food-illustrations/pixabay/1.jpg`,
    )
    assert.equal(
      shareImageUrl(
        {
          heroImageKind: 'official',
          heroImageUrl: 'https://cizi.example/og.jpg',
        },
        origin,
      ),
      `${origin}/logo-mark.png`,
    )
  })

  it('toMediaRecord sjednotí pole pro budoucí API', () => {
    const record = toMediaRecord(
      resolveDetailHero({
        name: 'Test',
        heroImageKind: 'official',
        heroImageRights: 'documented',
        heroImageUrl: '/official.jpg',
      }),
    )
    assert.equal(record.imageUrl, '/official.jpg')
    assert.equal(record.verified, true)
    assert.equal(record.kind, 'official')
  })

})
