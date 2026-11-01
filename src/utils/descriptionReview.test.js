import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reviewDescription } from './descriptionReview.js'

describe('kontrola popisu podniku', () => {
  it('navrhne úpravu bez vymyšlených údajů a označí engine jako rules', () => {
    const result = reviewDescription('  skvělé burgery v centru  ', { businessName: 'Bistro Test' })
    assert.equal(result.ok, true)
    assert.equal(result.engine, 'rules')
    assert.match(result.engineLabel, /ne jazykový model/i)
    assert.equal(result.suggested.startsWith('Skvělé'), true)
    assert.equal(result.modelAvailable, false)
  })

  it('upozorní na ceny a otevírací dobu', () => {
    const result = reviewDescription(
      'Jsme otevření nonstop a menu od 89 Kč. Burgery pečeme každý den.',
      { businessName: 'Burger Point' },
    )
    assert.equal(result.ok, true)
    assert.ok(result.warnings.some((item) => /otevírací|ceny/i.test(item)))
  })
})
