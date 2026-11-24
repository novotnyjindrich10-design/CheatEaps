/**
 * Kontrola, jestli remote Supabase už má tabulky a RPC FoodGo.
 * Čte jen .env (SUPABASE_URL + SUPABASE_ANON_KEY). Žádné tajemství nevypisuje.
 * Spuštění: node scripts/check-supabase-schema.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { supabaseApiHeaders } from '../src/server/supabaseApiHeaders.js'
import { isProductionSupabaseTarget } from './lib/production-target.mjs'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

async function probeTable(base, headers, table) {
  const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=0`, { headers })
  const text = await res.text()
  const missingTable = res.status === 404 || /PGRST205|Could not find the table/i.test(text)
  const forbidden = res.status === 401 || res.status === 403
  if (missingTable) return 'MISSING'
  if (forbidden) return 'EXISTS (read blocked for anon — očekávané u chráněných tabulek)'
  if (res.ok) return 'EXISTS'
  return `HTTP ${res.status} ${text.slice(0, 120)}`
}

async function probeRpc(paths, rpc) {
  return paths.has(`/rpc/${rpc}`) ? 'PRESENT' : 'MISSING'
}

const env = loadEnv()
const base = String(env.SUPABASE_URL || '')
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/$/, '')
const key = String(env.SUPABASE_ANON_KEY || '').trim()

if (!base || !key) {
  console.error('Chybí SUPABASE_URL nebo SUPABASE_ANON_KEY v .env')
  process.exit(2)
}

const headers = {
  ...supabaseApiHeaders({ apiKey: key }),
  Accept: 'application/json',
}

if (isProductionSupabaseTarget(base)) {
  console.log('target: PRODUCTION project (read-only probe, žádný zápis)')
} else {
  console.log('target: not the known production ref')
}

const specRes = await fetch(`${base}/rest/v1/`, { headers })
const spec = specRes.ok ? await specRes.json().catch(() => ({})) : {}
const rpcPaths = new Set(Object.keys(spec.paths || {}).filter((path) => path.startsWith('/rpc/')))
if (!specRes.ok) {
  console.log(`OpenAPI schema: HTTP ${specRes.status} — RPC přítomnost je NOT TESTED, funkce se nespouštějí.`)
}
console.log('host', new URL(base).host)
console.log('key_kind', key.startsWith('sb_publishable') ? 'publishable' : key.includes('.') ? 'jwt-like' : 'other')

const coreTables = [
  'profiles',
  'favorites',
  'reviews',
  'review_reports',
  'business_applications',
  'published_places',
]

console.log('\nZáklad (bootstrap-all / auth + community + business):')
let missing = 0
for (const table of coreTables) {
  const status = await probeTable(base, headers, table)
  if (status === 'MISSING') missing += 1
  console.log(`${table}: ${status}`)
}

console.log('\nPropagace (supabase/promotion-orders.sql):')
const promoTables = ['promotion_orders', 'promotion_payment_events', 'promotion_sponsorships_public']
let promoMissing = 0
for (const table of promoTables) {
  const status = await probeTable(base, headers, table)
  if (status === 'MISSING') promoMissing += 1
  console.log(`${table}: ${status}`)
}

const promoRpcs = [
  'submit_promotion_inquiry',
  'read_promotion_inquiry',
  'record_verified_payment',
  'activate_verified_promotion',
  'review_place_owner_claim',
]
let promoRpcMissing = 0
for (const rpc of promoRpcs) {
  const status = specRes.ok ? await probeRpc(rpcPaths, rpc) : 'NOT TESTED'
  if (status === 'MISSING') promoRpcMissing += 1
  console.log(`rpc/${rpc}: ${status}`)
}

const adminFn = specRes.ok ? await probeRpc(rpcPaths, 'is_cheapeats_admin') : 'NOT TESTED'
console.log(`rpc/is_cheapeats_admin: ${adminFn}`)

console.log('\nVlastníci / audit (supabase/promotion-owners.sql):')
const ownerTables = ['place_owner_claims', 'promotion_audit_log']
let ownerMissing = 0
for (const table of ownerTables) {
  const status = await probeTable(base, headers, table)
  if (status === 'MISSING') ownerMissing += 1
  console.log(`${table}: ${status}`)
}

console.log('\nVolitelné (loyalty / reports / stats):')
const optionalTables = [
  'loyalty_transactions',
  'loyalty_rewards',
  'loyalty_reward_codes',
  'loyalty_redemptions',
  'place_reports',
  'place_stats_daily',
]
let optionalMissing = 0
for (const table of optionalTables) {
  const status = await probeTable(base, headers, table)
  if (status === 'MISSING') optionalMissing += 1
  console.log(`${table}: ${status}`)
}

console.log(
  missing
    ? `\nChybí ${missing} základních tabulek. V SQL Editoru spusť supabase/bootstrap-all.sql`
    : '\nZákladní tabulky jsou dostupné (nebo správně chráněné RLS).',
)
if (promoMissing || promoRpcMissing) {
  console.log(
    `Propagace: chybí ${promoMissing} tabulek a ${promoRpcMissing} RPC. Po schválení spusť supabase/promotion-orders.sql`,
  )
} else {
  console.log('Propagace: tabulky i RPC jsou dostupné (nebo správně chráněné).')
}
if (ownerMissing) {
  console.log(`Owners: chybí ${ownerMissing} tabulek. Po schválení spusť supabase/promotion-owners.sql`)
} else {
  console.log('Owners: tabulky jsou dostupné (nebo správně chráněné RLS).')
}
if (optionalMissing) {
  console.log(`Volitelné: chybí ${optionalMissing} tabulek (loyalty.sql / place-reports.sql / place-stats.sql).`)
}

process.exit(missing ? 1 : 0)
