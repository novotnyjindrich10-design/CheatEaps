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
const bootstrap = read('supabase/bootstrap-all.sql')

must(orders, /NESPUSŤ bez výslovného schválení/, 'orders: chybí varování NESPUSŤ')
must(owners, /NESPUSŤ bez výslovného schválení/, 'owners: chybí varování NESPUSŤ')
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

const dollars = (orders.match(/\$\$/g) || []).length
if (dollars % 2 !== 0) errors.push('orders: neuzavřené $$ bloky')

let depth = 0
for (const char of strip(orders + '\n' + owners)) {
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
  note: 'Docker daemon / vzdálená test DB v tomto běhu nejsou k dispozici. Kontrakt SQL je offline OK; aplikaci na izolované DB udělá provozovatel dle FOODGO-LAUNCH.md F.',
  files: ['supabase/promotion-orders.sql', 'supabase/promotion-owners.sql'],
  errors,
}, null, 2))

process.exit(errors.length ? 1 : 0)
