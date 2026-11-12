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

  it('odmítne zakódované protokolově relativní a řídicí znaky', () => {
    assert.equal(safeInternalPath('/%2f%2fevil.example', '/results'), '/results')
    assert.equal(safeInternalPath('/%2F%2Fevil.example/path', '/results'), '/results')
    assert.equal(safeInternalPath('/results\u0000evil', '/results'), '/results')
    assert.equal(safeInternalPath('/results?deals=1', '/fallback'), '/results?deals=1')
    assert.equal(safeInternalPath('/nabidka/kfc-isic-twister--kfc-masarykova-39', '/'), '/nabidka/kfc-isic-twister--kfc-masarykova-39')
  })
})
