import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  LOCAL_FAVORITES_KEY,
  listLocalFavorites,
  normalizeFavoriteIds,
  toggleLocalFavorite,
} from './localFavorites.js'

const memory = new Map()

beforeEach(() => {
  memory.clear()
  globalThis.localStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  }
})

describe('localFavorites', () => {
  it('normalizuje duplicity a neplatná ID', () => {
    assert.deepEqual(
      normalizeFavoriteIds(['a', '', 'a', 'b'], { exists: (id) => id !== 'gone' }),
      ['a', 'b'],
    )
  })

  it('ukládá a odebírá guest oblíbené', () => {
    const exists = (id) => id === 'p1' || id === 'p2'
    assert.equal(toggleLocalFavorite('p1', { exists }).favorite, true)
    assert.deepEqual(listLocalFavorites({ exists }), ['p1'])
    assert.equal(toggleLocalFavorite('p1', { exists }).favorite, false)
    assert.deepEqual(listLocalFavorites({ exists }), [])
    assert.equal(toggleLocalFavorite('gone', { exists }).ok, false)
    assert.equal(memory.get(LOCAL_FAVORITES_KEY), '[]')
  })
})
