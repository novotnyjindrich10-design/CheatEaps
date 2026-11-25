import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { prefersReducedMotion, smoothScrollTo } from './smoothScroll.js'

describe('smoothScroll', () => {
  it('prefersReducedMotion je bez window false', () => {
    assert.equal(prefersReducedMotion(), false)
  })

  it('smoothScrollTo bez prvku nic nedělá', () => {
    const cancel = smoothScrollTo(null)
    assert.equal(typeof cancel, 'function')
    cancel()
  })
})
