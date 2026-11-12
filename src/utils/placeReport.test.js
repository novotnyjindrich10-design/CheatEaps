import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { validatePlaceReport } from './placeReport.js'

describe('placeReport', () => {
  it('validuje správné hlášení', () => {
    const result = validatePlaceReport({
      restaurantId: 'demo-place',
      reason: 'address',
      details: 'Špatné číslo popisné na mapě.',
    })
    assert.equal(result.ok, true)
    assert.equal(result.report.reason, 'address')
  })

  it('odmítne honeypot a krátký popis', () => {
    assert.equal(
      validatePlaceReport({
        restaurantId: 'x',
        reason: 'other',
        details: 'krátké',
        website: 'http://spam.test',
      }).ok,
      false,
    )
    assert.equal(
      validatePlaceReport({
        restaurantId: 'x',
        reason: 'other',
        details: 'krátké',
      }).ok,
      false,
    )
  })
})
