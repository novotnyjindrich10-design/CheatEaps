/**
 * Bootstrap prázdné Preview databáze foodgo-preview (jnyxjyyvzxriuyvyiuxe).
 * Na produkční projekt pcptzyfoojmnspumcmsi nesáhne.
 *
 * Potřebuje connection string NEprodukčního Postgresu v PREVIEW_DATABASE_URL
 * a host musí obsahovat jnyxjyyvzxriuyvyiuxe.
 *
 *   PREVIEW_DATABASE_URL=postgresql://... node scripts/bootstrap-preview-database.mjs
 *
 * Bez psql: v SQL Editoru preview spusť supabase/preview-bootstrap-all.sql
 * (vygeneruj: node scripts/build-preview-bootstrap-sql.mjs).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { assertNotProductionTarget, isProductionSupabaseTarget } from './lib/production-target.mjs'

const PREVIEW_REF = 'jnyxjyyvzxriuyvyiuxe'
const url = String(process.env.PREVIEW_DATABASE_URL || '').trim()

if (!url) {
  console.log(JSON.stringify({
    ok: false,
    status: 'NOT_CONFIGURED',
    previewRef: PREVIEW_REF,
    note: 'Chybí PREVIEW_DATABASE_URL. Spusť supabase/preview-bootstrap-all.sql v SQL Editoru projektu foodgo-preview.',
  }, null, 2))
  process.exit(2)
}

try {
  assertNotProductionTarget(url, 'bootstrap-preview-database')
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

if (isProductionSupabaseTarget(url) || !url.toLowerCase().includes(PREVIEW_REF)) {
  console.error(JSON.stringify({
    ok: false,
    error: 'wrong-target',
    requiredRef: PREVIEW_REF,
    note: 'URI musí odkazovat výhradně na foodgo-preview (jnyxjyyvzxriuyvyiuxe).',
  }, null, 2))
  process.exit(1)
}

const combined = 'supabase/preview-bootstrap-all.sql'
const files = existsSync(combined)
  ? [combined]
  : [
      'supabase/bootstrap-all.sql',
      'supabase/business-applications-form-v2.sql',
      'supabase/loyalty.sql',
      'supabase/promotion-apply-missing.sql',
      'supabase/place-reports.sql',
      'supabase/place-overrides.sql',
      'supabase/place-stats.sql',
      'supabase/preview-synthetic-seed.sql',
    ]

for (const file of files) {
  const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', file], {
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) {
    console.error(JSON.stringify({
      ok: false,
      error: 'psql-missing',
      applied: [],
      fallback: 'Otevři https://supabase.com/dashboard/project/jnyxjyyvzxriuyvyiuxe/sql/new a spusť supabase/preview-bootstrap-all.sql',
    }, null, 2))
    process.exit(2)
  }
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log(JSON.stringify({
  ok: true,
  applied: files,
  previewRef: PREVIEW_REF,
  productionTouched: false,
}, null, 2))
