import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isNonProductionHost, metaForPath } from './pageMeta.js'

describe('metadata stránek', () => {
  it('má unikátní titulek úvodu a výsledků', () => {
    const home = metaForPath('/')
    const results = metaForPath('/results')
    assert.notEqual(home.title, results.title)
    assert.match(home.title, /FoodGo Brno/)
    assert.match(home.description, /Brně/i)
    assert.match(home.description, /cen/i)
    assert.ok(home.description.length > 40)
    assert.equal(home.robots, '')
  })

  it('preview a localhost označí jako neprodukční host', () => {
    assert.equal(isNonProductionHost('localhost'), true)
    assert.equal(isNonProductionHost('cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app'), true)
    assert.equal(isNonProductionHost('cheat-eaps.vercel.app'), false)
  })

  it('schová administraci a přihlášení před indexem', () => {
    assert.match(metaForPath('/admin/zadosti').robots, /noindex/)
    assert.match(metaForPath('/prihlaseni').robots, /noindex/)
    assert.match(metaForPath('/registrace').robots, /noindex/)
    assert.match(metaForPath('/odmeny').robots, /noindex/)
    assert.match(metaForPath('/oblibene').robots, /noindex/)
    assert.match(metaForPath('/nabidka/isic').robots, /noindex/)
    assert.equal(metaForPath('/results').robots, '')
  })

  it('neznámou adresu označí jako nenalezenou', () => {
    const missing = metaForPath('/tohle-neexistuje')
    assert.match(missing.title, /nenalezena/)
    assert.match(missing.robots, /noindex/)
  })
})
