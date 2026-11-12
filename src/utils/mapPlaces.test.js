import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { boundsFromPlaces, placesForMap } from './mapPlaces.js'

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

  it('označí sponzorované body', () => {
    const [place] = placesForMap([
      { id: 's', name: 'S', lat: 49.2, lon: 16.6, sponsored: true },
    ])
    assert.equal(place.sponsored, true)
  })

  it('prázdný výsledek nemá bounds', () => {
    assert.equal(boundsFromPlaces([]), null)
    assert.ok(boundsFromPlaces([{ id: 'a', lat: 49.2, lon: 16.6 }]))
  })
})
