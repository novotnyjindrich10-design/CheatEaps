/**
 * Kontrola, jestli remote Supabase už má tabulky CheapEats.
 * Čte jen .env (SUPABASE_URL + SUPABASE_ANON_KEY). Žádné tajemství nevypisuje.
 * Spuštění: node scripts/check-supabase-schema.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

const headers = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' }
const tables = [
  'profiles',
  'favorites',
  'reviews',
  'review_reports',
  'business_applications',
  'published_places',
]

console.log('host', new URL(base).host)
console.log('key_kind', key.startsWith('sb_publishable') ? 'publishable' : key.includes('.') ? 'jwt-like' : 'other')

let missing = 0
for (const table of tables) {
  const res = await fetch(`${base}/rest/v1/${table}?select=*&limit=0`, { headers })
  const text = await res.text()
  const missingTable = res.status === 404 || /PGRST205|Could not find the table/i.test(text)
  const forbidden = res.status === 401 || res.status === 403
  if (missingTable) {
    missing += 1
    console.log(`${table}: MISSING`)
  } else if (forbidden) {
    console.log(`${table}: EXISTS (read blocked for anon — očekávané u profiles/applications)`)
  } else if (res.ok) {
    console.log(`${table}: EXISTS`)
  } else {
    console.log(`${table}: HTTP ${res.status} ${text.slice(0, 120)}`)
  }
}

console.log(
  missing
    ? `\nChybí ${missing} tabulek. V SQL Editoru spusť supabase/bootstrap-all.sql`
    : '\nVšechny kontrolované tabulky jsou dostupné (nebo správně chráněné RLS).',
)
process.exit(missing ? 1 : 0)
