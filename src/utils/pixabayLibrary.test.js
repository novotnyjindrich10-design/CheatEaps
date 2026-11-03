import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { pixabayManualPhotoByPlaceId } from '../data/pixabayManualPicks.js'
import {
  getPlacePixabayIllustration,
  pixabayIdsByTheme,
  pixabayLibraryReady,
  placePixabayPhotoId,
} from '../data/pixabayLibrary.js'

const MANUAL = {
  lokofu: 5233516,
  'chutne-stesti-lidicka-1874-38': 1762493,
  'zlata-miska-maresova-14': 1707089,
  'forkys-vankovka': 4641173,
  'turecky-kebab-hybesova-30': 6615971,
  'kebab-kotlarska-kotlarska-5': 3924358,
}

describe('knihovna Pixabay', () => {
  it('drží lokální cesty a ruční fotky jen u šesti podniků', () => {
    assert.equal(pixabayLibraryReady, true)
    const source = readFileSync(new URL('../data/pixabayLibrary.data.js', import.meta.url), 'utf8')
    assert.equal(source.includes('pixabay.com/get/'), false)
    assert.equal(source.includes('cdn.pixabay.com'), false)
    const ids = Object.values(MANUAL)
    assert.equal(new Set(ids).size, ids.length)
    for (const [placeId, photoId] of Object.entries(MANUAL)) {
      assert.equal(pixabayManualPhotoByPlaceId[placeId], photoId)
      assert.equal(placePixabayPhotoId[placeId], photoId)
      const illustration = getPlacePixabayIllustration(placeId)
      assert.equal(illustration.foodIllustrationUrl, `/food-illustrations/pixabay/${photoId}.jpg`)
      assert.equal(illustration.foodIllustrationLicense, 'pixabay')
      for (const pool of Object.values(pixabayIdsByTheme)) {
        assert.equal(pool.includes(photoId), false)
      }
    }
    const usedByOthers = Object.entries(placePixabayPhotoId).filter(
      ([placeId, photoId]) => !MANUAL[placeId] && ids.includes(photoId),
    )
    assert.deepEqual(usedByOthers, [])
  })

  it('stahovací skript bez klíče knihovnu nezapíše a ruční výběr vrátí', () => {
    const source = readFileSync(new URL('../../scripts/fetch-pixabay-illustrations.mjs', import.meta.url), 'utf8')
    assert.match(source, /PIXABAY_API_KEY/)
    assert.match(source, /process\.exit\(1\)/)
    assert.match(source, /CACHE_MS = 24 \* 60 \* 60 \* 1000/)
    assert.match(source, /MAX_DOWNLOADS = 160/)
    assert.match(source, /largeImageURL/)
    assert.match(source, /applyManualPhotos/)
    assert.match(source, /pixabayManualPicks/)
    assert.equal(source.includes('hit.imageURL'), false)
    assert.equal(source.includes('pixabay.com/get/'), false)
  })
})
