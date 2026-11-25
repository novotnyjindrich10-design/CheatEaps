import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readMagnetPreference, writeMagnetPreference } from './magnetScroll.js'

describe('magnetScroll preference', () => {
  it('ukládá a čte lokální preferenci', () => {
    const store = new Map()
    globalThis.window = {
      localStorage: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
      },
      matchMedia: () => ({ matches: false }),
    }
    writeMagnetPreference(true)
    assert.equal(readMagnetPreference(), true)
    writeMagnetPreference(false)
    assert.equal(readMagnetPreference(), false)
  })
})
