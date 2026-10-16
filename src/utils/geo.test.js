import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { airDistanceKm, coordinateIssue, geolocationErrorMessage, hasFiniteLatLon, hasVerifiedCoordinates } from './geo.js'

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

  it('rozliší chybějící a neplatné souřadnice podniku', () => {
    assert.equal(coordinateIssue({ name: 'Bez bodu' }), 'missing')
    assert.equal(coordinateIssue({ lat: Number.NaN, lon: 16.6 }), 'invalid')
    assert.equal(coordinateIssue({ lat: '49.2', lon: 16.6 }), 'invalid')
    assert.equal(coordinateIssue({ lat: 16.6, lon: 49.2 }), 'invalid')
    assert.equal(coordinateIssue({ lat: 50.08, lon: 14.42 }), 'invalid')
    assert.equal(hasVerifiedCoordinates({ lat: 49.195, lon: 16.608 }), true)
    assert.equal(airDistanceKm({ lat: 49.195, lon: 16.608 }, { lat: 16.6, lon: 49.2 }), null)
  })
})
