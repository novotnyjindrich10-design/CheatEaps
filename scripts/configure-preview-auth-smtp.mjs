/**
 * Nastaví custom SMTP (Resend) + Site/Redirect URL jen pro foodgo-preview.
 * Vyžaduje lokálně (ne v gitu):
 *   SUPABASE_ACCESS_TOKEN  — https://supabase.com/dashboard/account/tokens
 *   RESEND_API_KEY         — Resend → API Keys
 * Volitelně:
 *   EMAIL_FROM             — výchozí FoodGo <onboarding@resend.dev>
 *
 *   node scripts/configure-preview-auth-smtp.mjs
 *
 * Nevypisuje tajné hodnoty. Produkční ref odmítne.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PREVIEW_REF = 'jnyxjyyvzxriuyvyiuxe'
const PRODUCTION_REF = 'pcptzyfoojmnspumcmsi'
const SITE = 'https://cheat-eaps-git-foodgo-launch-preview-jindrichcompany.vercel.app'
const REDIRECTS = [
  `${SITE}/nove-heslo`,
  'http://127.0.0.1:5173/nove-heslo',
  'http://localhost:5173/nove-heslo',
]

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return env
}

const fileEnv = { ...loadEnvFile(resolve('.env')), ...loadEnvFile(resolve('.env.local')) }
const token = String(process.env.SUPABASE_ACCESS_TOKEN || fileEnv.SUPABASE_ACCESS_TOKEN || '').trim()
const resendKey = String(process.env.RESEND_API_KEY || fileEnv.RESEND_API_KEY || '').trim()
const emailFrom = String(process.env.EMAIL_FROM || fileEnv.EMAIL_FROM || 'FoodGo <onboarding@resend.dev>').trim()
const projectRef = String(process.env.SUPABASE_PROJECT_REF || PREVIEW_REF).trim()

if (projectRef === PRODUCTION_REF || projectRef.includes(PRODUCTION_REF)) {
  console.log(JSON.stringify({ ok: false, error: 'production-ref-forbidden' }, null, 2))
  process.exit(1)
}
if (projectRef !== PREVIEW_REF) {
  console.log(JSON.stringify({ ok: false, error: 'unexpected-ref', projectRef }, null, 2))
  process.exit(1)
}
if (!token) {
  console.log(JSON.stringify({
    ok: false,
    error: 'missing-SUPABASE_ACCESS_TOKEN',
    note: 'Vytvoř personal access token v Supabase Account → Access Tokens a ulož do .env jako SUPABASE_ACCESS_TOKEN.',
  }, null, 2))
  process.exit(2)
}
if (!resendKey || !resendKey.startsWith('re_')) {
  console.log(JSON.stringify({
    ok: false,
    error: 'missing-or-invalid-RESEND_API_KEY',
    note: 'Doplň RESEND_API_KEY (re_…) do .env — npm run resend:key — nebo env.',
  }, null, 2))
  process.exit(2)
}

const senderMatch = emailFrom.match(/^(?:([^<]*?)\s*)?<([^>]+)>$|^([^<>\s]+@[^<>\s]+)$/)
const senderName = (senderMatch?.[1] || 'FoodGo').trim() || 'FoodGo'
const senderEmail = (senderMatch?.[2] || senderMatch?.[3] || '').trim()
if (!senderEmail) {
  console.log(JSON.stringify({ ok: false, error: 'invalid-EMAIL_FROM' }, null, 2))
  process.exit(2)
}

const url = `https://api.supabase.com/v1/projects/${PREVIEW_REF}/config/auth`
const body = {
  external_email_enabled: true,
  mailer_autoconfirm: false,
  site_url: SITE,
  uri_allow_list: REDIRECTS.join(','),
  smtp_admin_email: senderEmail,
  smtp_host: 'smtp.resend.com',
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_pass: resendKey,
  smtp_sender_name: senderName,
}

const response = await fetch(url, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify(body),
})

const text = await response.text()
let parsed = null
try { parsed = JSON.parse(text) } catch { /* ignore */ }

const report = {
  ok: response.ok,
  status: response.status,
  projectRef: PREVIEW_REF,
  siteUrlSet: SITE,
  redirectCount: REDIRECTS.length,
  smtpHost: 'smtp.resend.com',
  smtpPort: '465',
  senderEmail,
  senderName,
  // never echo tokens / smtp_pass / full response bodies that may contain secrets
  errorHint: response.ok
    ? null
    : String(parsed?.message || parsed?.error || text).slice(0, 180).replace(/re_[A-Za-z0-9_]+/g, 're_***'),
}

console.log(JSON.stringify(report, null, 2))
process.exit(response.ok ? 0 : 1)
