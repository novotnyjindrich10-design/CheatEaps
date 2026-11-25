import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { FILTER_PREFS_KEY, readFilterPrefs, writeFilterPrefs } from './filterPrefs.js'

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

describe('filterPrefs', () => {
  it('ukládá jen povolené preference bez volného textu', () => {
    writeFilterPrefs({
      maxBudget: 150,
      openNowOnly: true,
      search: 'tajne',
      dealsOnly: true,
      sortBy: 'distance',
    })
    assert.deepEqual(readFilterPrefs(), {
      maxBudget: 150,
      openNowOnly: true,
      sortBy: 'distance',
    })
    assert.ok(memory.has(FILTER_PREFS_KEY))
  })

  it('prázdné preference smaže klíč', () => {
    writeFilterPrefs({ maxBudget: 100 })
    assert.equal(writeFilterPrefs({}), null)
    assert.equal(readFilterPrefs(), null)
  })
})
