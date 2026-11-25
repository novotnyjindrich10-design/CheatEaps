import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  currentMagnetIndex,
  isIntentionalMagnetGesture,
  readMagnetPreference,
  resolveMagnetIndex,
  scrollMagnetToOffset,
  writeMagnetPreference,
} from './magnetScroll.js'

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

describe('magnetScroll snap math', () => {
  const offsets = [0, 400, 900, 1400]

  it('najde aktuální kartu podle scrollTop', () => {
    assert.equal(currentMagnetIndex(offsets, 0), 0)
    assert.equal(currentMagnetIndex(offsets, 50), 0)
    assert.equal(currentMagnetIndex(offsets, 420), 1)
    assert.equal(currentMagnetIndex(offsets, 950), 2)
  })

  it('výrazné gesto dolů přejde na následující kartu', () => {
    assert.equal(
      resolveMagnetIndex({ offsets, scrollTop: 10, direction: 1, intentional: true }),
      1,
    )
    assert.equal(
      resolveMagnetIndex({ offsets, scrollTop: 410, direction: 1, intentional: true }),
      2,
    )
  })

  it('výrazné gesto nahoru přejde na předchozí / začátek karty', () => {
    assert.equal(
      resolveMagnetIndex({ offsets, scrollTop: 500, direction: -1, intentional: true }),
      1,
    )
    assert.equal(
      resolveMagnetIndex({ offsets, scrollTop: 405, direction: -1, intentional: true }),
      0,
    )
  })

  it('bez výrazného gesta dorovná na nejbližší', () => {
    assert.equal(resolveMagnetIndex({ offsets, scrollTop: 180, intentional: false }), 0)
    assert.equal(resolveMagnetIndex({ offsets, scrollTop: 250, intentional: false }), 1)
  })

  it('rozpozná záměrné gesto podle dráhy a rychlosti', () => {
    assert.equal(isIntentionalMagnetGesture({ deltaY: 20, viewportHeight: 700 }), false)
    assert.equal(isIntentionalMagnetGesture({ deltaY: 120, viewportHeight: 700 }), true)
    assert.equal(isIntentionalMagnetGesture({ deltaY: 10, velocityY: 0.8, viewportHeight: 700 }), true)
  })

  it('scrollMagnetToOffset skutečně změní scrollTop', () => {
    const calls = []
    const scroller = {
      scrollHeight: 2000,
      clientHeight: 600,
      scrollTo(opts) {
        calls.push(opts)
        this.scrollTop = opts.top
      },
      scrollTop: 0,
    }
    const top = scrollMagnetToOffset(scroller, 400, { behavior: 'auto' })
    assert.equal(top, 400)
    assert.equal(scroller.scrollTop, 400)
    assert.deepEqual(calls[0], { top: 400, behavior: 'auto' })
  })
})
