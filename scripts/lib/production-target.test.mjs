import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PREVIEW_SUPABASE_REF,
  PRODUCTION_SUPABASE_REF,
  assertNotProductionTarget,
  assertPreviewSupabaseTarget,
  isPreviewSupabaseTarget,
  isProductionSupabaseTarget,
} from './production-target.mjs'

describe('production-target', () => {
  it('rozliší produkci a preview', () => {
    assert.equal(isProductionSupabaseTarget(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`), true)
    assert.equal(isPreviewSupabaseTarget(`https://${PREVIEW_SUPABASE_REF}.supabase.co`), true)
    assert.equal(isProductionSupabaseTarget(`https://${PREVIEW_SUPABASE_REF}.supabase.co`), false)
    assert.doesNotThrow(() => assertNotProductionTarget(`https://${PREVIEW_SUPABASE_REF}.supabase.co`))
    assert.throws(() => assertNotProductionTarget(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`))
    assert.doesNotThrow(() => assertPreviewSupabaseTarget(`postgres://x@db.${PREVIEW_SUPABASE_REF}.supabase.co:5432/postgres`))
    assert.throws(() => assertPreviewSupabaseTarget(`postgres://x@db.${PRODUCTION_SUPABASE_REF}.supabase.co:5432/postgres`))
    assert.throws(() => assertPreviewSupabaseTarget('postgres://localhost/postgres'))
  })
})
