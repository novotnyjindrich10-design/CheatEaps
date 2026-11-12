import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyFromCuisine,
  classifyOsmTags,
  cuisineTokens,
  legacyTeaMatchesSteakHouse,
  safeTeaMatchesSteakHouse,
} from './cuisineClassify.js'

describe('cuisineClassify – tokeny a kolize', () => {
  it('rozdělí OSM cuisine na tokeny', () => {
    assert.deepEqual(cuisineTokens('steak_house'), ['steak_house'])
    assert.deepEqual(cuisineTokens('regional;steak_house'), ['regional', 'steak_house'])
    assert.deepEqual(cuisineTokens('pizza;burger'), ['pizza', 'burger'])
  })

  it('legacy regex tea sedí na steak_house, bezpečná klasifikace ne', () => {
    assert.equal(legacyTeaMatchesSteakHouse('steak_house'), true)
    assert.equal(safeTeaMatchesSteakHouse('steak_house'), false)
    assert.equal(classifyFromCuisine('steak_house')?.category, 'neuvedeno')
    assert.equal(classifyFromCuisine('steak_house')?.type, 'Restaurace')
  })

  it('tea / coffee_shop / cafe zůstávají kavárna', () => {
    assert.equal(classifyFromCuisine('tea')?.category, 'kava')
    assert.equal(classifyFromCuisine('teahouse')?.category, 'kava')
    assert.equal(classifyFromCuisine('bubble_tea')?.category, 'kava')
    assert.equal(classifyFromCuisine('coffee_shop')?.category, 'kava')
    assert.equal(classifyFromCuisine('cafe')?.category, 'kava')
  })

  it('pizza a burger mají přednost před kavárnou v kombinovaných tagách', () => {
    assert.equal(classifyFromCuisine('pizza;coffee_shop')?.category, 'pizza')
    assert.equal(classifyFromCuisine('burger')?.category, 'burger')
    assert.equal(classifyFromCuisine('barbecue;steak_house;pasta')?.category, 'neuvedeno')
  })

  it('amenity cafe bez cuisine → kava; restaurant bez cuisine → neuvedeno', () => {
    assert.equal(classifyOsmTags({ amenity: 'cafe' }).category, 'kava')
    assert.equal(classifyOsmTags({ amenity: 'restaurant' }).category, 'neuvedeno')
    assert.equal(
      classifyOsmTags({ cuisine: 'steak_house', amenity: 'cafe' }).category,
      'neuvedeno',
    )
  })
})
