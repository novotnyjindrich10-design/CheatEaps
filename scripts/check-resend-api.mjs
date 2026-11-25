/**
 * Ověří přístup k Resend API bez odeslání e-mailu.
 * Čte klíč z .env, hodnotu nevypisuje.
 *
 * Sending-only klíče neprojdou GET /domains (restricted_api_key) — to není neplatný klíč.
 * Spuštění: node scripts/check-resend-api.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describeResendKey, normalizeResendKey } from './lib/resend-key-shape.mjs'

function load(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const env = { ...load(resolve('.env')), ...load(resolve('.env.local')), ...process.env }
const apiKey = normalizeResendKey(env.RESEND_API_KEY)

if (!apiKey) {
  console.log(JSON.stringify({ ok: false, reason: 'missing-key', sentEmail: false }, null, 2))
  process.exit(2)
}

const shape = describeResendKey(apiKey)
if (!shape.accepted) {
  console.log(JSON.stringify({
    ok: false,
    reason: 'unexpected-shape',
    length: shape.length,
    prefixOk: shape.prefixOk,
    officialShape: shape.official,
    sentEmail: false,
    note: 'Ocekavano re_ + 8 + _ + 16-64 znaku (oficialne 36 base58).',
  }, null, 2))
  process.exit(2)
}

async function readSafeJson(response) {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return { rawLength: text.length }
  }
}

const domains = await fetch('https://api.resend.com/domains', {
  method: 'GET',
  headers: { Authorization: `Bearer ${apiKey}` },
})
const domainsBody = await readSafeJson(domains)
const restricted = domains.status === 401 && domainsBody?.name === 'restricted_api_key'

// Neodesílá mail: prázdné tělo má spadnout na validaci (422/400), ne na auth (401/403).
const probe = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: '{}',
})
const probeBody = await readSafeJson(probe)
const sendingProbe = {
  httpStatus: probe.status,
  canAuthenticateForSending: probe.status !== 401 && probe.status !== 403,
  validationRejectedEmptyBody: probe.status === 422 || probeBody?.name === 'validation_error' || probe.status === 400,
}

const authLooksValid =
  domains.ok ||
  restricted ||
  (sendingProbe.canAuthenticateForSending && sendingProbe.validationRejectedEmptyBody)
const permission = domains.ok ? 'full_access' : restricted ? 'sending_access' : authLooksValid ? 'sending_access' : 'unknown'

const report = {
  ok: Boolean(authLooksValid),
  httpStatus: domains.status,
  permission,
  shapeOk: true,
  authLooksValid,
  canSendProbe: sendingProbe,
  sentEmail: false,
  note: domains.ok
    ? 'API klíč má plný přístup. E-mail se neodesílal.'
    : restricted || authLooksValid
      ? 'API klíč je platný pro odesílání. Pro FoodGo poptávky to stačí. E-mail se neodesílal.'
      : domains.status === 401 || domains.status === 403 || probe.status === 401 || probe.status === 403
        ? 'API klíč Resend odmítl (neplatný nebo zrušený).'
        : 'Resend odpověděl neočekávaně; e-mail se neodesílal.',
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
