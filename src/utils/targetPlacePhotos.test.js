import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPlacePixabayIllustration } from '../data/pixabayLibrary.js'
import { pixabayManualPhotoByPlaceId } from '../data/pixabayManualPicks.js'
import { resolveCardMedia } from './cardMedia.js'
import { resolveDetailHero } from './placePhoto.js'

const ATHENA = 'gyros-taverna-athena-stefanikova-4'
const ABU_RAMI = 'kebab-abu-rami-lidicka-47'
const BURGER_KING = [
  'burger-king-u-dalnice-777',
  'burger-king-nadrazni-10',
  'burger-king-ceska-142-29',
  'burger-king-videnska-132-100',
  'burger-king-netroufalky-770',
]

/** Nesprávné sendvičové Pixabay ID dříve u Athena / Abu Rami. */
const FORBIDDEN_SANDWICH_IDS = new Set([2607332, 5193345])
/** Gourmet/AI-looking ilustrace dříve u BK Česká a Vídeňská. */
const FORBIDDEN_BK_IDS = new Set([10331664, 10448258])

function asRestaurant(placeId) {
  const illustration = getPlacePixabayIllustration(placeId)
  assert.ok(illustration, `chybí Pixabay ilustrace pro ${placeId}`)
  return {
    id: placeId,
    name: placeId,
    ...illustration,
  }
}

describe('fotografie cílových podniků', () => {
  it('Gyros Taverna Athena má kebab/gyros ilustraci, ne sendvič v autě', () => {
    assert.equal(pixabayManualPhotoByPlaceId[ATHENA], 6208833)
    const restaurant = asRestaurant(ATHENA)
    assert.equal(restaurant.foodIllustrationPixabayId, 6208833)
    assert.equal(restaurant.foodIllustrationTheme, 'kebab')
    assert.match(restaurant.foodIllustrationDish, /kebab/i)
    assert.equal(FORBIDDEN_SANDWICH_IDS.has(restaurant.foodIllustrationPixabayId), false)

    const hero = resolveDetailHero(restaurant)
    const card = resolveCardMedia(restaurant)
    assert.equal(hero?.kind, 'illustration')
    assert.equal(card?.url, hero?.url)
    assert.match(hero.alt, /Ilustrační/)
    assert.match(hero.url, /\/food-illustrations\/pixabay\/6208833\.jpg$/)
  })

  it('Kebab Abu Rami má dürüm/shawarma ilustraci, ne barevný snack roll', () => {
    assert.equal(pixabayManualPhotoByPlaceId[ABU_RAMI], 6109976)
    const restaurant = asRestaurant(ABU_RAMI)
    assert.equal(restaurant.foodIllustrationPixabayId, 6109976)
    assert.equal(restaurant.foodIllustrationTheme, 'kebab')
    assert.equal(FORBIDDEN_SANDWICH_IDS.has(restaurant.foodIllustrationPixabayId), false)

    const hero = resolveDetailHero(restaurant)
    const card = resolveCardMedia(restaurant)
    assert.equal(hero?.pixabayId, 6109976)
    assert.equal(card?.url, hero?.url)
    assert.match(hero.alt, /Ilustrační/)
  })

  it('každá pobočka Burger King má vlastní burger ilustraci a ne sdílí zakázaná ID', () => {
    const urls = BURGER_KING.map((placeId) => {
      const libraryId = pixabayManualPhotoByPlaceId[placeId]
      assert.ok(Number.isInteger(libraryId))
      assert.equal(FORBIDDEN_BK_IDS.has(libraryId), false)
      assert.equal(FORBIDDEN_SANDWICH_IDS.has(libraryId), false)
      const restaurant = asRestaurant(placeId)
      assert.equal(restaurant.foodIllustrationTheme, 'burger')
      const hero = resolveDetailHero(restaurant)
      const card = resolveCardMedia(restaurant)
      assert.equal(hero?.kind, 'illustration')
      assert.ok(['pixabay', 'unsplash', 'pexels'].includes(hero?.provider), placeId)
      assert.equal(card?.url, hero?.url)
      assert.match(hero.alt, /Ilustrační/)
      assert.match(hero.url, new RegExp(`/food-illustrations/pixabay/${libraryId}\\.jpg$`))
      return hero.url
    })
    assert.equal(new Set(urls).size, urls.length, 'pobočky BK musí mít unikátní ilustrace')
  })

  it('karta a detail používají stejný resolve pro Athena, Abu Rami i BK', () => {
    for (const placeId of [ATHENA, ABU_RAMI, ...BURGER_KING]) {
      const restaurant = asRestaurant(placeId)
      assert.deepEqual(resolveCardMedia(restaurant), resolveDetailHero(restaurant))
    }
  })
})
