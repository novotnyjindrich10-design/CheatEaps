/**
 * Offline kontrola SQL migrací propagace — nic nespouští na DB.
 * Exit 0 = kontrakt OK. Produkci ani test DB tímto skriptem neměníš.
 *
 * Spuštění: node scripts/sql-migration-dry-run.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const errors = []

function read(rel) {
  const path = resolve(root, rel)
  if (!existsSync(path)) {
    errors.push(`chybí ${rel}`)
    return ''
  }
  return readFileSync(path, 'utf8')
}

function strip(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/'(?:''|[^'])*'/g, "''")
}

function must(sql, re, label) {
  if (!re.test(sql)) errors.push(label)
}

function mustNot(sql, re, label) {
  if (re.test(sql)) errors.push(label)
}

const orders = read('supabase/promotion-orders.sql')
const owners = read('supabase/promotion-owners.sql')
const applyMissing = read('supabase/promotion-apply-missing.sql')
const bootstrap = read('supabase/bootstrap-all.sql')

must(orders, /NESPUSŤ bez výslovného schválení/, 'orders: chybí varování NESPUSŤ')
must(owners, /NESPUSŤ bez výslovného schválení/, 'owners: chybí varování NESPUSŤ')
must(applyMissing, /NESPUSŤ bez výslovného schválení/, 'apply-missing: chybí varování NESPUSŤ')
mustNot(bootstrap, /promotion_orders/, 'bootstrap nesmí tahat promotion_orders')
mustNot(bootstrap, /place_owner_claims/, 'bootstrap nesmí tahat place_owner_claims')

must(orders, /enable row level security/, 'orders: RLS')
must(orders, /is_cheapeats_admin\(\)/, 'orders: admin gate')
must(orders, /record_verified_payment/, 'orders: payment RPC')
must(orders, /grant execute on function public\.record_verified_payment/, 'orders: service_role grant')
mustNot(orders, /grant execute on function public\.record_verified_payment\(text, text, text, text\) to anon/, 'orders: anon nesmí payment RPC')
must(orders, /'activated', false/, 'orders: RPC nesmí samo aktivovat')
mustNot(strip(orders), /\bdrop\s+table\b/i, 'orders: drop table')
mustNot(strip(orders), /\btruncate\b/i, 'orders: truncate')

must(owners, /place_owner_claims/, 'owners: claims table')
must(owners, /promotion_audit_log/, 'owners: audit table')
must(owners, /enable row level security/, 'owners: RLS')
must(owners, /Rollback:/, 'owners: rollback postup')
mustNot(strip(owners), /\bdrop\s+table\b/i, 'owners: drop table v těle (rollback jen v komentáři)')
mustNot(owners, /grant update on public\.place_owner_claims to authenticated/, 'owners: authenticated nesmí update claims')
must(owners, /status = 'pending'/, 'owners: insert jen pending')

must(applyMissing, /submit_promotion_inquiry/, 'apply-missing: submit RPC')
must(applyMissing, /read_promotion_inquiry/, 'apply-missing: read RPC')
must(applyMissing, /record_verified_payment/, 'apply-missing: payment RPC')
must(applyMissing, /place_owner_claims/, 'apply-missing: owners')
must(applyMissing, /set search_path = public, extensions, pg_temp/, 'apply-missing: search_path')
must(applyMissing, /grant execute on function public\.record_verified_payment\(text, text, text, text\) to service_role/, 'apply-missing: service_role only')
mustNot(applyMissing, /grant execute on function public\.record_verified_payment\(text, text, text, text\) to anon/, 'apply-missing: anon nesmí payment RPC')
mustNot(strip(applyMissing), /\bdrop\s+table\b/i, 'apply-missing: drop table')
mustNot(strip(applyMissing), /\btruncate\b/i, 'apply-missing: truncate')
mustNot(strip(applyMissing), /\bdelete\s+from\b/i, 'apply-missing: delete')
mustNot(strip(applyMissing), /\balter\s+database\s+postgres\s+set\s+app\.payment_webhook_secret\b/i, 'apply-missing: nesmí vkládat payment secret')

const dollars = (orders.match(/\$\$/g) || []).length + (applyMissing.match(/\$\$/g) || []).length
if (dollars % 2 !== 0) errors.push('orders/apply-missing: neuzavřené $$ bloky')

let depth = 0
for (const char of strip(orders + '\n' + owners + '\n' + applyMissing)) {
  if (char === '(') depth += 1
  if (char === ')') depth -= 1
  if (depth < 0) {
    errors.push('nevyvážené závorky')
    break
  }
}
if (depth !== 0) errors.push(`nevyvážené závorky (depth=${depth})`)

console.log(JSON.stringify({
  ok: errors.length === 0,
  isolatedDb: 'unavailable-here',
  note: 'Docker daemon / vzdálená test DB v tomto běhu nejsou k dispozici. Kontrakt SQL je offline OK; produkci spusť až po schválení: supabase/promotion-apply-missing.sql',
  files: [
    'supabase/promotion-orders.sql',
    'supabase/promotion-owners.sql',
    'supabase/promotion-apply-missing.sql',
  ],
  errors,
}, null, 2))

process.exit(errors.length ? 1 : 0)
