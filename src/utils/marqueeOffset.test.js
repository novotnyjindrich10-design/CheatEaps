import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeMarqueeOffset } from './marqueeOffset.js'

describe('normalizeMarqueeOffset', () => {
  const loop = 1000

  it('nechá pozici ve střední kopii', () => {
    assert.equal(normalizeMarqueeOffset(1000, loop), 1000)
    assert.equal(normalizeMarqueeOffset(1500, loop), 1500)
    assert.equal(normalizeMarqueeOffset(1999, loop), 1999)
  })

  it('přeskočí z konce střední kopie na její začátek', () => {
    assert.equal(normalizeMarqueeOffset(2000, loop), 1000)
    assert.equal(normalizeMarqueeOffset(2500, loop), 1500)
    assert.equal(normalizeMarqueeOffset(3000, loop), 1000)
  })

  it('přeskočí z levé kopie zpátky do střední', () => {
    assert.equal(normalizeMarqueeOffset(999, loop), 1999)
    assert.equal(normalizeMarqueeOffset(0, loop), 1000)
    assert.equal(normalizeMarqueeOffset(-20, loop), 1980)
  })

  it('bez platné smyčky nic nemění', () => {
    assert.equal(normalizeMarqueeOffset(40, 0), 40)
    assert.equal(normalizeMarqueeOffset(Number.NaN, loop), Number.NaN)
  })
})
