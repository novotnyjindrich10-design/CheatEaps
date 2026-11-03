/**
 * Kontraktní testy supabase/loyalty.sql — bez připojení k databázi.
 * Ověří, že migrace obsahuje bezpečnostní pojistky z auditu.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const sql = readFileSync(new URL('../../supabase/loyalty.sql', import.meta.url), 'utf8')

describe('SQL loyalty migrace — bezpečnostní kontrakt', () => {
  it('ověří předpoklady profiles, is_admin a reviews před instalací', () => {
    assert.match(sql, /chybí public\.profiles/)
    assert.match(sql, /chybí profiles\.is_admin/)
    assert.match(sql, /chybí public\.reviews/)
    assert.match(sql, /information_schema\.columns/)
    assert.match(sql, /column_name = 'is_admin'/)
  })

  it('zamkne moderaci recenzí pro roli authenticated a nechá ji RPC', () => {
    assert.match(sql, /create or replace function public\.protect_review\(\)/)
    assert.match(sql, /current_user in \('authenticated', 'anon'\)/)
    assert.match(sql, /new\.moderation_status := old\.moderation_status/)
    assert.match(sql, /new\.moderated_at := old\.moderated_at/)
    assert.match(sql, /new\.moderated_by := old\.moderated_by/)
    assert.match(sql, /new\.moderation_status := 'pending'/)
    assert.match(sql, /loyalty_award_review_points/)
    assert.match(sql, /loyalty_reject_review/)
    assert.match(sql, /coalesce\(is_admin, false\)/)
  })

  it('chrání loyalty_points sloupcovými granty i triggerem', () => {
    assert.match(sql, /grant update \(display_name\) on table public\.profiles to authenticated/)
    assert.match(sql, /revoke update on table public\.profiles from authenticated/)
    assert.match(sql, /protect_profiles_loyalty_points/)
    assert.match(sql, /new\.loyalty_points := old\.loyalty_points/)
    assert.match(sql, /new\.loyalty_points := 0/)
    assert.doesNotMatch(sql, /grant update on table public\.profiles to authenticated;/)
    assert.doesNotMatch(
      sql,
      /grant (insert|update|delete) on table public\.loyalty_transactions to authenticated/,
    )
  })

  it('nedovolí běžnému uživateli spravovat kódy a drží search_path u DEFINER funkcí', () => {
    assert.match(sql, /loyalty_codes_admin_insert/)
    assert.match(sql, /p\.is_admin is true/)
    assert.match(sql, /set search_path = public, pg_temp/)
    assert.match(sql, /loyalty_transactions_review_reward_once/)
    assert.match(sql, /for update skip locked/)
    assert.match(sql, /code-unavailable/)
    assert.match(sql, /loyalty_v1_reviews_remain_pending/)
    assert.match(sql, /moderation_status text not null default 'pending'/)
    assert.doesNotMatch(sql, /loyalty_v1_review_backfill/)
    assert.doesNotMatch(sql, /moderated_at = coalesce\(moderated_at, created_at\)/)
    assert.doesNotMatch(sql, /insert into public\.loyalty_rewards/i)
    assert.doesNotMatch(sql, /KFC|ukazka-kfc/)
  })
})
