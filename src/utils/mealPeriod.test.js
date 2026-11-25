import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mealPeriodForHour } from './mealPeriod.js'

describe('mealPeriodForHour', () => {
  it('ráno preferuje kávu', () => {
    const period = mealPeriodForHour(8)
    assert.equal(period.id, 'morning')
    assert.equal(period.category, 'kava')
    assert.equal(period.preferOpen, true)
  })

  it('poledne nemá vynucenou kategorii', () => {
    const period = mealPeriodForHour(12)
    assert.equal(period.id, 'lunch')
    assert.equal(period.category, undefined)
  })

  it('večer drží otevřené tipy', () => {
    assert.equal(mealPeriodForHour(20).id, 'evening')
    assert.equal(mealPeriodForHour(2).id, 'late')
  })
})
