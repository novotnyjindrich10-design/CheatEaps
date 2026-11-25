/**
 * Složí jeden SQL soubor pro prázdný projekt foodgo-preview (jnyxjyyvzxriuyvyiuxe).
 * Na produkční pcptzyfoojmnspumcmsi se nesmí spouštět.
 *
 *   node scripts/build-preview-bootstrap-sql.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(process.cwd())
const OUT = resolve(ROOT, 'supabase/preview-bootstrap-all.sql')
const PREVIEW_REF = 'jnyxjyyvzxriuyvyiuxe'
const PRODUCTION_REF = 'pcptzyfoojmnspumcmsi'

const parts = [
  'supabase/bootstrap-all.sql',
  'supabase/business-applications-form-v2.sql',
  'supabase/loyalty.sql',
  'supabase/promotion-apply-missing.sql',
  'supabase/place-reports.sql',
  'supabase/place-overrides.sql',
  'supabase/place-stats.sql',
  'supabase/preview-synthetic-seed.sql',
]

const header = `-- =============================================================================
-- FoodGo Preview bootstrap — JEDEN soubor pro prázdný projekt foodgo-preview
-- Cíl: ${PREVIEW_REF}  (https://${PREVIEW_REF}.supabase.co)
-- ZAKÁZÁNO: ${PRODUCTION_REF} (produkce)
--
-- Spuštění: Supabase Dashboard → projekt foodgo-preview → SQL Editor → Run
-- (celý soubor najednou). Idempotentní. Bez produkčních uživatelů a hesel.
-- Generováno: node scripts/build-preview-bootstrap-sql.mjs
-- Pořadí částí: ${parts.join(' → ')}
-- =============================================================================

do $$
begin
  -- SQL Editor nezná project ref; kontrola je organizační.
  -- Pokud jsi v produkčním projektu ${PRODUCTION_REF}, ZASTAV a spusť to jen na foodgo-preview.
  raise notice 'FoodGo preview bootstrap: ověř, že jsi v projektu ${PREVIEW_REF}, ne ${PRODUCTION_REF}';
end $$;

`

const body = parts.map((rel) => {
  const abs = resolve(ROOT, rel)
  const sql = readFileSync(abs, 'utf8')
  return `
-- #############################################################################
-- BEGIN ${rel}
-- #############################################################################

${sql.trim()}

-- #############################################################################
-- END ${rel}
-- #############################################################################
`
}).join('\n')

writeFileSync(OUT, `${header}${body}\n`, 'utf8')
console.log(JSON.stringify({
  ok: true,
  out: 'supabase/preview-bootstrap-all.sql',
  bytes: Buffer.byteLength(`${header}${body}\n`),
  parts,
  previewRef: PREVIEW_REF,
  productionRef: PRODUCTION_REF,
}, null, 2))
