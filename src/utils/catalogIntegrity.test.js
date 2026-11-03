import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { describe, it } from 'node:test'
import { categoryOverrides } from '../data/categoryOverrides.js'
import { curatedPlaces } from '../data/curatedPlaces.js'
import { osmPlaces } from '../data/osmPlaces.js'
import { pixabayPhotosById, placePixabayPhotoId } from '../data/pixabayLibrary.js'
import { ALLOWED_PLACE_CATEGORIES } from '../constants/filters.js'

function mergedPlaces() {
  const byId = new Map()
  for (const place of [...curatedPlaces, ...osmPlaces]) {
    if (!byId.has(place.id)) byId.set(place.id, place)
  }
  return [...byId.values()]
}

describe('katalog podniků', () => {
  it('má jedinečná ID, název, adresu a povolenou kategorii', () => {
    const places = mergedPlaces()
    assert.ok(places.length >= 700)
    const allowed = new Set(ALLOWED_PLACE_CATEGORIES)
    for (const place of places) {
      assert.equal(typeof place.id, 'string')
      assert.ok(place.id.length > 0)
      assert.equal(typeof place.name, 'string')
      assert.ok(place.name.trim().length > 0, place.id)
      assert.equal(typeof place.address, 'string')
      assert.ok(place.address.trim().length > 0, place.id)
      const category = categoryOverrides[place.id]?.category || place.category
      assert.ok(allowed.has(category), `${place.id} ${category}`)
    }
  })

  it('lokální Pixabay fotky přiřazené podnikům existují', () => {
    const ids = new Set(mergedPlaces().map((place) => place.id))
    for (const [placeId, photoId] of Object.entries(placePixabayPhotoId)) {
      assert.ok(ids.has(placeId), placeId)
      const photo = pixabayPhotosById[photoId]
      assert.ok(photo, `${placeId} ${photoId}`)
      assert.match(photo.cardUrl, /^\/food-illustrations\/pixabay\//)
      assert.equal(existsSync(new URL(`../../public${photo.cardUrl}`, import.meta.url)), true, photo.cardUrl)
      assert.ok(photo.user)
      assert.match(photo.pageUrl, /^https:\/\/pixabay\.com\//)
    }
  })
})
