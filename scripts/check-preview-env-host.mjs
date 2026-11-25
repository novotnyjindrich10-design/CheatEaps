/**
 * Bezpečně vypíše jen hosty a tvary klíčů z .env.preview.check.
 * Nevypisuje tajné hodnoty.
 */
import { readFileSync, existsSync } from 'node:fs'
import { assertNotProductionTarget, isProductionSupabaseTarget } from './lib/production-target.mjs'

const PREVIEW_REF = 'jnyxjyyvzxriuyvyiuxe'
const path = process.argv[2] || '.env.preview.check'
if (!existsSync(path)) {
  console.log(JSON.stringify({ ok: false, error: 'missing-file', path }, null, 2))
  process.exit(2)
}

const text = readFileSync(path, 'utf8')
function get(key) {
  const match = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
  if (!match) return ''
  return match[1].trim().replace(/^["']|["']$/g, '')
}

const url = get('SUPABASE_URL')
const site = get('PUBLIC_SITE_URL')
const anon = get('SUPABASE_ANON_KEY')
const service = get('SUPABASE_SERVICE_ROLE_KEY')
const host = (url.match(/https?:\/\/([^.]+)/) || [])[1] || ''
const siteHost = (site.match(/https?:\/\/([^/]+)/) || [])[1] || ''

function keyKind(value, publishablePrefix, secretPrefix) {
  if (!value) return 'missing'
  if (value.startsWith(publishablePrefix)) return 'publishable'
  if (value.startsWith(secretPrefix)) return 'secret'
  if (value.startsWith('eyJ')) return 'jwt'
  return 'other'
}

const report = {
  ok: true,
  supabaseHost: host,
  isPreviewTarget: host === PREVIEW_REF,
  isProduction: isProductionSupabaseTarget(url),
  hasAnon: Boolean(anon),
  anonKind: keyKind(anon, 'sb_publishable_', 'sb_secret_'),
  hasService: Boolean(service),
  serviceKind: keyKind(service, 'sb_publishable_', 'sb_secret_'),
  publicSiteUrlHost: siteHost,
  publicSiteUrlSet: Boolean(site),
}

try {
  assertNotProductionTarget(url, 'preview-env-check')
} catch (error) {
  report.productionGuard = error.message
}

console.log(JSON.stringify(report, null, 2))
if (!report.isPreviewTarget || report.isProduction) process.exit(1)
