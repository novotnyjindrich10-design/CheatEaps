import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { currentInternalPath, safeInternalPath } from './internalPath.js'

describe('návrat z detailu', () => {
  it('ponechá filtry ve vnitřní adrese', () => {
    assert.equal(
      currentInternalPath({ pathname: '/results', search: '?budget=120&type=pizza' }),
      '/results?budget=120&type=pizza',
    )
  })

  it('odmítne cizí adresu a použije výsledky', () => {
    assert.equal(safeInternalPath('https://evil.example', '/results'), '/results')
    assert.equal(safeInternalPath('//evil.example', '/results'), '/results')
    assert.equal(safeInternalPath('javascript:alert(1)', '/results'), '/results')
    assert.equal(safeInternalPath(null, '/results'), '/results')
  })
})
