import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('veřejné texty etapy 1', () => {
  it('přihlášení neukazuje interní návod', () => {
    const page = source('./AuthPage.jsx')
    assert.equal(page.includes('SQL'), false)
    assert.equal(page.includes('SUPABASE'), false)
    assert.equal(page.includes('Redirect URLs'), false)
    assert.equal(page.includes('Vercel'), false)
    assert.match(page, /Přihlášení teď není k dispozici/)
    assert.match(page, /\/ochrana-osobnich-udaju/)
    assert.match(page, /\/obchodni-podminky/)
  })

  it('právní stránky jsou kostra a nevymýšlejí provozovatele', () => {
    const privacy = source('./Privacy.jsx')
    const terms = source('./Terms.jsx')
    const slot = source('../components/OperatorSlot.jsx')
    const app = source('../App.jsx')
    assert.match(slot, /Doplní provozovatel/)
    for (const text of [privacy, terms]) {
      assert.match(text, /OperatorSlot/)
      assert.match(text, /není platn|nejsou platn/)
      assert.equal(/\b\d{8}\b/.test(text), false)
      assert.equal(text.includes('@'), false)
    }
    assert.match(app, /path="\/ochrana-osobnich-udaju"/)
    assert.match(app, /path="\/obchodni-podminky"/)
    assert.match(privacy, /schválení administrátorem/)
    assert.match(terms, /Odměny za body zůstávají vypnuté/)
  })
})
