import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { CATALOG_EXCLUSIONS, catalogExclusionIds, isCatalogExcluded } from './catalogExclusions.js'
import { curatedPlaces } from './curatedPlaces.js'
import { osmPlaces } from './osmPlaces.js'

describe('catalogExclusions', () => {
  it('má potvrzené nekulinární ID s důkazem', () => {
    assert.ok(isCatalogExcluded('local-barber-shop-smetanova-5'))
    assert.ok(catalogExclusionIds().includes('local-barber-shop-smetanova-5'))
    assert.match(CATALOG_EXCLUSIONS['local-barber-shop-smetanova-5'].reason, /holič|barber/i)
    assert.ok(CATALOG_EXCLUSIONS['local-barber-shop-smetanova-5'].evidenceUrl)
  })

  it('exclusion odkazuje na existující OSM záznam, ale veřejný filtr ho pozná', () => {
    const raw = [...curatedPlaces, ...osmPlaces]
    assert.ok(raw.some((place) => place.id === 'local-barber-shop-smetanova-5'))
    const publicIds = raw.filter((place) => !isCatalogExcluded(place.id)).map((place) => place.id)
    assert.equal(publicIds.includes('local-barber-shop-smetanova-5'), false)
    assert.equal(publicIds.length, raw.length - catalogExclusionIds().length)
  })
})
