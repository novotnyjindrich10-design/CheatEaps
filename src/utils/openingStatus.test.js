import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOpenNowReliable, openingStatusNow } from './openingStatus.js'

describe('openingStatus', () => {
  it('24/7 je otevřeno', () => {
    assert.equal(openingStatusNow('24/7').status, 'open')
  })

  it('jednoduchý denní interval v Prague čase', () => {
    // středa 2026-11-11 12:00 UTC ≈ 13:00 Prague (CET)
    const noonUtc = new Date('2026-11-11T12:00:00.000Z')
    assert.equal(openingStatusNow('Mo-Fr 10:00-18:00', noonUtc).status, 'open')
    assert.equal(openingStatusNow('Mo-Fr 10:00-12:00', noonUtc).status, 'closed')
  })

  it('overnight přes půlnoc', () => {
    const late = new Date('2026-11-11T22:30:00.000Z') // 23:30 Prague
    assert.equal(openingStatusNow('We 22:00-02:00', late).status, 'open')
  })

  it('složité OSM vzory → unknown', () => {
    assert.equal(openingStatusNow('Mo-Fr 09:00-17:00; PH off').status, 'unknown')
    assert.equal(isOpenNowReliable('Mo-Fr 09:00-17:00; PH off'), false)
  })

  it('chybějící data → unknown', () => {
    assert.equal(openingStatusNow('').status, 'unknown')
  })
})
