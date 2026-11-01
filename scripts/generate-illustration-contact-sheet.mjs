/**
 * Lokální kontaktní list unikátních ilustrací CheapEats Brno.
 *
 * Spuštění z kořene projektu:
 *   node scripts/generate-illustration-contact-sheet.mjs
 *
 * Otevření:
 *   reports/illustration-contact-sheet.html
 *   Dvojklik v prohlížeči. Vývojový server ani instalace nejsou potřeba.
 *   Náhledy ilustrací se berou ze složky public/food-illustrations.
 *
 * Skript jen čte existující data a zapíše tento jeden report.
 * Přiřazení fotek, veřejný web ani jiné soubory nemění.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FOOD_CATEGORIES } from '../src/constants/filters.js'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placePhotos } from '../src/data/placePhotos.js'
import {
  getPlaceFoodIllustration,
  placeFoodIllustrationDishKey,
  placeFoodIllustrationShared,
  placeFoodIllustrationsPlaceSpecific,
} from '../src/data/placeFoodIllustrations.js'
import { DISH_SPECS } from './lib/openverseFoodShared.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(root, 'reports', 'illustration-contact-sheet.html')
const MARKER = 'illustration-contact-sheet-marker'
const PUBLIC_DIR = path.join(root, 'public')
const ILLUSTRATION_DIR = path.join(PUBLIC_DIR, 'food-illustrations')

const CATEGORY_LABELS = {
  ...Object.fromEntries(FOOD_CATEGORIES.map((item) => [item.value, item.label])),
  neuvedeno: 'Neuvedeno',
}

function categoryLabel(value) {
  if (!value) return 'Neuvedeno'
  return CATEGORY_LABELS[value] || value
}

function licenseLabel(license) {
  const key = String(license || '').toLowerCase()
  if (key === 'cc0') return 'CC0'
  if (key === 'pdm') return 'Public Domain'
  if (key === 'by') return 'CC BY'
  if (key === 'by-sa') return 'CC BY-SA'
  return license || ''
}

function placesWord(count) {
  if (count === 1) return '1 podnik'
  if (count >= 2 && count <= 4) return `${count} podniky`
  return `${count} podniků`
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function norm(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeHttpUrl(value) {
  const url = String(value || '').trim()
  if (/^https?:\/\//i.test(url)) return url
  return ''
}

function localSrc(publicUrl) {
  return `../public${publicUrl}`
}

function filenameOf(publicUrl) {
  const clean = String(publicUrl || '').split('?')[0].split('#')[0]
  const parts = clean.split('/')
  return parts[parts.length - 1] || publicUrl || 'bez-nazvu'
}

function dishKeyFromFilename(name) {
  const match = String(name || '').match(/^(.*)-[a-f0-9]{8}\.[a-z0-9]+$/i)
  return match?.[1] || ''
}

function sha256(absPath) {
  return createHash('sha256').update(readFileSync(absPath)).digest('hex')
}

function walkImages(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name)
    const info = statSync(abs)
    if (info.isDirectory()) {
      walkImages(abs, acc)
      continue
    }
    if (!/\.(jpe?g|png|webp|gif)$/i.test(name)) continue
    const rel = `/${path.relative(PUBLIC_DIR, abs).split(path.sep).join('/')}`
    acc.push({ abs, rel, name, size: info.size })
  }
  return acc
}

function linkHtml(url, text) {
  const href = safeHttpUrl(url)
  if (!href) return esc(text || 'chybí')
  return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(text || href)}</a>`
}

function buildPlaces() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  }
  return byId
}

function buildModel() {
  const places = buildPlaces()
  const files = walkImages(ILLUSTRATION_DIR)
  for (const file of files) file.sha = sha256(file.abs)
  const fileByRel = new Map(files.map((file) => [file.rel, file]))

  const byUrl = new Map()
  function bucket(publicUrl) {
    if (!byUrl.has(publicUrl)) {
      byUrl.set(publicUrl, { publicUrl, records: [], places: [], orphan: false })
    }
    return byUrl.get(publicUrl)
  }

  for (const [sharedKey, rec] of Object.entries(placeFoodIllustrationShared)) {
    bucket(rec.foodIllustrationUrl).records.push({ sharedKey, rec })
  }
  for (const [placeId, rec] of Object.entries(placeFoodIllustrationsPlaceSpecific)) {
    if (!rec?.foodIllustrationUrl) continue
    bucket(rec.foodIllustrationUrl).records.push({
      sharedKey: rec.foodIllustrationSharedKey || placeId,
      rec,
      placeSpecific: true,
    })
  }

  const assignedIds = new Set([
    ...Object.keys(placeFoodIllustrationDishKey),
    ...Object.keys(placeFoodIllustrationsPlaceSpecific),
  ])
  const unresolvedPlaces = []
  for (const placeId of assignedIds) {
    const rec = getPlaceFoodIllustration(placeId)
    if (!rec?.foodIllustrationUrl) {
      unresolvedPlaces.push(placeId)
      continue
    }
    const place = places.get(placeId)
    const category = place?.category || ''
    bucket(rec.foodIllustrationUrl).places.push({
      id: placeId,
      name: place?.name || placeId,
      category,
      categoryLabel: categoryLabel(category),
      official: placePhotos[placeId]?.heroImageKind === 'official',
    })
  }

  const catalogHashes = new Set()
  for (const row of byUrl.values()) {
    const file = fileByRel.get(row.publicUrl)
    if (file) catalogHashes.add(file.sha)
  }

  const leftovers = []
  for (const file of files) {
    if (byUrl.has(file.rel)) continue
    if (!catalogHashes.has(file.sha)) {
      const row = bucket(file.rel)
      row.orphan = true
      continue
    }
    const original = files.find((candidate) => byUrl.has(candidate.rel) && candidate.sha === file.sha)
    leftovers.push({
      rel: file.rel,
      sameAs: original?.rel || '',
      size: file.size,
    })
  }

  const illustrations = [...byUrl.values()].map((row) => toIllustration(row, fileByRel))
  illustrations.sort(compareIllustrations)

  const official = buildOfficial(places)
  const illustrationUrls = new Set(illustrations.map((item) => item.publicUrl))
  const collisions = official.filter((item) => illustrationUrls.has(item.url))
  const usageValues = illustrations.map((item) => item.usage)
  const categoryConflicts = illustrations.reduce(
    (sum, item) => sum + item.places.filter((place) => place.categoryConflict).length,
    0,
  )

  return {
    generatedAt: new Date().toISOString(),
    placeCount: places.size,
    assignedPlaceCount: illustrations.reduce((sum, item) => sum + item.usage, 0),
    officialPlaceCount: Object.values(placePhotos).filter((photo) => photo.heroImageKind === 'official').length,
    bothCount: illustrations.reduce(
      (sum, item) => sum + item.places.filter((place) => place.official).length,
      0,
    ),
    illustrationCount: illustrations.length,
    assignedIllustrationCount: illustrations.filter((item) => item.usage > 0).length,
    unassignedIllustrationCount: illustrations.filter((item) => item.usage === 0 && !item.orphan).length,
    orphanCount: illustrations.filter((item) => item.orphan).length,
    missingFileCount: illustrations.filter((item) => !item.fileExists).length,
    maxUsage: usageValues.length ? Math.max(...usageValues) : 0,
    categoryConflicts,
    unresolvedPlaces,
    collisions,
    leftovers: leftovers.sort((a, b) => a.rel.localeCompare(b.rel, 'cs')),
    diskFileCount: files.length,
    illustrations,
    official,
    dishOptions: dishOptions(illustrations),
  }
}

function toIllustration(row, fileByRel) {
  const file = fileByRel.get(row.publicUrl)
  const primary = row.records[0]?.rec || {}
  const filename = file?.name || filenameOf(row.publicUrl)
  const dishKey = primary.foodIllustrationDishKey || dishKeyFromFilename(filename) || 'nezarazeno'
  const specDish = DISH_SPECS[dishKey]?.dish || ''
  const photoDish = primary.foodIllustrationDish || ''
  const sharedKeys = [...new Set(row.records.map((record) => record.sharedKey).filter(Boolean))]
  const openverseIds = [...new Set(row.records.map((record) => record.rec?.foodIllustrationOpenverseId).filter(Boolean))]
  const dishKeys = [...new Set(row.records.map((record) => record.rec?.foodIllustrationDishKey).filter(Boolean))]
  const places = [...row.places].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
  for (const place of places) {
    place.categoryConflict = Boolean(place.category) && place.category !== 'neuvedeno' && place.category !== dishKey
  }
  const categoryCounts = new Map()
  for (const place of places) {
    const label = place.categoryLabel
    categoryCounts.set(label, (categoryCounts.get(label) || 0) + 1)
  }
  const id = sharedKeys.join(', ') || filename
  return {
    id,
    sharedKeys,
    filename,
    publicUrl: row.publicUrl,
    src: localSrc(row.publicUrl),
    fileExists: Boolean(file && file.size > 0),
    fileBytes: file?.size || 0,
    orphan: row.orphan,
    dishKey,
    dishKeys,
    specDish,
    photoDish,
    openverseIds,
    metaConflict: openverseIds.length > 1 || dishKeys.length > 1,
    usage: places.length,
    categorySummary: [...categoryCounts.entries()].map(([label, count]) => `${label} (${count})`).join(', '),
    license: primary.foodIllustrationLicense || '',
    licenseText: licenseLabel(primary.foodIllustrationLicense),
    licenseUrl: primary.foodIllustrationLicenseUrl || '',
    creator: primary.foodIllustrationCreator || '',
    creatorUrl: primary.foodIllustrationCreatorUrl || '',
    sourceUrl: primary.foodIllustrationSourceUrl || '',
    originalUrl: primary.foodIllustrationOriginalUrl || '',
    attribution: primary.foodIllustrationAttribution || '',
    kind: primary.foodIllustrationKind || (row.orphan ? 'soubor-na-disku' : ''),
    places,
  }
}

function compareIllustrations(a, b) {
  const dish = a.dishKey.localeCompare(b.dishKey, 'cs')
  if (dish) return dish
  if (b.usage !== a.usage) return b.usage - a.usage
  return a.filename.localeCompare(b.filename, 'cs')
}

function dishOptions(illustrations) {
  const groups = new Map()
  for (const item of illustrations) {
    if (!groups.has(item.dishKey)) {
      groups.set(item.dishKey, { key: item.dishKey, label: item.specDish || item.photoDish || item.dishKey, count: 0 })
    }
    groups.get(item.dishKey).count += 1
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key, 'cs'))
}

function buildOfficial(places) {
  const grouped = new Map()
  for (const [placeId, photo] of Object.entries(placePhotos)) {
    if (photo?.heroImageKind !== 'official') continue
    const url = photo.heroImageUrl || ''
    const key = url || `missing:${placeId}`
    if (!grouped.has(key)) grouped.set(key, { url, places: [] })
    const place = places.get(placeId)
    const category = place?.category || ''
    grouped.get(key).places.push({
      id: placeId,
      name: place?.name || placeId,
      category,
      categoryLabel: categoryLabel(category),
      source: photo.heroImageSource || '',
      alt: photo.heroImageAlt || '',
    })
  }
  return [...grouped.values()]
    .map((row) => {
      const list = [...row.places].sort((a, b) => a.name.localeCompare(b.name, 'cs'))
      const sources = [...new Set(list.map((place) => place.source).filter(Boolean))]
      return {
        url: row.url,
        id: row.url || list[0]?.id || 'chybi-url',
        filename: row.url ? filenameOf(row.url) : 'chybi-url',
        src: safeHttpUrl(row.url),
        usage: list.length,
        places: list,
        sources,
        categorySummary: summarizeCategories(list),
      }
    })
    .sort((a, b) => (a.places[0]?.name || a.id).localeCompare(b.places[0]?.name || b.id, 'cs'))
}

function summarizeCategories(list) {
  const counts = new Map()
  for (const place of list) counts.set(place.categoryLabel, (counts.get(place.categoryLabel) || 0) + 1)
  return [...counts.entries()].map(([label, count]) => `${label} (${count})`).join(', ')
}

function searchBlob(parts) {
  return norm(parts.filter(Boolean).join(' '))
}

function illustrationCard(item) {
  const search = searchBlob([
    item.filename,
    item.publicUrl,
    item.id,
    item.dishKey,
    item.specDish,
    item.photoDish,
    item.creator,
    item.licenseText,
    item.attribution,
    item.openverseIds.join(' '),
    ...item.places.flatMap((place) => [place.name, place.id, place.categoryLabel]),
  ])
  const usageClass = item.usage > 3 ? 'badge warn' : item.usage === 0 ? 'badge idle' : 'badge usage'
  const broken = item.fileExists ? '0' : '1'
  const preview = item.fileExists
    ? `<a class="frame-link" href="${esc(item.src)}"><img class="photo" src="${esc(item.src)}" alt="${esc(`Ilustrace: ${item.specDish || item.photoDish || item.dishKey}. Soubor ${item.filename}`)}" loading="lazy" decoding="async"></a>`
    : `<div class="img-error"><p>Nelze načíst obrázek. Soubor v projektu chybí.</p><p>${esc(item.src)}</p><p>ID: ${esc(item.id)}</p></div>`
  const dishExtra = item.photoDish && norm(item.photoDish) !== norm(item.specDish)
    ? `<dt>Popis v datech</dt><dd>${esc(item.photoDish)}</dd>`
    : ''
  const conflictNote = item.metaConflict
    ? '<p class="warn-text">Stejný soubor má v datech víc dish keys nebo Openverse ID.</p>'
    : ''
  const orphanNote = item.orphan
    ? '<p class="warn-text">Soubor leží ve složce food-illustrations, ale není v katalogu přiřazení. Obsah se neshoduje s žádnou katalogovou ilustrací.</p>'
    : ''
  const placeItems = item.places.length
    ? item.places.map((place) => {
      const conflict = place.categoryConflict ? '<span class="pill warn">kategorie podniku se liší od dish key</span>' : ''
      const official = place.official ? '<span class="pill official">má i oficiální fotku</span>' : ''
      return `<li><strong>${esc(place.name)}</strong> <span class="muted">${esc(place.id)}</span> <span class="pill">${esc(place.categoryLabel)}</span> ${conflict} ${official}</li>`
    }).join('')
    : '<li>Žádný podnik. Ilustrace je v katalogu a není přiřazená.</li>'
  const openverse = item.openverseIds.length ? item.openverseIds.join(', ') : 'chybí'
  return `<article class="card${item.orphan ? ' is-orphan' : ''}" data-kind="illustration" data-public="${esc(item.publicUrl)}" data-id="${esc(item.id)}" data-dish="${esc(item.dishKey)}" data-usage="${item.usage}" data-file="${esc(item.filename)}" data-search="${esc(search)}" data-broken="${broken}">
    <div class="frame">${preview}</div>
    <div class="body">
      <p class="badges"><span class="badge ill">Ilustrace</span><span class="${usageClass}">${esc(placesWord(item.usage))}</span></p>
      <h3>${esc(item.filename)}</h3>
      ${orphanNote}
      ${conflictNote}
      <dl>
        <dt>ID</dt><dd>${esc(item.id)}</dd>
        <dt>Openverse ID</dt><dd>${esc(openverse)}</dd>
        <dt>Dish key</dt><dd><code>${esc(item.dishKey)}</code></dd>
        <dt>Kategorie jídla</dt><dd>${esc(item.specDish || item.photoDish || 'chybí')}</dd>
        ${dishExtra}
        <dt>Kategorie podniků</dt><dd>${esc(item.categorySummary || 'žádný podnik')}</dd>
        <dt>Licence</dt><dd>${item.licenseText ? linkHtml(item.licenseUrl, item.licenseText) : 'chybí'}</dd>
        <dt>Autor</dt><dd>${item.creator ? linkHtml(item.creatorUrl, item.creator) : 'chybí'}</dd>
        <dt>Zdroj</dt><dd>${item.kind === 'openverse' ? 'Openverse' : esc(item.kind || 'chybí')}${item.sourceUrl ? ` · ${linkHtml(item.sourceUrl, 'stránka zdroje')}` : ''}</dd>
        <dt>Původní soubor</dt><dd>${item.originalUrl ? linkHtml(item.originalUrl, 'otevřít původní URL') : 'chybí'}</dd>
      </dl>
      <p class="label">Podniky</p>
      <ul>${placeItems}</ul>
      ${item.attribution ? `<details><summary>Celá atribuce</summary><p>${esc(item.attribution)}</p></details>` : ''}
    </div>
  </article>`
}

function officialCard(item) {
  const search = searchBlob([
    item.filename,
    item.url,
    item.id,
    item.categorySummary,
    ...item.sources,
    ...item.places.flatMap((place) => [place.name, place.id, place.categoryLabel, place.source]),
  ])
  const preview = item.src
    ? `<a class="frame-link" href="${esc(item.src)}"><img class="photo" src="${esc(item.src)}" alt="${esc(item.places[0]?.alt || `Oficiální fotografie podniku ${item.places[0]?.name || ''}`)}" loading="lazy" decoding="async"></a>`
    : `<div class="img-error"><p>Nelze načíst obrázek. U oficiální fotky chybí URL.</p><p>ID: ${esc(item.id)}</p></div>`
  const placeItems = item.places.map((place) => (
    `<li><strong>${esc(place.name)}</strong> <span class="muted">${esc(place.id)}</span> <span class="pill">${esc(place.categoryLabel)}</span>${place.source ? `<div class="source-line">Zdroj: ${linkHtml(place.source, place.source)}</div>` : '<div class="source-line">Zdroj: chybí</div>'}</li>`
  )).join('')
  return `<article class="card is-official" data-kind="official" data-public="${esc(item.url)}" data-id="${esc(item.id)}" data-dish="" data-usage="${item.usage}" data-file="${esc(item.filename)}" data-search="${esc(search)}" data-broken="${item.src ? '0' : '1'}">
    <div class="frame">${preview}</div>
    <div class="body">
      <p class="badges"><span class="badge official">Oficiální fotografie podniku</span><span class="badge usage">${esc(placesWord(item.usage))}</span></p>
      <h3>${esc(item.filename)}</h3>
      <dl>
        <dt>URL</dt><dd>${item.src ? linkHtml(item.src, item.url) : 'chybí'}</dd>
        <dt>Kategorie podniků</dt><dd>${esc(item.categorySummary || 'chybí')}</dd>
        <dt>Původ</dt><dd>Oficiální web podniku. Tahle fotka patří ke konkrétnímu podniku.</dd>
      </dl>
      <p class="label">Podniky</p>
      <ul>${placeItems}</ul>
    </div>
  </article>`
}

function leftoverRows(items) {
  if (!items.length) return '<p>Na disku nejsou další kopie ilustrací mimo katalog.</p>'
  const rows = items.map((item) => (
    `<tr><td><code>${esc(item.rel)}</code></td><td><code>${esc(item.sameAs)}</code></td><td>${item.size.toLocaleString('cs-CZ')} B</td></tr>`
  )).join('')
  return `<table><thead><tr><th>Kopie na disku</th><th>Stejný obsah jako</th><th>Velikost</th></tr></thead><tbody>${rows}</tbody></table>`
}

function render(model) {
  const dishOptionsHtml = [
    `<option value="">Všechny dish keys (${model.illustrationCount})</option>`,
    ...model.dishOptions.map((option) => (
      `<option value="${esc(option.key)}">${esc(option.key)} — ${esc(option.label)} (${option.count})</option>`
    )),
  ].join('')
  const unresolved = model.unresolvedPlaces.length
    ? `<p class="warn-text">Přiřazení bez fotky: ${esc(model.unresolvedPlaces.join(', '))}</p>`
    : ''
  const collisions = model.collisions.length
    ? `<p class="warn-text">Stejná URL je v ilustracích i v oficiálních fotkách: ${esc(model.collisions.map((item) => item.url).join(', '))}</p>`
    : ''
  return `<!DOCTYPE html>
<!-- ${MARKER} -->
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="illustration-count" content="${model.illustrationCount}">
  <title>Kontaktní list ilustrací (${model.illustrationCount}) — CheapEats Brno</title>
  <style>
    :root { color-scheme: light; --ink: #1f1a17; --muted: #5e564f; --line: #e4dcd2; --paper: #f6f3ee; --card: #fff; --ill: #1f6b4a; --official: #8a4b08; --warn: #8d1d1d; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 15px/1.45 "Segoe UI", system-ui, sans-serif; color: var(--ink); background: var(--paper); }
    main { width: min(1280px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 64px; }
    h1 { font-size: 1.8rem; line-height: 1.2; margin: 0 0 8px; }
    h2 { font-size: 1.25rem; margin: 28px 0 12px; }
    h3 { font-size: 1rem; margin: 0 0 8px; word-break: break-all; }
    p { margin: 0 0 10px; }
    code { font-family: Consolas, ui-monospace, monospace; font-size: 0.92em; }
    a { color: #0f5c8c; }
    .howto, .stats, .note { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
    .howto ol { margin: 8px 0 0; padding-left: 1.2rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 16px; }
    .stat strong { display: block; font-size: 1.4rem; }
    .stat span { color: var(--muted); }
    .toolbar { position: sticky; top: 0; z-index: 3; display: flex; flex-wrap: wrap; gap: 10px; align-items: end; padding: 12px 0; background: color-mix(in srgb, var(--paper) 92%, transparent); backdrop-filter: blur(8px); }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; color: var(--muted); }
    input, select, button { font: inherit; color: var(--ink); }
    input, select { border: 1px solid var(--line); background: var(--card); border-radius: 10px; padding: 8px 10px; min-width: 0; }
    #search { width: min(320px, 100%); }
    .check { flex-direction: row; align-items: center; gap: 8px; padding-bottom: 8px; }
    .tabs { display: flex; gap: 8px; }
    .tabs button, button { border: 1px solid var(--line); background: var(--card); border-radius: 999px; padding: 8px 12px; cursor: pointer; }
    .tabs button.is-active { background: var(--ink); color: white; border-color: var(--ink); }
    #visible-count { padding-bottom: 8px; color: var(--ink); font-weight: 650; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
    .card.is-official { border-color: #efd3a8; }
    .card.is-orphan { border-color: #e7b4b4; }
    .frame { background: #ece7df; min-height: 220px; }
    .frame-link { display: block; }
    .photo { width: 100%; height: 240px; object-fit: contain; background: #ece7df; display: block; }
    .body { padding: 12px 14px 16px; }
    .badges, .label { display: flex; flex-wrap: wrap; gap: 6px; }
    .badge, .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 8px; font-size: 0.78rem; }
    .badge.ill { background: #e5f6ee; color: var(--ill); }
    .badge.official, .pill.official { background: #fff1dc; color: var(--official); }
    .badge.usage { background: #eeeae4; }
    .badge.idle { background: #eeeae4; color: var(--muted); }
    .badge.warn, .pill.warn, .warn-text { color: var(--warn); }
    .badge.warn, .pill.warn { background: #fde8e8; }
    .warn-text { font-weight: 650; }
    .pill { background: #f3efe9; }
    dl { display: grid; grid-template-columns: 9.2rem 1fr; gap: 4px 8px; margin: 0 0 10px; }
    dt { color: var(--muted); }
    dd { margin: 0; word-break: break-word; }
    ul { margin: 6px 0 0; padding-left: 1.1rem; }
    li { margin: 0 0 6px; }
    .muted, .source-line { color: var(--muted); font-size: 0.86rem; }
    .img-error { min-height: 220px; margin: 0; padding: 16px; background: #fde8e8; color: var(--warn); border: 2px solid #b91c1c; font-weight: 700; word-break: break-all; }
    .img-error p { margin: 0 0 8px; }
    details { margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    th, td { text-align: left; vertical-align: top; border-top: 1px solid var(--line); padding: 8px 6px; word-break: break-all; }
    .empty { font-weight: 650; }
    body.js .panel:not(.is-active) { display: none; }
    @media (max-width: 640px) {
      main { width: min(100% - 20px, 1280px); }
      dl { grid-template-columns: 1fr; }
      .photo { height: 220px; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Kontaktní list ilustrací</h1>
    <p>CheapEats Brno. Všechny unikátní ilustrace z aktuálního katalogu, každá jednou. Oficiální fotografie konkrétních podniků jsou ve vlastní sekci.</p>
    <section class="howto">
      <h2>Jak přehled otevřít</h2>
      <ol>
        <li>V kořeni projektu spusťte <code>node scripts/generate-illustration-contact-sheet.mjs</code>. Příkaz znovu sestaví tento soubor z aktuálních dat.</li>
        <li>Otevřete <code>reports/illustration-contact-sheet.html</code> dvojklikem v prohlížeči. Server ani další instalace nejsou potřeba.</li>
        <li>Náhledy ilustrací se načítají ze složky <code>public/food-illustrations</code>. Oficiální fotografie se načítají z URL uložených u podniků.</li>
      </ol>
      <p>Generátor jen čte existující přiřazení a zapíše tento report. Veřejný web ani přiřazení fotek nemění.</p>
    </section>
    <section class="stats" aria-label="Souhrn">
      <div class="stat"><strong>${model.illustrationCount}</strong><span>unikátních ilustrací v přehledu</span></div>
      <div class="stat"><strong>${model.assignedIllustrationCount}</strong><span>přiřazených alespoň jednomu podniku</span></div>
      <div class="stat"><strong>${model.unassignedIllustrationCount}</strong><span>v katalogu bez podniku</span></div>
      <div class="stat"><strong>${model.assignedPlaceCount}</strong><span>podniků s ilustrací z ${model.placeCount}</span></div>
      <div class="stat"><strong>${model.official.length}</strong><span>unikátních oficiálních fotek (${model.officialPlaceCount} podniků)</span></div>
      <div class="stat"><strong>${model.maxUsage}</strong><span>nejvyšší počet použití jedné ilustrace</span></div>
      <div class="stat"><strong>${model.missingFileCount}</strong><span>ilustrací bez souboru na disku</span></div>
      <div class="stat"><strong>${model.categoryConflicts}</strong><span>podniků, jejichž kategorie se liší od dish key</span></div>
    </section>
    ${unresolved}
    ${collisions}
    <p class="note">Vygenerováno ${esc(model.generatedAt)}. Katalogové ilustrace: ${model.illustrationCount - model.orphanCount}. Soubory na disku s jiným obsahem, než má katalog: ${model.orphanCount}. Stejné kopie mimo katalog, které se v mřížce neopakují: ${model.leftovers.length} z ${model.diskFileCount} souborů ve složce food-illustrations. Podniků s ilustrací i oficiální fotkou: ${model.bothCount}.</p>
    <div class="toolbar">
      <div class="tabs" role="tablist">
        <button type="button" data-tab="illustrations" aria-selected="true">Ilustrace</button>
        <button type="button" data-tab="official" aria-selected="false">Oficiální fotografie</button>
      </div>
      <label>Hledat podnik nebo soubor<input id="search" type="search" placeholder="název podniku, soubor, ID"></label>
      <label>Dish key<select id="dish-key">${dishOptionsHtml}</select></label>
      <label>Řazení<select id="sort">
        <option value="dish">Podle dish key</option>
        <option value="usage-desc">Podle počtu použití, nejvíc první</option>
        <option value="usage-asc">Podle počtu použití, nejmíň první</option>
        <option value="file">Podle názvu souboru</option>
      </select></label>
      <label class="check"><input id="errors-only" type="checkbox">Jen nenačtené</label>
      <p id="visible-count">Zobrazeno ${model.illustrationCount} z ${model.illustrationCount} ilustrací</p>
      <p id="empty-state" class="empty" hidden>Filtr nic nenašel.</p>
    </div>
    <section class="panel is-active" id="illustrations">
      <h2>Ilustrace (${model.illustrationCount})</h2>
      <p>Každá karta je jedna unikátní ilustrace. Není to fotografie konkrétního podniku. Odkaz na náhledu otevře soubor z <code>public/food-illustrations</code>.</p>
      <div class="grid" id="illustration-grid">
        ${model.illustrations.map(illustrationCard).join('\n')}
      </div>
    </section>
    <section class="panel" id="official">
      <h2>Oficiální fotografie podniků (${model.official.length})</h2>
      <p>Tahle sekce obsahuje fotografie z oficiálních webů konkrétních podniků. Jsou oddělené od ilustrací, protože patří ke konkrétní provozovně.</p>
      <div class="grid" id="official-grid">
        ${model.official.map(officialCard).join('\n')}
      </div>
    </section>
    <section>
      <h2>Kopie na disku</h2>
      <p>Soubory ve složce <code>public/food-illustrations</code>, které mají stejný obsah jako katalogová ilustrace a aktuální přiřazení je nepoužívá jako samostatný záznam. V mřížce jsou jen jednou, pod katalogovou cestou.</p>
      ${leftoverRows(model.leftovers)}
    </section>
  </main>
  <script>
${CLIENT_JS}
  </script>
</body>
</html>
`
}

const CLIENT_JS = `
(function () {
  var norm = function (value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim()
  }
  var panels = {
    illustrations: document.getElementById('illustrations'),
    official: document.getElementById('official')
  }
  var grids = {
    illustrations: document.getElementById('illustration-grid'),
    official: document.getElementById('official-grid')
  }
  var countEl = document.getElementById('visible-count')
  var emptyEl = document.getElementById('empty-state')
  var dishSelect = document.getElementById('dish-key')
  var searchInput = document.getElementById('search')
  var sortSelect = document.getElementById('sort')
  var errorsOnly = document.getElementById('errors-only')
  var active = 'illustrations'
  document.body.classList.add('js')

  function cards() {
    return Array.prototype.slice.call(grids[active].querySelectorAll('.card'))
  }

  function compare(a, b) {
    var sort = sortSelect.value
    var usageA = Number(a.getAttribute('data-usage') || 0)
    var usageB = Number(b.getAttribute('data-usage') || 0)
    var fileA = a.getAttribute('data-file') || ''
    var fileB = b.getAttribute('data-file') || ''
    var dishA = a.getAttribute('data-dish') || ''
    var dishB = b.getAttribute('data-dish') || ''
    if (sort === 'usage-desc' || sort === 'usage-asc') {
      var byUsage = sort === 'usage-desc' ? usageB - usageA : usageA - usageB
      if (byUsage) return byUsage
      return fileA.localeCompare(fileB, 'cs')
    }
    if (sort === 'file') return fileA.localeCompare(fileB, 'cs')
    var byDish = dishA.localeCompare(dishB, 'cs')
    if (byDish) return byDish
    if (usageB !== usageA) return usageB - usageA
    return fileA.localeCompare(fileB, 'cs')
  }

  function apply() {
    var query = norm(searchInput.value)
    var dish = dishSelect.value
    var brokenOnly = errorsOnly.checked
    var list = cards()
    var shown = 0
    for (var i = 0; i < list.length; i += 1) {
      var card = list[i]
      var hay = card.getAttribute('data-search') || ''
      var dishOk = active !== 'illustrations' || !dish || card.getAttribute('data-dish') === dish
      var queryOk = !query || hay.indexOf(query) !== -1
      var errorOk = !brokenOnly || card.getAttribute('data-broken') === '1'
      var visible = dishOk && queryOk && errorOk
      card.hidden = !visible
      if (visible) shown += 1
    }
    list.sort(compare)
    for (var j = 0; j < list.length; j += 1) grids[active].appendChild(list[j])
    var noun = active === 'illustrations' ? 'ilustrací' : 'oficiálních fotografií'
    countEl.textContent = 'Zobrazeno ' + shown + ' z ' + list.length + ' ' + noun
    emptyEl.hidden = shown !== 0
  }

  function setTab(name) {
    active = name
    var names = Object.keys(panels)
    for (var i = 0; i < names.length; i += 1) {
      panels[names[i]].classList.toggle('is-active', names[i] === name)
    }
    var buttons = document.querySelectorAll('[data-tab]')
    for (var b = 0; b < buttons.length; b += 1) {
      var selected = buttons[b].getAttribute('data-tab') === name
      buttons[b].classList.toggle('is-active', selected)
      buttons[b].setAttribute('aria-selected', selected ? 'true' : 'false')
    }
    dishSelect.disabled = name !== 'illustrations'
    apply()
  }

  function markBroken(img) {
    var card = img.closest('.card')
    if (!card || card.getAttribute('data-broken') === '1') return
    card.setAttribute('data-broken', '1')
    var box = document.createElement('div')
    box.className = 'img-error'
    var path = document.createElement('p')
    path.textContent = img.getAttribute('src') || ''
    var id = document.createElement('p')
    id.textContent = 'ID: ' + (card.getAttribute('data-id') || '')
    var title = document.createElement('p')
    title.textContent = 'Nelze načíst obrázek.'
    box.appendChild(title)
    box.appendChild(path)
    box.appendChild(id)
    img.replaceWith(box)
    apply()
  }

  var images = document.querySelectorAll('img.photo')
  for (var n = 0; n < images.length; n += 1) {
    images[n].addEventListener('error', function (event) { markBroken(event.currentTarget) })
  }

  dishSelect.addEventListener('change', apply)
  searchInput.addEventListener('input', apply)
  sortSelect.addEventListener('change', apply)
  errorsOnly.addEventListener('change', apply)
  var tabButtons = document.querySelectorAll('[data-tab]')
  for (var t = 0; t < tabButtons.length; t += 1) {
    tabButtons[t].addEventListener('click', function (event) {
      setTab(event.currentTarget.getAttribute('data-tab'))
    })
  }
  setTab('illustrations')
})()
`

function unescapeAttr(value) {
  return value.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function assertReport(html, model) {
  const found = [...html.matchAll(/data-kind="illustration" data-public="([^"]*)"/g)].map((match) => unescapeAttr(match[1]))
  const expected = model.illustrations.map((item) => item.publicUrl)
  const foundSet = new Set(found)
  const expectedSet = new Set(expected)
  const missing = expected.filter((url) => !foundSet.has(url))
  const extra = found.filter((url) => !expectedSet.has(url))
  if (found.length !== expected.length || missing.length || extra.length) {
    throw new Error(
      `Report neobsahuje všechny ilustrace. Nalezeno ${found.length}, očekáváno ${expected.length}, chybí ${missing.length}, navíc ${extra.length}.`,
    )
  }
  const officialFound = [...html.matchAll(/data-kind="official" data-public="([^"]*)"/g)].map((match) => unescapeAttr(match[1]))
  if (officialFound.length !== model.official.length) {
    throw new Error(`Report neobsahuje všechny oficiální fotky. Nalezeno ${officialFound.length}, očekáváno ${model.official.length}.`)
  }
  if (!html.includes(MARKER)) throw new Error('V reportu chybí značka generátoru.')
  const meta = html.match(/name="illustration-count" content="(\d+)"/)
  if (!meta || Number(meta[1]) !== model.illustrationCount) {
    throw new Error('Počet v hlavičce reportu nesedí s daty.')
  }
}

function main() {
  if (existsSync(OUT)) {
    const head = readFileSync(OUT, 'utf8').slice(0, 20000)
    if (!head.includes(MARKER)) {
      console.error(`Soubor už existuje a není tento kontaktní list. Nepřepisuji: ${OUT}`)
      process.exit(1)
    }
  }
  const model = buildModel()
  const html = render(model)
  assertReport(html, model)
  writeFileSync(OUT, html)
  const relative = path.relative(root, OUT).split(path.sep).join('/')
  console.log(`Kontaktní list: ${relative}`)
  console.log(`Unikátní ilustrace: ${model.illustrationCount} (přiřazené ${model.assignedIllustrationCount}, bez podniku ${model.unassignedIllustrationCount}, mimo katalog ${model.orphanCount})`)
  console.log(`Podniky s ilustrací: ${model.assignedPlaceCount} z ${model.placeCount}`)
  console.log(`Oficiální fotografie: ${model.official.length} unikátních URL, ${model.officialPlaceCount} podniků`)
  console.log(`Kopie se stejným obsahem mimo mřížku: ${model.leftovers.length}`)
  console.log(`Chybějící soubory: ${model.missingFileCount}`)
  console.log(`Nejvyšší počet použití: ${model.maxUsage}`)
  console.log(`Otevřít: file:///${OUT.replace(/\\/g, '/').replace(/ /g, '%20')}`)
}

main()
