import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assignPhotoIds,
  fitInside,
  normalizePixabayPhoto,
  scorePixabayPhoto,
  selectPixabayPhotos,
} from '../../scripts/lib/pixabaySelect.mjs'

const pizza = {
  key: 'pizza',
  keywords: ['pizza', 'margherita'],
  forbidTags: ['cake'],
}

function hit(id, tags, extra = {}) {
  return {
    id,
    type: 'photo',
    tags,
    pageURL: `https://pixabay.com/photos/example-${id}/`,
    largeImageURL: `https://pixabay.com/get/example_${id}_1280.jpg`,
    imageWidth: 2400,
    imageHeight: 1600,
    user: `Autor${id % 3}`,
    user_id: 1000 + (id % 3),
    likes: id,
    ...extra,
  }
}

describe('výběr Pixabay fotek', () => {
  it('vezme jen largeImageURL a spočítá nejvýš 1280 px', () => {
    const photo = normalizePixabayPhoto(hit(10, 'pizza, margherita, food'))
    assert.equal(photo.downloadUrl.includes('/get/example_10_1280.jpg'), true)
    assert.equal(photo.displayWidth, 1280)
    assert.equal(photo.displayHeight, 853)
    assert.equal(fitInside(4000, 2000).width, 1280)
    assert.equal(JSON.stringify(photo).includes('imageURL'), false)
  })

  it('odmítne lidi, text, malý snímek i adresu mimo Pixabay', () => {
    assert.equal(scorePixabayPhoto(normalizePixabayPhoto(hit(11, 'chef, pizza, food')), pizza) < 0, true)
    assert.equal(scorePixabayPhoto(normalizePixabayPhoto(hit(12, 'pizza, logo, text')), pizza) < 0, true)
    assert.equal(
      scorePixabayPhoto(
        normalizePixabayPhoto(hit(13, 'pizza, food', { imageWidth: 800, imageHeight: 600 })),
        pizza,
      ) < 0,
      true,
    )
    assert.equal(normalizePixabayPhoto({ id: 14, imageURL: 'https://cdn.pixabay.com/photo/x.jpg' }), null)
    assert.equal(
      normalizePixabayPhoto(hit(15, 'pizza', { largeImageURL: 'https://example.com/pizza.jpg' })),
      null,
    )
  })

  it('nebere první výsledek, když je horší než další', () => {
    const photos = [hit(1, 'pizza'), hit(2, 'margherita, pizza, wooden, ceramic', { likes: 80 })]
    const [best] = selectPixabayPhotos(photos, pizza, { limit: 1 })
    assert.equal(best.id, 2)
  })

  it('sousední podniky dostanou různé fotky, dokud fond stačí', () => {
    const assignment = assignPhotoIds({ pizza: ['a', 'b', 'c', 'd'] }, { pizza: [10, 20, 30] })
    assert.deepEqual(assignment, { a: 10, b: 20, c: 30, d: 10 })
    assert.notEqual(assignment.a, assignment.b)
  })
})
