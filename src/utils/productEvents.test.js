import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { trackProductEvent, recentProductEvents } from './productEvents.js'

describe('productEvents', () => {
  it('ignoruje neznámé události a nepadá bez window', () => {
    assert.doesNotThrow(() => trackProductEvent('not-allowed'))
    assert.equal(Array.isArray(recentProductEvents()), true)
  })
})
