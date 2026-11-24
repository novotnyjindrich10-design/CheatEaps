/**
 * Bootstrap prázdné Preview databáze. Na produkční projekt pcptzyfoojmnspumcmsi nesáhne.
 *
 * Potřebuje connection string NEprodukčního Postgresu v PREVIEW_DATABASE_URL.
 * Supabase: Project Settings → Database → URI (jen foodgo-preview).
 *
 *   PREVIEW_DATABASE_URL=postgresql://... node scripts/bootstrap-preview-database.mjs
 */
import { spawnSync } from 'node:child_process'
import { assertNotProductionTarget } from './lib/production-target.mjs'

const url = String(process.env.PREVIEW_DATABASE_URL || '').trim()
if (!url) {
  console.log(JSON.stringify({
    ok: false,
    status: 'NOT_CONFIGURED',
    note: 'Chybí PREVIEW_DATABASE_URL. Produkční SUPABASE_URL se záměrně nepoužívá.',
  }, null, 2))
  process.exit(2)
}

try {
  assertNotProductionTarget(url, 'bootstrap-preview-database')
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

const files = [
  'supabase/bootstrap-all.sql',
  'supabase/promotion-apply-missing.sql',
  'supabase/place-reports.sql',
  'supabase/place-stats.sql',
  'supabase/preview-synthetic-seed.sql',
]

for (const file of files) {
  const result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-f', file], {
    stdio: 'inherit',
    shell: false,
  })
  if (result.error) {
    console.error('psql není v PATH. Soubory jsou připravené, spusť je v SQL editoru preview projektu v uvedeném pořadí.')
    process.exit(2)
  }
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log(JSON.stringify({ ok: true, applied: files, productionTouched: false }, null, 2))
