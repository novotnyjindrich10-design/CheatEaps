import { readFileSync } from 'fs'

const rows = JSON.parse(readFileSync(new URL('../reports/menu-scan.json', import.meta.url), 'utf8'))
const BAD =
  /cookie|gdpr|copyright|all right|objednávk|objednavk|rezervac|otevírac|otevirac|telefon|instagram|facebook|i[cč]o|stránk|strank/i

const keep = rows.filter((r) => {
  if (!r.choice || r.already) return false
  if (BAD.test(r.choice.item)) return false
  if (r.choice.kind === 'menu' && r.choice.sample < 2) return false
  if (r.choice.kind === 'range' && r.choice.sample < 4) return false
  return true
})

for (const r of keep.sort((a, b) => a.name.localeCompare(b.name, 'cs'))) {
  const c = r.choice
  const line =
    c.kind === 'range'
      ? `${c.min}-${c.max} ${c.item}`
      : `${c.price} ${c.item}`
  console.log(
    `${r.id}\t${r.name}\t${c.kind}\t${line}\tn=${c.sample}\t${r.usedUrl}\t${r.sample.map((s) => s.price).join(',')}`,
  )
}
console.error('keep', keep.length)
