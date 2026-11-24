import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { authConfig } from './supabaseAuth.js'
import {
  isLegacyJwtApiKey,
  isNewSupabaseApiKey,
  supabaseApiHeaders,
} from './supabaseApiHeaders.js'

describe('supabaseApiHeaders — nové vs legacy klíče', () => {
  it('sb_publishable_ dá jen apikey, ne Authorization Bearer', () => {
    const headers = supabaseApiHeaders({ apiKey: 'sb_publishable_test_abc' })
    assert.equal(headers.apikey, 'sb_publishable_test_abc')
    assert.equal(headers.Authorization, undefined)
    assert.equal(isNewSupabaseApiKey(headers.apikey), true)
  })

  it('sb_secret_ dá jen apikey (server-only pattern)', () => {
    const headers = supabaseApiHeaders({ apiKey: 'sb_secret_test_xyz' })
    assert.equal(headers.apikey, 'sb_secret_test_xyz')
    assert.equal(headers.Authorization, undefined)
  })

  it('uživatelský JWT jde do Authorization i u publishable klíče', () => {
    const headers = supabaseApiHeaders({
      apiKey: 'sb_publishable_test_abc',
      accessToken: 'eyJhbGciOiJIUzI1NiJ9.user.token',
    })
    assert.equal(headers.apikey, 'sb_publishable_test_abc')
    assert.equal(headers.Authorization, 'Bearer eyJhbGciOiJIUzI1NiJ9.user.token')
  })

  it('legacy JWT anon zůstane v apikey i Bearer', () => {
    const legacy = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.anon.sig'
    const headers = supabaseApiHeaders({ apiKey: legacy })
    assert.equal(isLegacyJwtApiKey(legacy), true)
    assert.equal(headers.apikey, legacy)
    assert.equal(headers.Authorization, `Bearer ${legacy}`)
  })

  it('authConfig bere publishable/secret aliasy a neplete je', () => {
    const fromLegacyNames = authConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'sb_publishable_from_anon',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_from_service',
    })
    assert.equal(fromLegacyNames.anonKey, 'sb_publishable_from_anon')
    assert.equal(fromLegacyNames.serviceRoleKey, 'sb_secret_from_service')
    assert.equal(fromLegacyNames.configured, true)

    const fromAliases = authConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_alias',
      SUPABASE_SECRET_KEY: 'sb_secret_alias',
    })
    assert.equal(fromAliases.anonKey, 'sb_publishable_alias')
    assert.equal(fromAliases.serviceRoleKey, 'sb_secret_alias')
  })
})
