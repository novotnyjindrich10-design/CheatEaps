import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapAuthError } from './supabaseAuth.js'

describe('mapAuthError', () => {
  it('skryje technické detaily Resendu před uživatelem', () => {
    const mapped = mapAuthError({
      message: 'Error sending confirmation email to user',
      error_code: 'unexpected_failure',
    })
    assert.equal(mapped.error, 'email-delivery-failed')
    assert.match(mapped.message, /Potvrzovací e-mail/i)
    assert.match(mapped.message, /foodgocz@gmail\.com/i)
    assert.equal(mapped.message.toLowerCase().includes('resend'), false)
    assert.equal(mapped.message.toLowerCase().includes('trial'), false)
    assert.equal(mapped.message.toLowerCase().includes('smtp'), false)
  })

  it('ponechá srozumitelnou hlášku pro nepotvrzený e-mail', () => {
    const mapped = mapAuthError({ error_code: 'email_not_confirmed' })
    assert.equal(mapped.error, 'email-not-confirmed')
    assert.match(mapped.message, /potvrď e-mail/i)
  })
})
