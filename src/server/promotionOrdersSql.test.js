/**
 * Kontrakt supabase/promotion-orders.sql bez připojení k databázi.
 * Soubor se v testu nespouští a není součást bootstrap-all.sql.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const sql = readFileSync(new URL('../../supabase/promotion-orders.sql', import.meta.url), 'utf8')
const ownersSql = readFileSync(new URL('../../supabase/promotion-owners.sql', import.meta.url), 'utf8')
const applyMissing = readFileSync(
  new URL('../../supabase/promotion-apply-missing.sql', import.meta.url),
  'utf8',
)
const bootstrap = readFileSync(new URL('../../supabase/bootstrap-all.sql', import.meta.url), 'utf8')

function functionSource(source, name) {
  const start = source.indexOf(`function public.${name}`)
  if (start < 0) return ''
  const end = source.indexOf('\n$$;', start)
  return source.slice(start, end < 0 ? source.length : end)
}

function stripSqlCommentsAndStrings(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/'(?:''|[^'])*'/g, "''")
}

describe('SQL poptávek propagace', () => {
  it('má platnou PostgreSQL syntaxi bez markdown escapování', () => {
    assert.equal(sql.includes('new.renewal'), true)
    assert.equal(sql.includes("!~ '^[a-z0-9]"), true)
    assert.equal(/new\\\./.test(sql), false)
    assert.equal(/!\\~/.test(sql), false)
    assert.equal(/old\\\./.test(sql), false)
    const dollars = sql.match(/\$\$/g) || []
    assert.equal(dollars.length % 2, 0)
    const stripped = stripSqlCommentsAndStrings(sql)
    let depth = 0
    for (const char of stripped) {
      if (char === '(') depth += 1
      if (char === ')') depth -= 1
      assert.ok(depth >= 0)
    }
    assert.equal(depth, 0)
    assert.doesNotMatch(stripped, /\bdrop\s+table\b/i)
    assert.doesNotMatch(stripped, /\btruncate\b/i)
    assert.doesNotMatch(stripped, /\bdelete\s+from\s+public\.(profiles|restaurants|business_applications|published_places)\b/i)
    assert.doesNotMatch(stripped, /\balter\s+table\s+public\.(profiles|business_applications|published_places)\b/i)
  })

  it('se nespouští s bootstrapem a vyžaduje existující admin roli', () => {
    assert.match(sql, /NESPUSŤ bez výslovného schválení/)
    assert.doesNotMatch(bootstrap, /promotion_orders/)
    assert.match(sql, /chybí public\.profiles/)
    assert.match(sql, /chybí profiles\.is_admin/)
    assert.match(sql, /chybí public\.is_cheapeats_admin/)
    assert.match(sql, /information_schema\.columns/)
  })

  it('drží tabulku zavřenou a veřejný výpis bez kontaktů', () => {
    assert.match(sql, /enable row level security/)
    assert.match(sql, /using \(public\.is_cheapeats_admin\(\)\)/)
    assert.match(sql, /revoke all on public\.promotion_orders from anon, authenticated/)
    assert.match(sql, /grant select, update on public\.promotion_orders to authenticated/)
    assert.doesNotMatch(sql, /grant (insert|delete|all) on public\.promotion_orders to (anon|authenticated)/)
    assert.match(sql, /security_invoker = false/)
    assert.match(sql, /select place_id, plan_id, starts_at, ends_at/)
    assert.doesNotMatch(sql, /select \* from public\.promotion_orders/)
  })

  it('přepočítá cenu, vynutí poptávku a reklamu bez úhrady nepustí', () => {
    assert.match(sql, /when 'start' then 99/)
    assert.match(sql, /when 'plus' then 199/)
    assert.match(sql, /when 'premium' then 399/)
    assert.match(sql, /amount := monthly \* 10/)
    assert.match(sql, /'inquiry'/)
    assert.match(sql, /'none'/)
    assert.match(sql, /termsAck/)
    assert.match(sql, /activation-requires-payment/)
    assert.match(sql, /activation-requires-admin/)
    assert.match(sql, /payment-requires-admin-or-webhook/)
    assert.match(sql, /promotion-fields-locked/)
    assert.match(sql, /app\.promotion_payment_hook/)
    assert.match(sql, /app\.promotion_activation_hook/)
    assert.match(sql, /old\.payment_status is distinct from 'paid'/)
    assert.match(sql, /check \(renewal = 'none'\)/)
    assert.match(sql, /promotion_orders_one_open/)
    assert.match(sql, /when unique_violation then/)
    assert.match(sql, /rate-limited/)
    assert.doesNotMatch(sql, /app\.payment_webhook_secret/)
    assert.match(functionSource(sql, 'record_verified_payment'), /'activated', false/)
    assert.doesNotMatch(functionSource(sql, 'record_verified_payment'), /status = 'active'/)
    assert.match(functionSource(sql, 'activate_verified_promotion'), /status = 'active'/)
    assert.match(sql, /create extension if not exists pgcrypto with schema extensions/)
    assert.match(
      sql,
      /revoke all on function public\.record_verified_payment\(text, text, text, text\) from public, anon, authenticated/,
    )
    assert.match(
      sql,
      /grant execute on function public\.record_verified_payment\(text, text, text, text\) to service_role/,
    )
    assert.doesNotMatch(
      sql,
      /grant execute on function public\.record_verified_payment\(text, text, text, text\) to anon/,
    )
  })

  it('připraví vlastníky a audit bez spuštění a bez mazání objednávek', () => {
    assert.match(ownersSql, /NESPUSŤ bez výslovného schválení/)
    assert.match(ownersSql, /place_owner_claims/)
    assert.match(ownersSql, /promotion_audit_log/)
    assert.match(ownersSql, /status = 'pending'/)
    assert.match(ownersSql, /enable row level security/)
    assert.match(ownersSql, /Rollback:/)
    assert.match(ownersSql, /drop table public\.promotion_audit_log/)
    assert.match(ownersSql, /drop table public\.place_owner_claims/)
    assert.match(ownersSql, /place_owner_claims_insert_own/)
    assert.match(ownersSql, /user_id = auth\.uid\(\)/)
    assert.doesNotMatch(bootstrap, /place_owner_claims/)
    assert.doesNotMatch(stripSqlCommentsAndStrings(ownersSql), /\bdrop\s+table\b/i)
    assert.doesNotMatch(ownersSql, /grant update on public\.place_owner_claims to authenticated/)
    assert.doesNotMatch(ownersSql, /grant insert on public\.promotion_audit_log to authenticated/)
  })

  it('promotion-apply-missing.sql doplní jen RPC/owners bez destrukce dat', () => {
    assert.match(applyMissing, /NESPUSŤ bez výslovného schválení/)
    assert.match(applyMissing, /submit_promotion_inquiry/)
    assert.match(applyMissing, /read_promotion_inquiry/)
    assert.match(applyMissing, /record_verified_payment/)
    assert.match(applyMissing, /place_owner_claims/)
    assert.match(applyMissing, /promotion_audit_log/)
    assert.match(applyMissing, /security definer/)
    assert.match(applyMissing, /set search_path = public, extensions, pg_temp/)
    assert.match(applyMissing, /activation-requires-admin/)
    assert.match(applyMissing, /payment-requires-admin-or-webhook/)
    assert.match(applyMissing, /grant execute on function public\.record_verified_payment\(text, text, text, text\) to service_role/)
    assert.match(applyMissing, /grant execute on function public\.submit_promotion_inquiry\(jsonb, text, text\) to service_role/)
    assert.match(applyMissing, /grant execute on function public\.read_promotion_inquiry\(text, text\) to service_role/)
    assert.match(applyMissing, /activate_verified_promotion/)
    assert.match(applyMissing, /review_place_owner_claim/)
    assert.match(applyMissing, /self-review/)
    assert.match(applyMissing, /protect_profiles_row/)
    assert.match(applyMissing, /rate-limited/)
    assert.doesNotMatch(applyMissing, /grant execute on function public\.record_verified_payment\(text, text, text, text\) to anon/)
    assert.doesNotMatch(applyMissing, /grant execute on function public\.submit_promotion_inquiry\(jsonb, text, text\) to anon/)
    assert.doesNotMatch(functionSource(applyMissing, 'record_verified_payment'), /status = 'active'/)
    assert.match(functionSource(applyMissing, 'activate_verified_promotion'), /status = 'active'/)
    const strippedApply = stripSqlCommentsAndStrings(applyMissing)
    assert.doesNotMatch(strippedApply, /\bdrop\s+table\b/i)
    assert.doesNotMatch(strippedApply, /\btruncate\b/i)
    assert.doesNotMatch(strippedApply, /\bdelete\s+from\b/i)
    assert.doesNotMatch(strippedApply, /\balter\s+database\s+postgres\s+set\s+app\.payment_webhook_secret\b/i)
    const dollars = applyMissing.match(/\$\$/g) || []
    assert.equal(dollars.length % 2, 0)
  })
})