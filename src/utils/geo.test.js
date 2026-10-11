import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { airDistanceKm, geolocationErrorMessage, hasFiniteLatLon } from './geo.js'

describe('geolocationErrorMessage', () => {
  it('rozliší odmítnutí, nedostupnost a časový limit', () => {
    assert.match(geolocationErrorMessage(1), /zakázan/i)
    assert.match(geolocationErrorMessage('denied'), /adresním řádku/)
    assert.match(geolocationErrorMessage(2), /není dostupná/)
    assert.match(geolocationErrorMessage(3), /časový limit/)
    assert.match(geolocationErrorMessage('unsupported'), /nezjišťuje/)
    assert.match(geolocationErrorMessage('insecure'), /localhost/)
    assert.match(geolocationErrorMessage('invalid'), /není zapnutá/)
  })
})

describe('souřadnice pro vzdálenost', () => {
  it('nepoužije nečíselnou polohu', () => {
    assert.equal(hasFiniteLatLon(49.2, 16.6), true)
    assert.equal(hasFiniteLatLon(Number.NaN, 16.6), false)
    assert.equal(airDistanceKm({ lat: Number.NaN, lon: 16.6 }, { lat: 49.2, lon: 16.6 }), null)
  })

  it('vzdušná čára je samostatný výpočet a u nečíselné polohy nevrátí číslo', () => {
    const km = airDistanceKm({ lat: 49.195, lon: 16.608 }, { lat: 49.2, lon: 16.61 })
    assert.ok(km > 0 && km < 2)
  })
})
