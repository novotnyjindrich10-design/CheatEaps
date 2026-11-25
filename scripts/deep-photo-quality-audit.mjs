/**
 * Deep restaurant photo quality audit for FOODGO.
 *
 * - Projde veřejný katalog (bez vyloučených)
 * - Porovná očekávané dish key (název/kategorie/override) vs přiřazenou ilustraci
 * - Spočítá unikáty, opakování, oficiální vs ilustrace, licence
 * - Zapíše evidenci + souhrnný report (JSON + MD)
 * - Nemění logo/nav/design; přiřazení fotek nemění (to dělá fetch-pixabay / manual picks)
 *
 *   node scripts/deep-photo-quality-audit.mjs
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { isCatalogExcluded } from '../src/data/catalogExclusions.js'
import { getCategoryOverride } from '../src/data/categoryOverrides.js'
import { placePhotos } from '../src/data/placePhotos.js'
import {
  placePixabayPhotoId,
  pixabayPhotosById,
  pixabayIdsByTheme,
  pixabayGeneratedAt,
} from '../src/data/pixabayLibrary.data.js'
import { pixabayManualPhotoByPlaceId } from '../src/data/pixabayManualPicks.js'
import { dishSpecForPlace } from './lib/openverseFoodShared.mjs'

const OUT_DIR = new URL('../reports/', import.meta.url)
const LEDGER_JSON = new URL('../reports/deep-photo-quality-ledger.json', import.meta.url)
const REPORT_MD = new URL('../reports/deep-photo-quality-audit.md', import.meta.url)
const REPORT_JSON = new URL('../reports/deep-photo-quality-audit.json', import.meta.url)
const VERIFIED_AT = new Date().toISOString().slice(0, 10)

function publicPath(urlPath) {
  if (!urlPath?.startsWith('/')) return null
  return fileURLToPath(new URL(`../public${urlPath}`, import.meta.url))
}

function fileMeta(urlPath) {
  const local = publicPath(urlPath)
  if (!local || !existsSync(local)) return { exists: false, bytes: 0 }
  return { exists: true, bytes: statSync(local).size }
}

function uniquePlaces() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (!entry?.id || isCatalogExcluded(entry.id)) continue
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  }
  return [...byId.values()].map((entry) => {
    const override = getCategoryOverride(entry.id)
    return {
      ...entry,
      category: override?.category || entry.category || 'neuvedeno',
      type: override?.type || entry.type,
      description: override?.description || entry.description,
    }
  })
}

function licenseForPhoto(photo) {
  const explicit = String(photo?.license || '').toLowerCase()
  const page = String(photo?.pageUrl || '')
  if (explicit === 'pexels' || page.includes('pexels.com')) {
    return {
      license: 'pexels',
      licenseUrl: photo.licenseUrl || 'https://www.pexels.com/license/',
      verified: true,
    }
  }
  if (explicit === 'unsplash' || page.includes('unsplash.com')) {
    return {
      license: 'unsplash',
      licenseUrl: photo.licenseUrl || 'https://unsplash.com/license/',
      verified: true,
    }
  }
  if (page.includes('pixabay.com')) {
    return {
      license: 'pixabay',
      licenseUrl: 'https://pixabay.com/service/license-summary/',
      verified: true,
    }
  }
  return { license: photo?.license || 'unknown', licenseUrl: photo?.licenseUrl || '', verified: false }
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const places = uniquePlaces()
  const ledger = []
  const useCounts = new Map()
  let official = 0
  let illustration = 0
  let none = 0
  let mismatch = 0
  let manual = 0
  let missingFile = 0
  let licenseUnverified = 0
  const kept = []
  const replacedHints = []

  for (const place of places) {
    const photoMeta = placePhotos[place.id] || {}
    const hasOfficial = photoMeta.heroImageKind === 'official' && photoMeta.heroImageUrl
    const expected = dishSpecForPlace(place)
    const row = {
      placeId: place.id,
      name: place.name,
      category: place.category,
      type: place.type || '',
      expectedTheme: expected.key,
      expectedSource: expected.source,
      previousPhoto: null,
      currentPhoto: null,
      sourceUrl: '',
      creator: '',
      license: '',
      licenseUrl: '',
      verifiedAt: VERIFIED_AT,
      illustrative: true,
      changeReason: '',
      relevanceStatus: 'ok',
      licenseStatus: 'ok',
      uncertainty: '',
    }

    if (hasOfficial) {
      official += 1
      row.illustrative = false
      row.currentPhoto = photoMeta.heroImageUrl
      row.sourceUrl = photoMeta.heroImageSource || place.officialWebsite || ''
      row.license = photoMeta.heroImageRights === 'documented' ? 'restaurant-documented' : 'restaurant-undocumented'
      row.licenseStatus = photoMeta.heroImageRights === 'documented' ? 'ok' : 'uncertain'
      row.relevanceStatus = 'official_kept'
      row.changeReason = 'kept_official'
      if (row.licenseStatus !== 'ok') {
        licenseUnverified += 1
        row.uncertainty = 'Oficiální fotka bez plně doložené licence v datech'
      }
      ledger.push(row)
      continue
    }

    const photoId = placePixabayPhotoId[place.id]
    const photo = Number.isInteger(photoId) ? pixabayPhotosById[photoId] : null
    if (!photo) {
      none += 1
      row.relevanceStatus = 'missing'
      row.licenseStatus = 'n/a'
      row.uncertainty = 'Bez oficiální i ilustrační fotografie'
      ledger.push(row)
      continue
    }

    illustration += 1
    const lic = licenseForPhoto(photo)
    const file = fileMeta(photo.cardUrl)
    useCounts.set(photo.id, (useCounts.get(photo.id) || 0) + 1)
    if (Number.isInteger(pixabayManualPhotoByPlaceId[place.id])) manual += 1
    if (!file.exists) missingFile += 1
    if (!lic.verified) licenseUnverified += 1

    row.currentPhoto = photo.cardUrl
    row.sourceUrl = photo.pageUrl || ''
    row.creator = photo.user || ''
    row.license = lic.license
    row.licenseUrl = lic.licenseUrl
    row.licenseStatus = lic.verified ? 'ok' : 'unverified'
    row.pixabayId = photo.id
    row.assignedTheme = photo.theme
    row.dish = photo.dish
    row.fileBytes = file.bytes
    row.fileExists = file.exists

    if (photo.theme !== expected.key) {
      mismatch += 1
      row.relevanceStatus = 'mismatch'
      row.changeReason = Number.isInteger(pixabayManualPhotoByPlaceId[place.id])
        ? 'manual_override_pending_or_applied'
        : 'needs_theme_fix'
      replacedHints.push({
        placeId: place.id,
        name: place.name,
        expected: expected.key,
        actual: photo.theme,
        photoId: photo.id,
      })
    } else {
      row.relevanceStatus = 'ok'
      row.changeReason = Number.isInteger(pixabayManualPhotoByPlaceId[place.id])
        ? 'kept_manual_pick'
        : 'kept_theme_match'
      kept.push(place.id)
    }

    if (!file.exists) {
      row.uncertainty = [row.uncertainty, 'Lokální soubor chybí'].filter(Boolean).join('; ')
    }
    ledger.push(row)
  }

  const uniqueAssets = useCounts.size
  const overused = [...useCounts.entries()]
    .filter(([, n]) => n > 3)
    .sort((a, b) => b[1] - a[1])
  const maxUse = Math.max(0, ...useCounts.values())

  const summary = {
    verifiedAt: new Date().toISOString(),
    pixabayLibraryGeneratedAt: pixabayGeneratedAt,
    placesAudited: places.length,
    officialKept: official,
    illustrations: illustration,
    missingPhoto: none,
    themeMismatches: mismatch,
    manualPicks: manual,
    uniqueIllustrationAssets: uniqueAssets,
    maxIllustrationReuse: maxUse,
    assetsUsedMoreThan3: overused.length,
    missingLocalFiles: missingFile,
    licenseUnverified,
    poolSizes: Object.fromEntries(
      Object.entries(pixabayIdsByTheme).map(([theme, ids]) => [theme, ids.length]),
    ),
    librarySize: Object.keys(pixabayPhotosById).length,
    mismatchSamples: replacedHints.slice(0, 30),
    topOverused: overused.slice(0, 20).map(([id, n]) => ({
      id,
      uses: n,
      theme: pixabayPhotosById[id]?.theme,
      dish: pixabayPhotosById[id]?.dish,
      pageUrl: pixabayPhotosById[id]?.pageUrl,
    })),
    methodNotes: [
      'Každý veřejný podnik má řádek v ledgeru (ID, očekávané téma, přiřazená fotka, licence).',
      'Relevance: dishSpecForPlace (override / name_specific / category / name / fallback) vs foodIllustrationTheme.',
      'Licence: Pixabay/Pexels/Unsplash dle pageUrl nebo explicitního pole; oficiální dle heroImageRights.',
      'Individuální vizuální kontrola každého z 774 snímků člověkem nebyla v tomto běhu provedena; contact sheet slouží k manuální kontrole.',
      'Ilustrace zůstávají označené jako „Ilustrační fotografie“ v UI.',
    ],
  }

  writeFileSync(LEDGER_JSON, JSON.stringify({ version: 1, verifiedAt: summary.verifiedAt, rows: ledger }, null, 2))
  writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2))

  const md = `# Deep photo quality audit

Vygenerováno: ${summary.verifiedAt}

## Metoda (co bylo / nebylo ověřeno)

${summary.methodNotes.map((line) => `- ${line}`).join('\n')}

## Souhrn

| Metrika | Hodnota |
| --- | ---: |
| Prověřených podniků (katalog) | ${summary.placesAudited} |
| Oficiální fotky (ponechány) | ${summary.officialKept} |
| Ilustrace (Pixabay/Pexels/Unsplash pool) | ${summary.illustrations} |
| Bez fotografie | ${summary.missingPhoto} |
| Theme mismatch (očekáváno ≠ přiřazeno) | ${summary.themeMismatches} |
| Ruční výjimky | ${summary.manualPicks} |
| Unikátních ilustrací v přiřazení | ${summary.uniqueIllustrationAssets} |
| Max. opakování jedné ilustrace | ${summary.maxIllustrationReuse} |
| Assetů s >3 použitími | ${summary.assetsUsedMoreThan3} |
| Chybějící lokální soubory | ${summary.missingLocalFiles} |
| Licence nejisté | ${summary.licenseUnverified} |
| Velikost knihovny | ${summary.librarySize} |

## Nejčastější opakování

| Photo ID | Použití | Téma | Dish | Zdroj |
| --- | ---: | --- | --- | --- |
${summary.topOverused
  .map(
    (row) =>
      `| ${row.id} | ${row.uses} | ${row.theme || ''} | ${row.dish || ''} | ${row.pageUrl || ''} |`,
  )
  .join('\n')}

## Theme mismatch vzorky

${
  summary.mismatchSamples.length
    ? summary.mismatchSamples
        .map(
          (row) =>
            `- **${row.name}** (\`${row.placeId}\`): očekáváno \`${row.expected}\`, přiřazeno \`${row.actual}\` (photo ${row.photoId})`,
        )
        .join('\n')
    : '- Žádné.'
}

## Evidence

- Ledger: \`reports/deep-photo-quality-ledger.json\` (${ledger.length} řádků)
- JSON souhrn: \`reports/deep-photo-quality-audit.json\`
- Contact sheet: \`reports/illustration-contact-sheet.html\` (po \`node scripts/generate-illustration-contact-sheet.mjs\`)
`

  writeFileSync(REPORT_MD, md)
  console.log(
    JSON.stringify(
      {
        places: summary.placesAudited,
        official,
        illustration,
        mismatch,
        unique: uniqueAssets,
        maxUse,
        over3: overused.length,
        ledger: ledger.length,
      },
      null,
      2,
    ),
  )
}

main()
