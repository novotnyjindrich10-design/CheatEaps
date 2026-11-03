import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { metaForPath } from './pageMeta.js'

describe('metadata stránek', () => {
  it('má unikátní titulek úvodu a výsledků', () => {
    const home = metaForPath('/')
    const results = metaForPath('/results')
    assert.notEqual(home.title, results.title)
    assert.match(home.title, /CheapEats Brno/)
    assert.ok(home.description.length > 40)
    assert.equal(home.robots, '')
  })

  it('schová administraci a přihlášení před indexem', () => {
    assert.match(metaForPath('/admin/zadosti').robots, /noindex/)
    assert.match(metaForPath('/prihlaseni').robots, /noindex/)
    assert.match(metaForPath('/registrace').robots, /noindex/)
  })

  it('neznámou adresu označí jako nenalezenou', () => {
    const missing = metaForPath('/tohle-neexistuje')
    assert.match(missing.title, /nenalezena/)
    assert.match(missing.robots, /noindex/)
  })
})
