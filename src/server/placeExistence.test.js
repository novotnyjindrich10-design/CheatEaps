import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkPlaceExistence, classifyExistence } from './placeExistence.js'

describe('ověření existence podniku', () => {
  it('bez API klíče neoznačí podnik za ověřený', async () => {
    const result = await checkPlaceExistence(
      { businessName: 'Test Bistro', address: 'Česká 1', locality: 'Brno' },
      {},
    )
    assert.equal(result.ok, true)
    assert.equal(result.status, 'unavailable')
    assert.equal(result.verified, false)
    assert.equal(result.requiresManualReview, true)
    assert.match(result.summary, /neby[l]? ověřen|není nastaven/i)
  })

  it('klasifikuje silnou jedinou shodu jako likely_match bez absolute verified', () => {
    const result = classifyExistence(
      [{ name: 'KFC Svoboďák', address: 'náměstí Svobody 45, Brno' }],
      { businessName: 'KFC Svoboďák', address: 'náměstí Svobody 45', locality: 'Brno' },
    )
    assert.equal(result.status, 'likely_match')
    assert.equal(result.verified, false)
    assert.equal(result.requiresManualReview, true)
  })
})
