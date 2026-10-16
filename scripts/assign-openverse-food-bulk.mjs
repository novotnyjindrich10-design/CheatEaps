/**
 * Hromadné přiřazení Openverse ilustrací jídel všem podnikům bez oficiální fotky.
 *
 * Strategie (rychlost + licence):
 * - oficiální fotky z placePhotos mají přednost (nepřepisují se)
 * - existující place-specific přiřazení (pilot) se zachovají
 * - nová přiřazení jdou přes sdílený asset na dish key (kategorie / tip z názvu)
 * - Openverse se volá jen pro chybějící dish key, s cache + resume
 *
 * Spuštění: node scripts/assign-openverse-food-bulk.mjs
 * Pokračování po přerušení: znovu stejný příkaz (načte state).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { placeFoodIllustrationsPilot } from '../src/data/placeFoodIllustrations.pilot.js'
import {
  dishSpecForPlace,
  downloadFile,
  extOf,
  illustrationRecord,
  needsAttribution,
  scoreResult,
  searchOpenverse,
  sleep,
  uniquePlaces,
} from './lib/openverseFoodShared.mjs'

const OUT_DIR = new URL('../public/food-illustrations/', import.meta.url)
const SHARED_DIR = new URL('../public/food-illustrations/shared/', import.meta.url)
const STATE_PATH = new URL('../reports/openverse-food-bulk-state.json', import.meta.url)
const DATA_PATH = new URL('../src/data/placeFoodIllustrations.js', import.meta.url)
const REPORT_MD = new URL('../reports/restaurant-images-coverage.md', import.meta.url)
const REPORT_JSON = new URL('../reports/restaurant-images-coverage.json', import.meta.url)

const MIN_SCORE = 2
const SEARCH_DELAY_MS = 1200
const DOWNLOAD_DELAY_MS = 250
const MAX_RETRIES_429 = 4

mkdirSync(OUT_DIR, { recursive: true })
mkdirSync(SHARED_DIR, { recursive: true })
mkdirSync(new URL('../reports/', import.meta.url), { recursive: true })

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return {
      version: 1,
      dishAssets: {},
      queryCache: {},
      placeRows: {},
      updatedAt: null,
    }
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
}

function saveState(state) {
  state.updatedAt = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

function toFsPath(urlOrPath) {
  if (typeof urlOrPath === 'string') return urlOrPath
  return fileURLToPath(urlOrPath)
}

function fileOk(urlOrPath) {
  try {
    const fsPath = toFsPath(urlOrPath)
    return existsSync(fsPath) && statSync(fsPath).size > 1000
  } catch {
    return false
  }
}

function publicToLocal(publicUrl) {
  if (!publicUrl?.startsWith('/food-illustrations/')) return null
  return new URL(`../public${publicUrl}`, import.meta.url)
}

function seedDishAssetsFromPilot(state) {
  for (const [id, rec] of Object.entries(placeFoodIllustrationsPilot)) {
    if (!rec.foodIllustrationOpenverseId || !rec.foodIllustrationUrl) continue
    const place = { id, name: id, category: 'neuvedeno' }
    // find real place for category
    const found = [...curatedPlaces, ...osmPlaces].find((p) => p.id === id)
    const spec = dishSpecForPlace(found || place)
    const key = spec.key
    if (state.dishAssets[key]) continue
    const local = publicToLocal(rec.foodIllustrationUrl)
    if (!local || !fileOk(local)) continue
    // copy into shared/ for stable reuse
    const ext = extOf(rec.foodIllustrationOriginalUrl || rec.foodIllustrationUrl, 'jpg')
    const sharedName = `${key}-${rec.foodIllustrationOpenverseId.slice(0, 8)}.${ext}`
    const sharedLocal = new URL(sharedName, SHARED_DIR)
    if (!fileOk(sharedLocal)) {
      try {
        copyFileSync(toFsPath(local), toFsPath(sharedLocal))
      } catch (err) {
        console.warn('seed copy failed', key, err.message)
        continue
      }
    }
    state.dishAssets[key] = {
      key,
      dish: rec.foodIllustrationDish || spec.dish,
      openverseId: rec.foodIllustrationOpenverseId,
      license: rec.foodIllustrationLicense,
      licenseUrl: rec.foodIllustrationLicenseUrl,
      creator: rec.foodIllustrationCreator,
      creatorUrl: rec.foodIllustrationCreatorUrl,
      sourceUrl: rec.foodIllustrationSourceUrl,
      attribution: rec.foodIllustrationAttribution,
      originalUrl: rec.foodIllustrationOriginalUrl,
      publicUrl: `/food-illustrations/shared/${sharedName}`,
      seededFrom: id,
    }
  }
}

async function searchWithRetry(query) {
  let attempt = 0
  for (;;) {
    try {
      const page = await searchOpenverse(query)
      return page.results || []
    } catch (err) {
      if (err.code === 'RATE_LIMIT' && attempt < MAX_RETRIES_429) {
        attempt += 1
        const wait = 5000 * attempt
        console.warn(`429 – čekám ${wait}ms (pokus ${attempt})`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
}

async function resolveDishAsset(state, spec) {
  const key = spec.key
  if (state.dishAssets[key]?.publicUrl) {
    const local = publicToLocal(state.dishAssets[key].publicUrl)
    if (local && fileOk(local)) return state.dishAssets[key]
  }

  const queries = [spec.query, ...(spec.fallbacks || [])]
  let best = null
  let bestScore = -1
  let usedQuery = spec.query

  for (const query of queries) {
    let results = state.queryCache[query]
    if (!results) {
      await sleep(SEARCH_DELAY_MS)
      console.log(`Openverse search [${key}]: ${query}`)
      try {
        results = await searchWithRetry(query)
      } catch (err) {
        console.warn(`search failed [${key}] ${query}:`, err.message)
        results = []
      }
      state.queryCache[query] = results.map((r) => ({
        id: r.id,
        title: r.title,
        license: r.license,
        license_url: r.license_url,
        creator: r.creator,
        creator_url: r.creator_url,
        foreign_landing_url: r.foreign_landing_url,
        attribution: r.attribution,
        url: r.url,
        filetype: r.filetype,
        width: r.width,
        height: r.height,
        mature: r.mature,
        tags: r.tags,
      }))
      saveState(state)
      results = state.queryCache[query]
    }

    const ranked = results
      .map((item) => ({ item, score: scoreResult(item, spec.keywords) }))
      .filter((row) => row.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score)

    if (ranked[0] && ranked[0].score > bestScore) {
      best = ranked[0].item
      bestScore = ranked[0].score
      usedQuery = query
    }
    if (bestScore >= 6) break
  }

  if (!best) {
    state.dishAssets[key] = {
      key,
      status: 'not_found',
      note: 'Openverse nevrátil relevantní CC0/PDM/BY/BY-SA fotografii.',
      queries,
    }
    saveState(state)
    return null
  }

  const ext = extOf(best.url, best.filetype)
  const sharedName = `${key}-${best.id.slice(0, 8)}.${ext}`
  const sharedLocal = new URL(sharedName, SHARED_DIR)
  const publicUrl = `/food-illustrations/shared/${sharedName}`

  if (!fileOk(sharedLocal)) {
    await sleep(DOWNLOAD_DELAY_MS)
    console.log(`download [${key}] ${best.title}`)
    try {
      await downloadFile(best.url, toFsPath(sharedLocal))
    } catch (err) {
      console.warn(`download failed [${key}]:`, err.message)
      state.dishAssets[key] = {
        key,
        status: 'download_failed',
        note: err.message,
        openverseId: best.id,
        sourceUrl: best.foreign_landing_url,
      }
      saveState(state)
      return null
    }
  }

  state.dishAssets[key] = {
    key,
    dish: spec.dish,
    openverseId: best.id,
    license: best.license,
    licenseUrl: best.license_url || '',
    creator: best.creator || '',
    creatorUrl: best.creator_url || '',
    sourceUrl: best.foreign_landing_url || '',
    attribution: best.attribution || '',
    originalUrl: best.url,
    publicUrl,
    title: best.title,
    score: bestScore,
    query: usedQuery,
    status: 'ok',
  }
  saveState(state)
  return state.dishAssets[key]
}

function hasOfficial(placeId) {
  const p = placePhotos[placeId]
  return Boolean(p?.heroImageKind === 'official' && p?.heroImageUrl)
}

function pilotRecordOk(rec) {
  if (!rec?.foodIllustrationUrl || rec.foodIllustrationKind !== 'openverse') return false
  const local = publicToLocal(rec.foodIllustrationUrl)
  return local && fileOk(local)
}

function writeDataFile(overlay) {
  const body = `/** Ilustrace jídel z Openverse (sdílené i place-specific). Regeneruj: node scripts/assign-openverse-food-bulk.mjs */
export const placeFoodIllustrations = ${JSON.stringify(overlay, null, 2)}
`
  writeFileSync(DATA_PATH, body, 'utf8')
}

function writeCoverageReport(places, overlay) {
  const allowedLic = new Set(['cc0', 'pdm', 'by', 'by-sa'])
  let official = 0
  let illustration = 0
  let missingDetailPhoto = 0
  let needsAttr = 0
  let unverifiedLicense = 0
  let placeSpecific = 0
  let shared = 0
  const byCategory = {}
  const missingIds = []

  for (const place of places) {
    const cat = place.category || 'neuvedeno'
    if (!byCategory[cat]) byCategory[cat] = { total: 0, official: 0, illustration: 0, missing: 0 }
    byCategory[cat].total += 1

    if (hasOfficial(place.id)) {
      official += 1
      byCategory[cat].official += 1
      continue
    }
    const ill = overlay[place.id]
    if (ill?.foodIllustrationUrl && ill.foodIllustrationKind === 'openverse') {
      illustration += 1
      byCategory[cat].illustration += 1
      if (needsAttribution(ill.foodIllustrationLicense)) needsAttr += 1
      if (!allowedLic.has(String(ill.foodIllustrationLicense || '').toLowerCase())) unverifiedLicense += 1
      if (ill.foodIllustrationSharedKey) shared += 1
      else placeSpecific += 1
    } else {
      missingDetailPhoto += 1
      byCategory[cat].missing += 1
      missingIds.push(place.id)
    }
  }

  const withAny = official + illustration
  const summary = {
    generatedAt: new Date().toISOString(),
    totalPlaces: places.length,
    withDetailPhoto: withAny,
    officialVerified: official,
    illustrationOpenverse: illustration,
    illustrationPlaceSpecific: placeSpecific,
    illustrationSharedByDish: shared,
    missingDetailPhoto,
    unverifiedLicenses: unverifiedLicense,
    requiringAttribution: needsAttr,
    coveragePct: Number(((withAny / places.length) * 100).toFixed(1)),
    notes: {
      official: 'Ověřené: heroImageKind=official v placePhotos (sken oficiálních webů).',
      illustration: 'Ověřené licence z Openverse API (cc0/pdm/by/by-sa). Ilustrace ≠ foto podniku.',
      missing: 'Bez oficiální i bez Openverse → na detailu zůstane SVG ilustrace kuchyně.',
      googlePlacesPhotos: 'Nepoužito — Places Photo API vyžaduje placený Google Cloud billing.',
      scrapingRestaurants: 'Hromadné scrapování webů restaurací se neprovádí (licence / ToS).',
    },
    byCategory,
    missingSample: missingIds.slice(0, 40),
  }

  writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2), 'utf8')

  const catRows = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([k, v]) =>
        `| ${k} | ${v.total} | ${v.official} | ${v.illustration} | ${v.missing} |`,
    )

  const md = [
    '# Pokrytí fotografií podniků (detail)',
    '',
    `Vygenerováno: ${summary.generatedAt}`,
    '',
    '## Souhrn (ověřené údaje)',
    '',
    '| Metrika | Počet |',
    '| --- | ---: |',
    `| Podniků celkem | ${summary.totalPlaces} |`,
    `| S fotografií na detailu (oficiální nebo ilustrace) | ${summary.withDetailPhoto} |`,
    `| Oficiální fotografie (placePhotos) | ${summary.officialVerified} |`,
    `| Ilustrace Openverse | ${summary.illustrationOpenverse} |`,
    `| — z toho place-specific | ${summary.illustrationPlaceSpecific} |`,
    `| — z toho sdílené podle typu jídla | ${summary.illustrationSharedByDish} |`,
    `| Bez fotografie (SVG kuchyně) | ${summary.missingDetailPhoto} |`,
    `| Ilustrace vyžadující atribuci (CC BY / BY-SA) | ${summary.requiringAttribution} |`,
    `| Ilustrace s neověřenou / nepovolenou licencí | ${summary.unverifiedLicenses} |`,
    `| Pokrytí | ${summary.coveragePct} % |`,
    '',
    '## Poznámky',
    '',
    `- **Oficiální:** ${summary.notes.official}`,
    `- **Ilustrace:** ${summary.notes.illustration}`,
    `- **Chybějící:** ${summary.notes.missing}`,
    `- **Google Places Photos:** ${summary.notes.googlePlacesPhotos}`,
    `- **Scraping restaurací:** ${summary.notes.scrapingRestaurants}`,
    '',
    '## Podle kategorie',
    '',
    '| Kategorie | Celkem | Oficiální | Ilustrace | Chybí |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...catRows,
    '',
    '## Ukázka podniků bez fotky',
    '',
    ...(missingIds.length
      ? missingIds.slice(0, 40).map((id) => `- \`${id}\``)
      : ['- Žádné.']),
    '',
  ]

  writeFileSync(REPORT_MD, md.join('\n'), 'utf8')
  return summary
}

const places = uniquePlaces(curatedPlaces, osmPlaces)
const state = loadState()
seedDishAssetsFromPilot(state)
saveState(state)

const overlay = {}

// 1) Keep valid pilot place-specific records
for (const [id, rec] of Object.entries(placeFoodIllustrationsPilot)) {
  if (hasOfficial(id)) continue
  if (pilotRecordOk(rec)) {
    overlay[id] = { ...rec }
    state.placeRows[id] = { status: 'kept_pilot', dish: rec.foodIllustrationDish }
  }
}

// 2) Resolve unique dish keys needed
const neededKeys = new Map()
for (const place of places) {
  if (hasOfficial(place.id)) {
    state.placeRows[place.id] = { status: 'kept_official' }
    continue
  }
  if (overlay[place.id]) continue
  const spec = dishSpecForPlace(place)
  if (!neededKeys.has(spec.key)) neededKeys.set(spec.key, spec)
}

console.log({
  places: places.length,
  official: places.filter((p) => hasOfficial(p.id)).length,
  keptPilot: Object.keys(overlay).length,
  dishKeysToResolve: [...neededKeys.keys()],
})

for (const [key, spec] of neededKeys) {
  try {
    await resolveDishAsset(state, spec)
  } catch (err) {
    console.warn(`resolve failed ${key}:`, err.message)
    state.dishAssets[key] = {
      key,
      status: 'error',
      note: String(err.message || err),
    }
    saveState(state)
  }
}

// 3) Assign shared assets to remaining places
for (const place of places) {
  if (hasOfficial(place.id)) continue
  if (overlay[place.id]) continue
  const spec = dishSpecForPlace(place)
  const asset = state.dishAssets[spec.key]
  if (!asset?.publicUrl || asset.status === 'not_found' || asset.status === 'download_failed') {
    state.placeRows[place.id] = {
      status: asset?.status || 'not_found',
      dishKey: spec.key,
      note: asset?.note || 'no asset',
    }
    continue
  }
  overlay[place.id] = illustrationRecord(
    place,
    asset.dish || spec.dish,
    asset.publicUrl,
    {
      id: asset.openverseId,
      license: asset.license,
      license_url: asset.licenseUrl,
      creator: asset.creator,
      creator_url: asset.creatorUrl,
      foreign_landing_url: asset.sourceUrl,
      attribution: asset.attribution,
      url: asset.originalUrl,
    },
    { sharedKey: spec.key },
  )
  state.placeRows[place.id] = {
    status: 'assigned_shared',
    dishKey: spec.key,
    dishSource: spec.source,
  }
}

saveState(state)
writeDataFile(overlay)
const summary = writeCoverageReport(places, overlay)

// Kompaktní runtime data (sdílené assety + mapa), ať bundle nebobtná.
const { spawnSync } = await import('child_process')
const compact = spawnSync(process.execPath, [fileURLToPath(new URL('./compact-food-illustrations.mjs', import.meta.url))], {
  stdio: 'inherit',
})
if (compact.status !== 0) {
  console.warn('compact-food-illustrations selhal – ponechán plný overlay')
}

console.log({
  written: Object.keys(overlay).length,
  coverage: summary.coveragePct,
  official: summary.officialVerified,
  illustration: summary.illustrationOpenverse,
  missing: summary.missingDetailPhoto,
})
