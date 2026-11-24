/**
 * FoodGo launch check — bez deploye, DB zápisu, e-mailů a plateb.
 * Spuštění: npm run launch:check
 *
 * Výstup: PASS / WARNING / BLOCKED / FAIL
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const findings = []

function add(status, label, note = '') {
  findings.push({ status, label, note: String(note || '').slice(0, 280) })
}

function run(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status === 0) {
    add('PASS', label)
    return true
  }
  const note = String(result.stderr || result.stdout || '')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-4)
    .join(' | ')
  add('FAIL', label, note)
  return false
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const RESEND_KEY_SHAPE = /^re_[1-9A-HJ-NP-Za-km-z]{8}_[1-9A-HJ-NP-Za-km-z]{24}$/

function checkOperator() {
  try {
    const raw = readFileSync(resolve(root, 'src/constants/operator.js'), 'utf8')
    const fields = ['legalName', 'ico', 'street', 'city', 'postalCode', 'email']
    const missing = fields.filter((field) => {
      const match = raw.match(new RegExp(`${field}:\\s*'([^']*)'`))
      return !match || !String(match[1] || '').trim()
    })
    if (missing.length) {
      add('BLOCKED', 'operator-identity', `prázdné: ${missing.join(', ')} — právní stránky nejsou vydatelné`)
      return
    }
    add('PASS', 'operator-identity')
  } catch (error) {
    add('BLOCKED', 'operator-identity', error.message || 'nelze načíst operator.js')
  }
}

function checkEnv() {
  const env = {
    ...loadEnvFile(resolve(root, '.env')),
    ...loadEnvFile(resolve(root, '.env.local')),
  }
  const key = String(env.RESEND_API_KEY || '').trim()
  const to = String(env.INQUIRY_TO_EMAIL || '').trim()
  const from = String(env.EMAIL_FROM || '').trim()
  const site = String(env.PUBLIC_SITE_URL || '').trim()
  const supabaseUrl = String(env.SUPABASE_URL || '').trim()
  const supabaseAnon = String(env.SUPABASE_ANON_KEY || '').trim()

  if (!existsSync(resolve(root, '.env')) && !existsSync(resolve(root, '.env.local'))) {
    add('WARNING', 'env-file', '.env chybí — lokální e-mail a auth nepůjdou otestovat')
  } else {
    add('PASS', 'env-file')
  }

  // Free katalog v1 nesmí záviset na e-mailech — chybějící Resend = WARNING, ne BLOCKED.
  if (!key) add('WARNING', 'resend-key', 'RESEND_API_KEY chybí — free katalog bez transakčních mailů OK')
  else if (!RESEND_KEY_SHAPE.test(key)) add('WARNING', 'resend-key', `neočekávaný tvar (délka ${key.length})`)
  else add('PASS', 'resend-key', `present, length ${key.length}`)

  if (!to) add('WARNING', 'resend-to', 'INQUIRY_TO_EMAIL chybí — B2B poptávky/mail vypnuté')
  else add('PASS', 'resend-to')

  if (!from) add('WARNING', 'resend-from', 'EMAIL_FROM chybí — free katalog bez mailů OK')
  else if (from.includes('onboarding@resend.dev')) {
    add('WARNING', 'resend-from', 'trial FROM (onboarding@resend.dev) — ostré maily vyžadují ověřenou doménu')
  } else add('PASS', 'resend-from')

  if (!site) add('WARNING', 'public-site-url', 'PUBLIC_SITE_URL chybí — build použije CANONICAL_ORIGIN')
  else if (!/^https:\/\//i.test(site)) add('WARNING', 'public-site-url', 'nepoužívá https')
  else add('PASS', 'public-site-url')

  if (!supabaseUrl || !supabaseAnon) {
    add('WARNING', 'supabase-env', 'SUPABASE_URL / SUPABASE_ANON_KEY chybí lokálně — auth/recenze jen na Vercelu')
  } else add('PASS', 'supabase-env')

  return { keyPresent: Boolean(key), keyShapeOk: RESEND_KEY_SHAPE.test(key) }
}

function checkResendApi(envOk) {
  if (!envOk.keyPresent || !envOk.keyShapeOk) {
    add('BLOCKED', 'resend-api', 'přeskočeno — klíč není připravený')
    return
  }
  const result = spawnSync('node', ['scripts/check-resend-api.mjs'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  let body = {}
  try {
    body = JSON.parse(String(result.stdout || '{}'))
  } catch {
    body = {}
  }
  if (body.authLooksValid || body.canSendProbe?.canAuthenticateForSending) {
    add('PASS', 'resend-api', body.note || `HTTP ${body.httpStatus}`)
    return
  }
  if (body.httpStatus === 401 || body.ok === false) {
    add('BLOCKED', 'resend-api', body.note || body.reason || `HTTP ${body.httpStatus}`)
    return
  }
  add('WARNING', 'resend-api', body.note || `exit ${result.status}`)
}

function summarize() {
  const counts = { PASS: 0, WARNING: 0, BLOCKED: 0, FAIL: 0, 'NOT TESTED': 0 }
  for (const item of findings) counts[item.status] = (counts[item.status] || 0) + 1
  let overall = 'PASS'
  if (counts.FAIL > 0) overall = 'FAIL'
  else if (counts.BLOCKED > 0) overall = 'BLOCKED'
  else if (counts.WARNING > 0) overall = 'WARNING'
  else if (counts['NOT TESTED'] > 0) overall = 'NOT TESTED'
  return { overall, counts }
}

const offline = process.argv.includes('--offline') || process.env.LAUNCH_CHECK_OFFLINE === '1'

checkOperator()
const envOk = checkEnv()
run('unit-tests', 'npm', ['test'])
run('lint', 'npm', ['run', 'lint'])
run('build', 'npm', ['run', 'build'])
run('catalog-audit', 'npm', ['run', 'audit:catalog'])
  if (offline) {
    add('NOT TESTED', 'resend-api', 'přeskočeno (--offline) — nevolá Resend API')
  } else if (!envOk.keyPresent || !envOk.keyShapeOk) {
    add('NOT TESTED', 'resend-api', 'klíč není připravený — odeslání se nezkoušelo')
  } else {
    checkResendApi(envOk)
  }

  add('NOT TESTED', 'comgate-sandbox-payment', 'ostrá ani sandbox transakce u Comgate se z tohoto příkazu nespouští')
  add('NOT TESTED', 'sb-secret-live', 'live probe sb_secret_ jen ručně: node scripts/probe-supabase-secret-compat.mjs')
  add('NOT TESTED', 'interactive-preview', 'chráněné Preview v prohlížeči agenta neověřuje login Vercel')

  const previewSql = readFileSync(resolve(root, 'supabase/promotion-apply-missing.sql'), 'utf8')
  if (
    /grant execute on function public\.submit_promotion_inquiry\(jsonb, text, text\) to service_role/.test(previewSql)
    && !/grant execute on function public\.submit_promotion_inquiry\(jsonb, text, text\) to anon/.test(previewSql)
  ) {
    add('PASS', 'promotion-rpc-grants', 'submit/read nejsou pro anon v SQL')
  } else {
    add('BLOCKED', 'promotion-rpc-grants', 'submit_promotion_inquiry je pořád veřejné')
  }

  const paymentsLive = readFileSync(resolve(root, 'src/server/payments.js'), 'utf8')
  if (/PAYMENTS_LIVE/.test(paymentsLive) && !/PAYMENTS_LIVE\s*=\s*['"]true['"]/.test(paymentsLive)) {
    add('PASS', 'payments-live-default', 'kód nezapíná PAYMENTS_LIVE=true')
  } else {
    add('BLOCKED', 'payments-live-default', 'zkontroluj výchozí stav ostrých plateb')
  }

  const env = {
    ...loadEnvFile(resolve(root, '.env')),
    ...loadEnvFile(resolve(root, '.env.local')),
  }
  const supabaseUrl = String(env.SUPABASE_URL || '')
  if (!supabaseUrl) {
    add('WARNING', 'preview-production-split', 'lokální SUPABASE_URL chybí')
  } else if (supabaseUrl.includes('pcptzyfoojmnspumcmsi')) {
    add('WARNING', 'preview-production-split', 'lokální .env míří na produkční projekt — Preview potřebuje foodgo-preview')
  } else {
    add('PASS', 'preview-production-split')
  }

  if (!String(env.OPERATOR_LEGAL_APPROVED || '').trim()) {
    add('BLOCKED', 'legal-approval', 'právní texty nejsou označené jako schválené provozovatelem')
  } else {
    add('PASS', 'legal-approval')
  }

const summary = summarize()
const report = {
  overall: summary.overall,
  counts: summary.counts,
  findings,
  offline,
  notes: [
    'Neprovádí deploy, platby, ostré e-maily ani zápis do produkční DB.',
    'Nevypisuje tajné hodnoty.',
    'E2E spusť zvlášť: npm run test:e2e',
    'Alias: npm run check:ready → npm run launch:check',
    'Bez síťového Resend: npm run launch:check -- --offline',
  ],
}

console.log(JSON.stringify(report, null, 2))
process.exit(summary.overall === 'FAIL' ? 1 : 0)
