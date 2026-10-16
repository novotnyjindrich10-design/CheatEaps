/**
 * Audit + oprava přiřazení ilustrací podle jemnějších dish keys.
 * Oficiální fotky nepřepisuje. Nové Openverse stahuje jen pro chybějící keys.
 *
 * node scripts/fix-food-illustration-quality.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { placeFoodIllustrationsPilot } from '../src/data/placeFoodIllustrations.pilot.js'
import {
  DISH_SPECS,
  auditAssignment,
  dishSpecForPlace,
  downloadFile,
  extOf,
  illustrationRecord,
  needsAttribution,
  sleep,
  uniquePlaces,
} from './lib/openverseFoodShared.mjs'

const SHARED_DIR = new URL('../public/food-illustrations/shared/', import.meta.url)
const STATE_PATH = new URL('../reports/openverse-food-bulk-state.json', import.meta.url)
const AUDIT_MD = new URL('../reports/restaurant-images-quality-audit.md', import.meta.url)
const AUDIT_JSON = new URL('../reports/restaurant-images-quality-audit.json', import.meta.url)
const COVERAGE_MD = new URL('../reports/restaurant-images-coverage.md', import.meta.url)
const COVERAGE_JSON = new URL('../reports/restaurant-images-coverage.json', import.meta.url)

mkdirSync(SHARED_DIR, { recursive: true })

function toFs(url) {
  return fileURLToPath(url)
}

function fileOk(url) {
  try {
    const p = toFs(url)
    return existsSync(p) && statSync(p).size > 1000
  } catch {
    return false
  }
}

function publicToLocal(publicUrl) {
  if (!publicUrl?.startsWith('/food-illustrations/')) return null
  return new URL(`../public${publicUrl}`, import.meta.url)
}

function hasOfficial(id) {
  const p = placePhotos[id]
  return Boolean(p?.heroImageKind === 'official' && p?.heroImageUrl)
}

function loadState() {
  if (!existsSync(STATE_PATH)) {
    return { version: 1, dishAssets: {}, queryCache: {}, placeRows: {} }
  }
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
}

function saveState(state) {
  state.updatedAt = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

/** Ověřené Openverse záznamy (nesmí se vymýšlet). */
const CURATED_DOWNLOADS = {
  fried_chicken: {
    id: '73034d3c-9b72-4eec-864e-560f5eb69066',
    license: 'cc0',
    title: 'Chicken strips and sweet potato fries',
    creator: 'sarahstierch',
    creator_url: 'https://www.flickr.com/photos/7633518@N08',
    url: 'https://live.staticflickr.com/65535/54278879244_0f38787c2d_b.jpg',
    foreign_landing_url: 'https://www.flickr.com/photos/7633518@N08/54278879244',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      '"Chicken strips and sweet potato fries" by sarahstierch is marked with CC0 1.0. To view the terms, visit https://creativecommons.org/publicdomain/zero/1.0/.',
    filetype: 'jpg',
  },
  sushi: {
    id: '26b6141c-6a9c-47d3-ac1e-8b868aebd24f',
    license: 'cc0',
    title: 'Sushi Sake',
    creator: 'Jamie Hamel-Smith',
    creator_url: 'https://plus.google.com/+JamieHamelSmith/posts',
    url: 'https://cdn.stocksnap.io/img-thumbs/960w/EZWO30D5TV.jpg',
    foreign_landing_url: 'https://stocksnap.io/photo/sushi-sake-EZWO30D5TV',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      '"Sushi Sake" by Jamie Hamel-Smith is marked with CC0 1.0. To view the terms, visit https://creativecommons.org/publicdomain/zero/1.0/.',
    filetype: 'jpg',
  },
  fries: {
    id: '4674fe1f-8254-4a2b-9536-91349c8bf12e',
    license: 'cc0',
    title: 'French fries',
    creator: 'sarahstierch',
    creator_url: 'https://www.flickr.com/photos/7633518@N08',
    url: 'https://live.staticflickr.com/65535/54235252804_c1f4a92dd0_b.jpg',
    foreign_landing_url: 'https://www.flickr.com/photos/7633518@N08/54235252804',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      '"French fries" by sarahstierch is marked with CC0 1.0. To view the terms, visit https://creativecommons.org/publicdomain/zero/1.0/.',
    filetype: 'jpg',
  },
  ramen: {
    id: 'a01ecc5c-176b-4d1f-a445-655ff2184e3a',
    license: 'cc0',
    title: 'Ramen Noodles',
    creator: 'Foodie Girl',
    creator_url: 'https://stocksnap.io/author/121423',
    url: 'https://cdn.stocksnap.io/img-thumbs/960w/KKMQPWQK6H.jpg',
    foreign_landing_url: 'https://stocksnap.io/photo/ramen-noodles-KKMQPWQK6H',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution:
      '"Ramen Noodles" by Foodie Girl is marked with CC0 1.0. To view the terms, visit https://creativecommons.org/publicdomain/zero/1.0/.',
    filetype: 'jpg',
  },
}

function assetFromOpenverse(key, dish, best, publicUrl) {
  return {
    key,
    dish,
    openverseId: best.id,
    license: best.license,
    licenseUrl: best.license_url || best.licenseUrl || '',
    creator: best.creator || '',
    creatorUrl: best.creator_url || best.creatorUrl || '',
    sourceUrl: best.foreign_landing_url || best.sourceUrl || '',
    attribution: best.attribution || '',
    originalUrl: best.url || best.originalUrl || '',
    publicUrl,
    title: best.title || '',
    status: 'ok',
  }
}

async function ensureCuratedAsset(state, key) {
  const spec = DISH_SPECS[key]
  const curated = CURATED_DOWNLOADS[key]
  if (!curated) return state.dishAssets[key]

  const ext = extOf(curated.url, curated.filetype)
  const sharedName = `${key}-${curated.id.slice(0, 8)}.${ext}`
  const sharedLocal = new URL(sharedName, SHARED_DIR)
  const publicUrl = `/food-illustrations/shared/${sharedName}`

  if (!fileOk(sharedLocal)) {
    console.log(`download curated [${key}] ${curated.title}`)
    await sleep(300)
    await downloadFile(curated.url, toFs(sharedLocal))
  }

  state.dishAssets[key] = assetFromOpenverse(key, spec.dish, curated, publicUrl)
  saveState(state)
  return state.dishAssets[key]
}

function migrateBaguetteFromOldFastfood(state) {
  const old = state.dishAssets.fastfood
  if (!old?.publicUrl) return
  // Pokud starý fastfood je bageta, přejmenuj na baguette a zruš jako fastfood
  const isBaguette =
    /baguette|bread|pečiv|pastry/i.test(`${old.title || ''} ${old.dish || ''} ${old.attribution || ''}`) ||
    old.publicUrl.includes('fastfood-3bf431be')

  if (!isBaguette) return

  const baguetteLocal = new URL(`baguette-${(old.openverseId || '3bf431be').slice(0, 8)}.jpg`, SHARED_DIR)
  const oldLocal = publicToLocal(old.publicUrl)
  if (oldLocal && fileOk(oldLocal) && !fileOk(baguetteLocal)) {
    copyFileSync(toFs(oldLocal), toFs(baguetteLocal))
  }
  const publicUrl = `/food-illustrations/shared/baguette-${(old.openverseId || '3bf431be').slice(0, 8)}.jpg`
  state.dishAssets.baguette = {
    ...old,
    key: 'baguette',
    dish: DISH_SPECS.baguette.dish,
    publicUrl: fileOk(baguetteLocal) ? publicUrl : old.publicUrl,
    status: 'ok',
  }
  // fastfood asset zruš – nahradí fries
  delete state.dishAssets.fastfood
}

function aliasAsset(state, fromKey, toKey) {
  const src = state.dishAssets[fromKey]
  if (!src?.publicUrl) return null
  if (state.dishAssets[toKey]?.publicUrl && fileOk(publicToLocal(state.dishAssets[toKey].publicUrl))) {
    return state.dishAssets[toKey]
  }
  const spec = DISH_SPECS[toKey]
  state.dishAssets[toKey] = {
    ...src,
    key: toKey,
    dish: spec?.dish || src.dish,
    status: 'ok',
    aliasedFrom: fromKey,
  }
  return state.dishAssets[toKey]
}

const places = uniquePlaces(curatedPlaces, osmPlaces)
const state = loadState()
migrateBaguetteFromOldFastfood(state)

// Zajisti nové assety
await ensureCuratedAsset(state, 'fried_chicken')
await ensureCuratedAsset(state, 'sushi')
await ensureCuratedAsset(state, 'fries')
await ensureCuratedAsset(state, 'ramen')
// fastfood = stejné hranolky (bez pečiva)
if (state.dishAssets.fries?.publicUrl) {
  state.dishAssets.fastfood = {
    ...state.dishAssets.fries,
    key: 'fastfood',
    dish: DISH_SPECS.fastfood.dish,
  }
}
// pho = existující asijske (pho fotka), pokud je
aliasAsset(state, 'asijske', 'pho')
saveState(state)

const problemsBefore = []
const problemsAfter = []
const fixed = []
const manualReview = []
const overlayForReport = {}

// Audit před opravou (podle starého placeRows dishKey + aktuální asset)
for (const place of places) {
  if (hasOfficial(place.id)) continue
  const oldKey = state.placeRows[place.id]?.dishKey
  const pilot = placeFoodIllustrationsPilot[place.id]
  if (pilot && !oldKey) {
    // place-specific – audit proti novému expected key
    const expected = dishSpecForPlace(place)
    const audit = auditAssignment(place, expected.key, pilot)
    if (!audit.ok) {
      problemsBefore.push({ id: place.id, name: place.name, key: expected.key, reasons: audit.reasons, phase: 'pilot' })
    }
    continue
  }
  if (!oldKey) continue
  const asset = state.dishAssets[oldKey] || {}
  const audit = auditAssignment(place, oldKey, {
    foodIllustrationDish: asset.dish,
    title: asset.title,
    foodIllustrationAttribution: asset.attribution,
  })
  // Také: očekávaný key vs přiřazený
  const expected = dishSpecForPlace(place)
  if (expected.key !== oldKey) {
    problemsBefore.push({
      id: place.id,
      name: place.name,
      key: oldKey,
      expected: expected.key,
      reasons: [`dish key ${oldKey} → očekáváno ${expected.key} (${expected.source})`, ...audit.reasons],
      phase: 'before',
    })
  } else if (!audit.ok) {
    problemsBefore.push({ id: place.id, name: place.name, key: oldKey, reasons: audit.reasons, phase: 'before' })
  }
}

// Přeřazení
for (const place of places) {
  if (hasOfficial(place.id)) {
    state.placeRows[place.id] = { status: 'kept_official' }
    continue
  }

  const pilot = placeFoodIllustrationsPilot[place.id]
  const expected = dishSpecForPlace(place)

  // Pilot place-specific: ponech, pokud audit OK vůči expected key
  // nebo pokud expected key == pilot shared semantic
  if (pilot?.foodIllustrationUrl && fileOk(publicToLocal(pilot.foodIllustrationUrl))) {
    const pilotAudit = auditAssignment(place, expected.key, pilot)
    // Pokud očekáváme specifický key a pilot je špatný typ, přepiš na shared
    const pilotDish = `${pilot.foodIllustrationDish || ''} ${pilot.foodIllustrationAttribution || ''}`.toLowerCase()
    const pilotConflicts =
      (expected.key === 'fried_chicken' && /baguette|pastry|bread|cake/.test(pilotDish)) ||
      (expected.key === 'sushi' && !/sushi|nigiri|sashimi/.test(pilotDish) && /burger|pizza|pho/.test(pilotDish))

    if (!pilotConflicts && (pilotAudit.ok || expected.source === 'category' || expected.source === 'name')) {
      // U specifických keys preferuj správný shared asset před obecným pilotem
      if (['fried_chicken', 'sushi', 'baguette', 'fries'].includes(expected.key) && expected.source === 'name_specific') {
        // fall through to shared
      } else {
        state.placeRows[place.id] = { status: 'kept_pilot', dishKey: expected.key, dishSource: 'pilot' }
        overlayForReport[place.id] = { ...pilot }
        continue
      }
    }
  }

  const asset = state.dishAssets[expected.key]
  if (!asset?.publicUrl || !fileOk(publicToLocal(asset.publicUrl))) {
    state.placeRows[place.id] = {
      status: 'missing_asset',
      dishKey: expected.key,
      dishSource: expected.source,
    }
    manualReview.push({
      id: place.id,
      name: place.name,
      reason: `Chybí ověřený asset pro key ${expected.key}`,
    })
    continue
  }

  const prevKey = state.placeRows[place.id]?.dishKey
  if (prevKey && prevKey !== expected.key) {
    fixed.push({
      id: place.id,
      name: place.name,
      from: prevKey,
      to: expected.key,
      source: expected.source,
    })
  }

  const rec = illustrationRecord(
    place,
    asset.dish || expected.dish,
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
    { sharedKey: expected.key },
  )
  overlayForReport[place.id] = rec
  state.placeRows[place.id] = {
    status: 'assigned_shared',
    dishKey: expected.key,
    dishSource: expected.source,
  }

  if (asset.needsManualReview) {
    manualReview.push({
      id: place.id,
      name: place.name,
      reason: asset.note || `Asset ${expected.key} vyžaduje ruční kontrolu`,
    })
  }

  const after = auditAssignment(place, expected.key, {
    foodIllustrationDish: asset.dish,
    title: asset.title,
    foodIllustrationAttribution: asset.attribution,
  })
  if (!after.ok) {
    problemsAfter.push({ id: place.id, name: place.name, key: expected.key, reasons: after.reasons })
    manualReview.push({ id: place.id, name: place.name, reason: after.reasons.join('; ') })
  }
}

saveState(state)

// Compact data file
const compact = spawnSync(process.execPath, [toFs(new URL('./compact-food-illustrations.mjs', import.meta.url))], {
  stdio: 'inherit',
})
if (compact.status !== 0) {
  console.error('compact failed')
  process.exit(1)
}

// Coverage report
let official = 0
let illustration = 0
let missing = 0
let needsAttr = 0
let unverified = 0
let placeSpecific = 0
let shared = 0
const byCategory = {}
const allowedLic = new Set(['cc0', 'pdm', 'by', 'by-sa'])

for (const place of places) {
  const cat = place.category || 'neuvedeno'
  if (!byCategory[cat]) byCategory[cat] = { total: 0, official: 0, illustration: 0, missing: 0 }
  byCategory[cat].total += 1
  if (hasOfficial(place.id)) {
    official += 1
    byCategory[cat].official += 1
    continue
  }
  const row = state.placeRows[place.id]
  const asset = row?.dishKey ? state.dishAssets[row.dishKey] : null
  const hasIll =
    (row?.status === 'kept_pilot' && placeFoodIllustrationsPilot[place.id]) ||
    (row?.status === 'assigned_shared' && asset?.publicUrl)
  if (hasIll) {
    illustration += 1
    byCategory[cat].illustration += 1
    if (row.status === 'kept_pilot') placeSpecific += 1
    else shared += 1
    const lic = placeFoodIllustrationsPilot[place.id]?.foodIllustrationLicense || asset?.license
    if (needsAttribution(lic)) needsAttr += 1
    if (!allowedLic.has(String(lic || '').toLowerCase())) unverified += 1
  } else {
    missing += 1
    byCategory[cat].missing += 1
  }
}

const coverage = {
  generatedAt: new Date().toISOString(),
  totalPlaces: places.length,
  withDetailPhoto: official + illustration,
  officialVerified: official,
  illustrationOpenverse: illustration,
  illustrationPlaceSpecific: placeSpecific,
  illustrationSharedByDish: shared,
  missingDetailPhoto: missing,
  unverifiedLicenses: unverified,
  requiringAttribution: needsAttr,
  coveragePct: Number((((official + illustration) / places.length) * 100).toFixed(1)),
  notes: {
    official: 'Ověřené: heroImageKind=official v placePhotos.',
    illustration: 'Openverse CC0/PDM/BY/BY-SA. Ilustrace ≠ foto podniku. Dish key = typ jídla, ne jen kategorie.',
    quality: 'Kvalita přiřazení: viz restaurant-images-quality-audit.md (neuvádíme 100% vizuální správnost).',
  },
  byCategory,
}
writeFileSync(COVERAGE_JSON, JSON.stringify(coverage, null, 2), 'utf8')
writeFileSync(
  COVERAGE_MD,
  [
    '# Pokrytí fotografií podniků (detail)',
    '',
    `Vygenerováno: ${coverage.generatedAt}`,
    '',
    '## Souhrn (ověřené údaje o přítomnosti fotky)',
    '',
    '| Metrika | Počet |',
    '| --- | ---: |',
    `| Podniků celkem | ${coverage.totalPlaces} |`,
    `| S fotografií na detailu | ${coverage.withDetailPhoto} |`,
    `| Oficiální | ${coverage.officialVerified} |`,
    `| Ilustrace Openverse | ${coverage.illustrationOpenverse} |`,
    `| — place-specific | ${coverage.illustrationPlaceSpecific} |`,
    `| — sdílené podle dish key | ${coverage.illustrationSharedByDish} |`,
    `| Bez fotografie | ${coverage.missingDetailPhoto} |`,
    `| Vyžadují atribuci | ${coverage.requiringAttribution} |`,
    `| Neověřená licence | ${coverage.unverifiedLicenses} |`,
    `| Pokrytí (má fotku) | ${coverage.coveragePct} % |`,
    '',
    '> Pokrytí ≠ ověřená vizuální správnost. Kvalita: `restaurant-images-quality-audit.md`.',
    '',
    '## Podle kategorie',
    '',
    '| Kategorie | Celkem | Oficiální | Ilustrace | Chybí |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...Object.entries(byCategory)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([k, v]) => `| ${k} | ${v.total} | ${v.official} | ${v.illustration} | ${v.missing} |`),
    '',
  ].join('\n'),
  'utf8',
)

const uniqueManual = []
const seenManual = new Set()
for (const m of manualReview) {
  if (seenManual.has(m.id)) continue
  seenManual.add(m.id)
  uniqueManual.push(m)
}

const audit = {
  generatedAt: new Date().toISOString(),
  checkedPlaces: places.length,
  problemsFoundBefore: problemsBefore.length,
  assignmentsFixed: fixed.length,
  problemsRemainingAfter: problemsAfter.length,
  manualReviewCount: uniqueManual.length,
  chickenInn: (() => {
    const p = places.find((x) => x.id === 'chicken-inn-svobody')
    const row = state.placeRows['chicken-inn-svobody']
    const asset = state.dishAssets[row?.dishKey]
    return {
      id: 'chicken-inn-svobody',
      name: p?.name,
      category: p?.category,
      dishKey: row?.dishKey,
      dishSource: row?.dishSource,
      dish: asset?.dish,
      url: asset?.publicUrl,
      title: asset?.title,
      license: asset?.license,
    }
  })(),
  sampleFixed: fixed.slice(0, 40),
  problemsBeforeSample: problemsBefore.slice(0, 40),
  problemsAfterSample: problemsAfter.slice(0, 40),
  manualReviewSample: uniqueManual.slice(0, 40),
  dishAssetSummary: Object.fromEntries(
    Object.entries(state.dishAssets).map(([k, v]) => [
      k,
      { dish: v.dish, title: v.title, license: v.license, url: v.publicUrl, note: v.note || null },
    ]),
  ),
}

writeFileSync(AUDIT_JSON, JSON.stringify(audit, null, 2), 'utf8')
writeFileSync(
  AUDIT_MD,
  [
    '# Audit kvality přiřazení fotografií (detail)',
    '',
    `Vygenerováno: ${audit.generatedAt}`,
    '',
    'Automatická kontrola porovnává **název, popis, kategorii** s **dish key** a metadaty assetu.',
    'Neprovádí se vizuální kontrola všech 775 fotek člověkem — **neuvádíme 100% správnost**.',
    '',
    '## Souhrn',
    '',
    '| Metrika | Počet |',
    '| --- | ---: |',
    `| Zkontrolovaných podniků | ${audit.checkedPlaces} |`,
    `| Nalezených problémů před opravou | ${audit.problemsFoundBefore} |`,
    `| Opravených přiřazení (změna dish key) | ${audit.assignmentsFixed} |`,
    `| Problémů zbývajících po opravě (automaticky) | ${audit.problemsRemainingAfter} |`,
    `| K ruční kontrole | ${audit.manualReviewCount} |`,
    '',
    '## Chicken Inn nám. Svobody',
    '',
    `- ID: \`${audit.chickenInn.id}\``,
    `- Kategorie: ${audit.chickenInn.category}`,
    `- Dish key: **${audit.chickenInn.dishKey}** (${audit.chickenInn.dishSource})`,
    `- Jídlo: ${audit.chickenInn.dish}`,
    `- Asset: ${audit.chickenInn.title} (\`${audit.chickenInn.url}\`)`,
    `- Licence: ${audit.chickenInn.license}`,
    '',
    '## Pravidla (zkráceně)',
    '',
    '- Silný tip z názvu/id (Chicken Inn → smažené kuře, Sushi Mix → sushi, Bageterie → bageta) má přednost před kategorií.',
    '- OSM cuisine v popisu nepřebíjí kategorii (často multi-tag).',
    '- Obecný `fastfood` používá hranolky, ne pečivo.',
    '- Oficiální fotky se nepřepisují.',
    '- Nejisté případy jdou do ruční kontroly.',
    '',
    '## Ukázka oprav',
    '',
    ...fixed.slice(0, 25).map((f) => `- ${f.name} (\`${f.id}\`): \`${f.from}\` → \`${f.to}\` (${f.source})`),
    '',
    '## K ruční kontrole',
    '',
    ...(uniqueManual.length
      ? uniqueManual.slice(0, 30).map((m) => `- ${m.name} (\`${m.id}\`): ${m.reason}`)
      : ['- Žádné automaticky označené.']),
    '',
  ].join('\n'),
  'utf8',
)

console.log({
  checked: places.length,
  problemsBefore: problemsBefore.length,
  fixed: fixed.length,
  problemsAfter: problemsAfter.length,
  manualReview: uniqueManual.length,
  chickenInn: audit.chickenInn,
})
