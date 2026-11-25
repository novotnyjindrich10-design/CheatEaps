import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { describeResendKey, normalizeResendKey } from './resend-key-shape.mjs'

describe('resend key shape', () => {
  // Skládáme fake vzorky za běhu — žádný literál re_… v souboru (secret scanning).
  const official = ['re_', 'AbCdEfGh', '_', 'AbCdEfGhJkMnPqRsTuVwXyZa'].join('')
  const soft = ['re_', 'ABC0DEF1', '_', '0123456789abcdef01234567'].join('')

  it('normalizuje Bearer, uvozovky a env radek', () => {
    assert.equal(normalizeResendKey(`  "${official}"  `), official)
    assert.equal(normalizeResendKey(`Bearer ${official}`), official)
    assert.equal(normalizeResendKey(`RESEND_API_KEY=${official}`), official)
  })

  it('prijme oficialni base58 i soft alfanumericky tvar', () => {
    const officialShape = describeResendKey(official)
    assert.equal(officialShape.official, true)
    assert.equal(officialShape.accepted, true)

    const softShape = describeResendKey(soft)
    assert.equal(softShape.official, false)
    assert.equal(softShape.accepted, true)

    const bad = describeResendKey('re_short')
    assert.equal(bad.accepted, false)
  })
})
