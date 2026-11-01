import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rememberResetNext, postLoginTarget, takeResetNext } from './authReturn.js'
import {
  hasRecoveryCallback,
  parseRecoveryLink,
  recoveryCallbackLocation,
  recoveryFailureMessage,
  recoveryPrepareBody,
  stripRecoveryParams,
} from './recoveryLink.js'

describe('odkaz na nové heslo', () => {
  it('přečte recovery tokeny z hash i query a odmítne vypršelý nebo cizí odkaz', () => {
    const ready = parseRecoveryLink(
      'http://127.0.0.1:5173/nove-heslo#access_token=aaa&refresh_token=bbb&type=recovery',
    )
    assert.equal(ready.status, 'ready')
    assert.equal(ready.kind, 'tokens')
    assert.equal(ready.accessToken, 'aaa')
    assert.equal(ready.refreshToken, 'bbb')

    const queryTokens = parseRecoveryLink(
      'http://127.0.0.1:5173/?access_token=ccc&refresh_token=ddd&type=recovery',
    )
    assert.equal(queryTokens.status, 'ready')
    assert.equal(queryTokens.accessToken, 'ccc')

    assert.equal(
      parseRecoveryLink('http://127.0.0.1:5173/nove-heslo#error=access_denied&error_code=otp_expired').status,
      'invalid',
    )
    assert.equal(
      parseRecoveryLink('http://127.0.0.1:5173/?error=access_denied&error_code=otp_expired').status,
      'invalid',
    )
    assert.equal(parseRecoveryLink('http://127.0.0.1:5173/nove-heslo#type=signup&access_token=a&refresh_token=b').status, 'invalid')
    assert.equal(parseRecoveryLink('http://127.0.0.1:5173/nove-heslo').status, 'missing')
    assert.match(recoveryFailureMessage('invalid'), /vypršel|použitý/)
    assert.match(recoveryFailureMessage('missing'), /relace/)
  })

  it('umí PKCE code i token_hash a přesměruje callback ze Site URL', () => {
    const code = parseRecoveryLink('http://127.0.0.1:5173/nove-heslo?code=auth-code-1&sb_flow_id=abc123')
    assert.equal(code.status, 'ready')
    assert.equal(code.kind, 'code')
    assert.equal(code.code, 'auth-code-1')
    assert.deepEqual(recoveryPrepareBody(code), { code: 'auth-code-1', flowId: 'abc123' })

    const hashed = parseRecoveryLink(
      'http://127.0.0.1:5173/nove-heslo?token_hash=hash-1&type=recovery',
    )
    assert.equal(hashed.kind, 'token_hash')
    assert.deepEqual(recoveryPrepareBody(hashed), { tokenHash: 'hash-1', type: 'recovery' })

    assert.equal(hasRecoveryCallback('http://127.0.0.1:5173/#access_token=a&refresh_token=b&type=recovery'), true)
    assert.equal(hasRecoveryCallback('http://127.0.0.1:5173/results'), false)
    assert.deepEqual(
      recoveryCallbackLocation('http://127.0.0.1:5173/#access_token=a&refresh_token=b&type=recovery'),
      {
        pathname: '/nove-heslo',
        search: '',
        hash: '#access_token=a&refresh_token=b&type=recovery',
      },
    )
    assert.equal(
      stripRecoveryParams('http://127.0.0.1:5173/nove-heslo?code=x#access_token=a&refresh_token=b'),
      '/nove-heslo',
    )
  })

  it('návrat po změně hesla zůstane uvnitř aplikace', () => {
    const storage = new Map()
    const store = {
      setItem: (key, value) => storage.set(key, value),
      getItem: (key) => storage.get(key) ?? null,
    }
    const next = postLoginTarget('next=%2Fnabidka%2Fabc&obnova=1')
    rememberResetNext(next, store)
    assert.equal(takeResetNext(store), '/nabidka/abc')
    rememberResetNext('https://evil.test', store)
    assert.equal(takeResetNext(store), '/results')
  })
})
