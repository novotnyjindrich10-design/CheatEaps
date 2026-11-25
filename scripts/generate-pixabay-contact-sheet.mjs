/**
 * Kontaktní list aktuálně zobrazených Pixabay/Pexels ilustrací (priorita před Openverse).
 *   node scripts/generate-pixabay-contact-sheet.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { isCatalogExcluded } from '../src/data/catalogExclusions.js'
import { getCategoryOverride } from '../src/data/categoryOverrides.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { placePixabayPhotoId, pixabayPhotosById } from '../src/data/pixabayLibrary.data.js'
import { dishSpecForPlace } from './lib/openverseFoodShared.mjs'

const byPhoto = new Map()
const byId = new Map()
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (!entry?.id || isCatalogExcluded(entry.id)) continue
  if (!byId.has(entry.id)) byId.set(entry.id, entry)
}

for (const entry of byId.values()) {
  const override = getCategoryOverride(entry.id)
  const place = {
    ...entry,
    category: override?.category || entry.category || 'neuvedeno',
    type: override?.type || entry.type,
    description: override?.description || entry.description,
  }
  const official = placePhotos[entry.id]
  if (official?.heroImageKind === 'official' && official?.heroImageUrl) continue
  const photoId = placePixabayPhotoId[entry.id]
  const photo = pixabayPhotosById[photoId]
  if (!photo) continue
  const expected = dishSpecForPlace(place)
  if (!byPhoto.has(photoId)) {
    byPhoto.set(photoId, { photo, places: [], expectedThemes: new Set() })
  }
  const bucket = byPhoto.get(photoId)
  bucket.places.push({ id: entry.id, name: entry.name, category: place.category })
  bucket.expectedThemes.add(expected.key)
}

const cards = [...byPhoto.entries()]
  .sort((a, b) => b[1].places.length - a[1].places.length || a[0] - b[0])
  .map(([id, row]) => {
    const mismatch = [...row.expectedThemes].some((theme) => theme !== row.photo.theme)
    return `<article class="card${mismatch ? ' mismatch' : ''}">
  <img src="..${row.photo.cardUrl}" alt="" loading="lazy" width="320" height="200" />
  <div class="meta">
    <strong>#${id}</strong> · ${row.photo.theme} · ${row.photo.dish || ''}
    <div>${row.places.length}× · ${row.photo.user || ''}</div>
    <div class="places">${row.places
      .slice(0, 6)
      .map((place) => place.name)
      .join(' · ')}${row.places.length > 6 ? '…' : ''}</div>
    <a href="${row.photo.pageUrl}" target="_blank" rel="noreferrer">zdroj</a>
  </div>
</article>`
  })

mkdirSync(new URL('../reports/', import.meta.url), { recursive: true })
const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<title>FOODGO – Pixabay contact sheet</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#f6f4ef;color:#121212}
h1{font-size:1.4rem} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.card{background:#fff;border:1px solid #e7e0d6;border-radius:12px;overflow:hidden}
.card.mismatch{outline:2px solid #c44}
img{display:block;width:100%;height:160px;object-fit:cover}
.meta{padding:10px 12px;font-size:12px;line-height:1.4}
.places{opacity:.75;margin:4px 0}
</style>
</head>
<body>
<h1>Pixabay / Pexels ilustrace v živém katalogu</h1>
<p>${byPhoto.size} unikátních fotek · ${[...byPhoto.values()].reduce((n, row) => n + row.places.length, 0)} podniků s ilustrací · max ${Math.max(0, ...[...byPhoto.values()].map((row) => row.places.length))}×</p>
<div class="grid">${cards.join('\n')}</div>
</body></html>`

writeFileSync(new URL('../reports/pixabay-contact-sheet.html', import.meta.url), html)
console.log(`reports/pixabay-contact-sheet.html (${byPhoto.size} assets)`)
