import assert from 'node:assert/strict'
import fs from 'node:fs'
import { describe, it } from 'node:test'
import { loginPath, postLoginTarget } from './authReturn.js'
import { safeInternalPath } from './internalPath.js'

describe('bezpečnost Auth před vydáním', () => {
  it('next parametr nepustí na cizí web', () => {
    const cases = [
      'https://evil.test/steal',
      '//evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
      '/%2f%2fevil.test',
      'http://127.0.0.1.evil.test',
    ]
    for (const next of cases) {
      assert.equal(postLoginTarget(`next=${encodeURIComponent(next)}`), '/results')
      assert.equal(safeInternalPath(next, '/results'), '/results')
    }
    assert.equal(postLoginTarget(`next=${encodeURIComponent('/results?deals=1')}`), '/results?deals=1')
    assert.equal(loginPath('https://evil.test'), '/prihlaseni?next=%2Fresults')
  })

  it('klient neobsahuje Supabase anon klíč ani VITE_SUPABASE', () => {
    const files = [
      new URL('../context/AuthContext.jsx', import.meta.url),
      new URL('../pages/AuthPage.jsx', import.meta.url),
      new URL('../context/authSession.js', import.meta.url),
      new URL('../App.jsx', import.meta.url),
    ]
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      assert.equal(source.includes('SUPABASE_ANON_KEY'), false)
      assert.equal(source.includes('VITE_SUPABASE'), false)
      assert.equal(source.includes('createClient'), false)
    }
  })

  it('AuthPage při výpadku session endpointu nechá formulář', () => {
    const source = fs.readFileSync(new URL('../pages/AuthPage.jsx', import.meta.url), 'utf8')
    assert.match(source, /session\.configured \|\| session\.unreachable/)
    assert.match(source, /!session\.configured && !session\.unreachable/)
  })

  it('Slevy i deal-detail vyžadují přihlášení přes loginPath (když je UI zapnuté)', () => {
    const results = fs.readFileSync(new URL('../pages/Results.jsx', import.meta.url), 'utf8')
    const deal = fs.readFileSync(new URL('../pages/DealDetail.jsx', import.meta.url), 'utf8')
    const scope = fs.readFileSync(new URL('../constants/publicV1.js', import.meta.url), 'utf8')
    assert.match(scope, /memberDealsUi:\s*false/)
    assert.match(results, /dealsGate && !PUBLIC_V1\.memberDealsUi/)
    assert.match(results, /dealsGate && session\.ready && !session\.authenticated/)
    assert.match(results, /Navigate to=\{dealsLogin\}/)
    assert.match(deal, /Navigate to=\{loginPath\(here\)\}/)
  })
})
