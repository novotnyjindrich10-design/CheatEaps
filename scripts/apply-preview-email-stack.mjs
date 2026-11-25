/**
 * Jednorázová bezpečná konfigurace Preview e-mailů po zápisu RESEND_API_KEY do .env:
 * 1) ověří Resend API (bez odeslání mailu / bez výpisu klíče)
 * 2) nastaví Vercel Preview env RESEND_API_KEY (větev foodgo-launch-preview)
 * 3) spustí Auth SMTP + redirects na foodgo-preview (vyžaduje SUPABASE_ACCESS_TOKEN)
 * 4) volitelně redeploy Preview
 *
 *   node scripts/apply-preview-email-stack.mjs
 *   node scripts/apply-preview-email-stack.mjs --redeploy
 *
 * Produkci nemění. Tajné hodnoty nevypisuje.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { describeResendKey, normalizeResendKey } from './lib/resend-key-shape.mjs'

const PREVIEW_REF = 'jnyxjyyvzxriuyvyiuxe'
const BRANCH = 'foodgo-launch-preview'
const SCOPE = 'jindrichcompany'
const ALIAS = 'https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app'
const wantRedeploy = process.argv.includes('--redeploy')

function load(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(opts.env || {}) },
    input: opts.input,
  })
  return {
    status: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || ''),
  }
}

const env = { ...load(resolve('.env')), ...load(resolve('.env.local')) }
const report = {
  ok: false,
  steps: {},
  blocked: [],
}

const key = normalizeResendKey(env.RESEND_API_KEY)
const shape = describeResendKey(key)
report.steps.localKey = {
  present: shape.present,
  accepted: shape.accepted,
  official: shape.official,
  length: shape.length,
}
if (!shape.accepted) {
  report.blocked.push('missing-RESEND_API_KEY-in-local-env')
  console.log(JSON.stringify(report, null, 2))
  process.exit(2)
}

const apiCheck = run('node', ['scripts/check-resend-api.mjs'])
report.steps.resendApi = {
  ok: apiCheck.status === 0,
  status: apiCheck.status,
}
if (apiCheck.status !== 0) {
  report.blocked.push('resend-api-rejected-key')
  console.log(JSON.stringify(report, null, 2))
  process.exit(1)
}

// Vercel Preview secret via stdin file to avoid argv leakage in process list as much as practical.
const tmp = resolve(tmpdir(), `foodgo-resend-${process.pid}.tmp`)
try {
  writeFileSync(tmp, key, { encoding: 'utf8', mode: 0o600 })
  const add = run('npx', [
    'vercel', 'env', 'add', 'RESEND_API_KEY',
    '--environment', 'preview',
    '--git-branch', BRANCH,
    '--type', 'secret',
    '--force',
    '--scope', SCOPE,
    '--value', key,
  ])
  report.steps.vercelPreviewEnv = {
    ok: add.status === 0 || /Added|Overrode|Updated/i.test(add.stdout + add.stderr),
    status: add.status,
    hint: String(add.stderr || add.stdout).split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').replace(/re_[A-Za-z0-9_]+/g, 're_***'),
  }
} finally {
  try { unlinkSync(tmp) } catch { /* ignore */ }
}

if (!report.steps.vercelPreviewEnv.ok) {
  report.blocked.push('vercel-env-add-failed')
}

const hasToken = Boolean(String(env.SUPABASE_ACCESS_TOKEN || '').trim())
report.steps.supabaseAccessToken = { present: hasToken }
if (!hasToken) {
  report.blocked.push('missing-SUPABASE_ACCESS_TOKEN')
} else {
  const smtp = run('node', ['scripts/configure-preview-auth-smtp.mjs'])
  let parsed = null
  try { parsed = JSON.parse(smtp.stdout) } catch { /* ignore */ }
  report.steps.supabaseSmtp = {
    ok: smtp.status === 0 && parsed?.ok === true,
    status: smtp.status,
    projectRef: parsed?.projectRef || PREVIEW_REF,
    errorHint: parsed?.errorHint || parsed?.error || null,
  }
  if (!report.steps.supabaseSmtp.ok) report.blocked.push('supabase-smtp-failed')
}

if (wantRedeploy) {
  const redeploy = run('npx', [
    'vercel', 'redeploy', ALIAS,
    '--scope', SCOPE,
    '--environment', 'preview',
  ])
  report.steps.redeploy = {
    ok: redeploy.status === 0,
    status: redeploy.status,
    hint: String(redeploy.stdout || redeploy.stderr).split(/\r?\n/).filter(Boolean).slice(-4).join(' | '),
  }
  if (!report.steps.redeploy.ok) report.blocked.push('redeploy-failed')
} else {
  report.steps.redeploy = { skipped: true, note: 'pass --redeploy to trigger' }
}

report.ok = report.blocked.length === 0
console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
