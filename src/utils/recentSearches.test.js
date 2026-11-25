import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  RECENT_SEARCHES_KEY,
  clearRecentSearches,
  listRecentSearches,
  rememberRecentSearch,
  removeRecentSearch,
} from './recentSearches.js'

const memory = new Map()

globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null
  },
  setItem(key, value) {
    memory.set(key, String(value))
  },
  removeItem(key) {
    memory.delete(key)
  },
}

afterEach(() => {
  memory.clear()
})

describe('recentSearches', () => {
  it('ukládá unikátní hledání na začátek', () => {
    rememberRecentSearch('pizza')
    rememberRecentSearch('burger')
    rememberRecentSearch('PIZZA')
    assert.deepEqual(listRecentSearches(), ['PIZZA', 'burger'])
    assert.ok(memory.has(RECENT_SEARCHES_KEY))
  })

  it('umí smazat jedno i všechna', () => {
    rememberRecentSearch('svacilova')
    rememberRecentSearch('kebab')
    assert.deepEqual(removeRecentSearch('kebab'), ['svacilova'])
    assert.deepEqual(clearRecentSearches(), [])
  })
})
