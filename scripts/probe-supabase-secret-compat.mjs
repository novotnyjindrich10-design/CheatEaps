/**
 * Skutečný HTTP probe sb_secret_ / service role proti live projektu.
 * Vyžaduje SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY v .env (nevypisuje hodnoty).
 * Exit 0 = secret funguje přes apikey-only. Exit 2 = klíč chybí (skip).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { supabaseApiHeaders, isNewSupabaseApiKey } from '../src/server/supabaseApiHeaders.js'

function loadEnv() {
  const path = resolve(process.cwd(), '.env')
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
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
const secret = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim()

if (!base || !secret) {
  console.log(JSON.stringify({
    ok: false,
    skipped: true,
    reason: 'missing-SUPABASE_SERVICE_ROLE_KEY',
    note: 'Doplň secret do lokálního .env (ne do gitu) a spusť znovu.',
  }, null, 2))
  process.exit(2)
}

const headersOnly = supabaseApiHeaders({ apiKey: secret })
const headersBoth = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  Accept: 'application/json',
}

const url = `${base}/rest/v1/promotion_orders?select=id&limit=0`
const a = await fetch(url, { headers: headersOnly })
const b = await fetch(url, { headers: headersBoth })
const textA = await a.text()
const textB = await b.text()

console.log(JSON.stringify({
  ok: a.ok || a.status === 200 || a.status === 206,
  key_kind: isNewSupabaseApiKey(secret) ? 'sb_secret' : secret.startsWith('eyJ') ? 'legacy-jwt' : 'other',
  apikey_only_status: a.status,
  apikey_and_bearer_status: b.status,
  apikey_only_has_auth_header: Boolean(headersOnly.Authorization),
  bearer_rejected_as_jwt: /invalid jwt|jwt/i.test(textB) && !b.ok,
  note: 'Nevypisuje tělo ani klíč. FoodGo posílá sb_secret_ jen v apikey.',
  snippet_a: textA.slice(0, 80),
  snippet_b: textB.slice(0, 80),
}, null, 2))

process.exit(a.ok || a.status === 200 || a.status === 206 ? 0 : 1)
