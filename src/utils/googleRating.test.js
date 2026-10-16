import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapsDirectionsUrl } from './googleRating.js'

describe('navigace', () => {
  it('se souřadnicemi otevře trasu na cíl a nepřidá polohu uživatele', () => {
    const url = mapsDirectionsUrl({ lat: 49.2, lon: 16.6, name: 'A', address: 'Brno' })
    assert.equal(url, 'https://www.google.com/maps/dir/?api=1&destination=49.2,16.6')
    assert.equal(url.includes('origin='), false)
  })

  it('bez souřadnic použije název a adresu', () => {
    const url = mapsDirectionsUrl({ name: 'Štatl', address: 'náměstí Svobody 3, Brno' })
    assert.match(url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/)
    assert.equal(url.includes('origin='), false)
    assert.match(decodeURIComponent(url), /Štatl/)
  })
})
