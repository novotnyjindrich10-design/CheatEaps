import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickSurpriseRestaurant, surpriseCandidates } from './surprisePick.js'

const places = [
  { id: 'a', name: 'Alpha Pizza', category: 'pizza', type: 'Restaurace', address: 'A' },
  { id: 'b', name: 'Beta Burger', category: 'burger', type: 'Restaurace', address: 'B' },
  { id: 'c', name: 'Gamma Pizza', category: 'pizza', type: 'Restaurace', address: 'C' },
]

describe('surprisePick', () => {
  it('filtruje kandidáty podle kategorie', () => {
    const pool = surpriseCandidates(places, { cuisineType: 'pizza' })
    assert.deepEqual(
      pool.map((row) => row.id).sort(),
      ['a', 'c'],
    )
  })

  it('vrátí null při prázdném poolu', () => {
    const result = pickSurpriseRestaurant(places, { cuisineType: 'kebab' })
    assert.equal(result.restaurant, null)
    assert.equal(result.poolSize, 0)
  })

  it('deterministicky vybere podle rng', () => {
    const result = pickSurpriseRestaurant(places, { cuisineType: 'pizza' }, () => 0)
    assert.equal(result.poolSize, 2)
    assert.ok(result.restaurant)
  })
})
