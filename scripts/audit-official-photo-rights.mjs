/**
 * Evidence oficiálních fotek: dostupnost na webu podniku není licence.
 * Nic nenahrává a produkční data nemění. Zapíše reports/official-photo-rights.md.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { placePhotos } from '../src/data/placePhotos.js'
import { placePixabayPhotoId, pixabayPhotosById } from '../src/data/pixabayLibrary.data.js'

const rows = Object.entries(placePhotos).map(([id, photo]) => {
  const pixabayId = placePixabayPhotoId[id]
  const pixabay = Number.isInteger(pixabayId) ? pixabayPhotosById[pixabayId] : null
  const rights = photo.heroImageRights === 'documented' ? 'documented' : 'undocumented'
  return {
    id,
    url: photo.heroImageUrl || '',
    source: photo.heroImageSource || '',
    rights,
    pixabayId: pixabay ? pixabayId : null,
    pixabayLicense: pixabay ? 'Pixabay Content License' : '',
    shown: rights === 'documented' ? 'official' : pixabay ? 'licensed-illustration' : 'cuisine-fallback',
  }
})

const documented = rows.filter((row) => row.rights === 'documented')
const replaced = rows.filter((row) => row.shown === 'licensed-illustration')
const fallback = rows.filter((row) => row.shown === 'cuisine-fallback')
const uniquePixabay = new Set(replaced.map((row) => row.pixabayId))

const lines = [
  '# Evidence licencí oficiálních fotografií',
  '',
  `Datum: 2026-11-28`,
  `Kontrolováno záznamů: ${rows.length}`,
  '',
  '## Pravidlo',
  '',
  'Samotná fotografie na webu restaurace, Instagramu nebo Google Maps není oprávnění ke komerčnímu použití.',
  'V datech není u žádného záznamu doložená licence ani souhlas držitele práv (`heroImageRights` není `documented`).',
  'Ověření práv se nepředstírá. Hotlink se ve veřejném UI nezobrazuje.',
  '',
  '## Výsledek',
  '',
  `| Stav | Počet |`,
  `| --- | ---: |`,
  `| Doložená licence, fotka zůstává | ${documented.length} |`,
  `| Nahrazeno existující licencovanou ilustrací (Pixabay / Pexels / Unsplash) | ${replaced.length} |`,
  `| Bez ilustrace, spadne na typ kuchyně | ${fallback.length} |`,
  `| Unikátní ilustrace u nahrazených podniků | ${uniquePixabay.size} |`,
  '',
  'Rozmanitost předchozího auditu se nemění: přiřazení ilustrací se nepřepisovalo.',
  '',
  '## Záznamy',
  '',
  '| Podnik | Zobrazeno | Důvod | Zdroj hotlinku | Licence náhrady |',
  '| --- | --- | --- | --- | --- |',
]

for (const row of rows) {
  const reason =
    row.shown === 'official'
      ? 'doložená práva'
      : 'web podniku nedokládá komerční licenci'
  const replacement = row.pixabayId ? `Pixabay ${row.pixabayId}` : '—'
  lines.push(
    `| ${row.id} | ${row.shown} | ${reason} | ${row.source || '—'} | ${replacement} |`,
  )
}

if (fallback.length) {
  lines.push('', '## Bez licencované ilustrace', '')
  for (const row of fallback) lines.push(`- ${row.id}`)
}

const out = resolve('reports/official-photo-rights.md')
writeFileSync(out, `${lines.join('\n')}\n`)
console.log(
  JSON.stringify(
    {
      checked: rows.length,
      documented: documented.length,
      replaced: replaced.length,
      fallback: fallback.length,
      uniquePixabay: uniquePixabay.size,
      out,
    },
    null,
    2,
  ),
)
