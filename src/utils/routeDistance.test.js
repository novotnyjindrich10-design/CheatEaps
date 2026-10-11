import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { airDistanceKm } from './geo.js'
import {
  applyRouteDistances,
  buildFootTableUrl,
  collectRouteDistances,
  distancesFromTable,
  formatRouteDistance,
} from './routeDistance.js'

const origin = { lat: 49.1955, lon: 16.6065 }
const near = { id: 'near', lat: 49.193645, lon: 16.60823 }

function originPlace(point) {
  return { id: 'here', lat: point.lat, lon: point.lon }
}

describe('vzdálenost po trase', () => {
  it('sestaví pěší tabulku bez API klíče a bez odhadu vzdušnou čarou', () => {
    const url = buildFootTableUrl(origin, [near, { id: 'b', lat: 49.2, lon: 16.61 }])
    assert.match(url, /\/routed-foot\/table\/v1\/foot\//)
    assert.match(url, /annotations=distance/)
    assert.match(url, /sources=0/)
    assert.match(url, /destinations=1;2/)
    assert.equal(url.includes('fallback_speed'), false)
    assert.equal(url.includes('api_key'), false)
    const coords = url.split('?')[0].split('/').pop().split(';')
    assert.equal(coords.length, 3)
    assert.equal(coords[0], '16.606500,49.195500')
    assert.ok(coords.length <= 100)
  })

  it('převede metry z tabulky na kilometry', () => {
    const distances = distancesFromTable({ code: 'Ok', distances: [[303.8]] }, [near])
    assert.equal(distances.get('near'), 0.3038)
  })

  it('null v matici nenahradí vzdušnou čarou', () => {
    const distances = distancesFromTable({ code: 'Ok', distances: [[null]] }, [near])
    assert.equal(distances.get('near'), null)
    const straight = airDistanceKm(origin, near)
    assert.ok(straight > 0)
    assert.notEqual(distances.get('near'), straight)
  })

  it('stejný bod jako výchozí místo je 0 m, jiný chybějící údaj zůstane prázdný', async () => {
    const result = await collectRouteDistances(origin, [originPlace(origin), near], {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ code: 'Ok', distances: [[null, null]] }),
      }),
    })
    assert.equal(result.distances.get('here'), 0)
    assert.equal(result.distances.get('near'), null)
  })

  it('při chybě služby nevrátí vzdušnou čáru', async () => {
    const result = await collectRouteDistances(origin, [near], {
      fetchImpl: async () => ({ ok: false, json: async () => ({ code: 'Error' }) }),
    })
    assert.equal(result.failedChunks, 1)
    assert.equal(result.distances.get('near'), null)
    assert.notEqual(result.distances.get('near'), airDistanceKm(origin, near))
  })

  it('rozdělí cíle tak, aby jeden dotaz měl nejvýš 100 souřadnic', async () => {
    const places = Array.from({ length: 81 }, (_, index) => ({
      id: `p${index}`,
      lat: 49.2 + index / 100000,
      lon: 16.6,
    }))
    const sizes = []
    const result = await collectRouteDistances(origin, places, {
      chunkSize: 80,
      fetchImpl: async (url) => {
        const count = String(url).split('?')[0].split('/').pop().split(';').length
        sizes.push(count)
        const destCount = count - 1
        return {
          ok: true,
          json: async () => ({ code: 'Ok', distances: [Array(destCount).fill(1200)] }),
        }
      },
    })
    assert.deepEqual(sizes, [81, 2])
    assert.ok(sizes.every((count) => count <= 100))
    assert.equal(result.distances.get('p0'), 1.2)
    assert.equal(result.distances.get('p80'), 1.2)
    assert.equal(result.failedChunks, 0)
  })

  it('neznámou a načítanou vzdálenost nezobrazí jako číslo', () => {
    const places = applyRouteDistances(
      [
        { id: 'known', lat: 49.2, lon: 16.6 },
        { id: 'wait', lat: 49.21, lon: 16.61 },
        { id: 'none', lat: 49.22, lon: 16.62 },
        { id: 'nocoords', name: 'Bez souřadnic' },
      ],
      new Map([
        ['known', 1.2],
        ['none', null],
      ]),
      { hasOrigin: true, pending: true },
    )
    const byId = Object.fromEntries(places.map((place) => [place.id, place]))
    assert.equal(byId.known.distanceKm, 1.2)
    assert.equal(byId.known.distanceState, 'route')
    assert.equal(byId.wait.distanceKm, null)
    assert.equal(byId.wait.distanceState, 'loading')
    assert.equal(byId.none.distanceState, 'unavailable')
    assert.equal(byId.nocoords.distanceState, 'missing')
    assert.equal(formatRouteDistance(byId.known.distanceKm, byId.known.distanceState), '1,2 km')
    assert.equal(formatRouteDistance(byId.wait.distanceKm, byId.wait.distanceState), '…')
    assert.equal(formatRouteDistance(byId.none.distanceKm, byId.none.distanceState), '—')
  })
})
