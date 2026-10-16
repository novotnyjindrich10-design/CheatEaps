/**
 * Kompletní přeřazení ilustrací:
 * - všechny podniky bez oficiální fotky
 * - max 3 přiřazení stejného obrázku (podle Openverse ID / SHA souboru)
 * - pool unikátních Openverse fotek na dish key (resume + cache)
 *
 * node scripts/diversify-food-illustrations.mjs
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  copyFileSync,
  statSync,
} from 'fs'
import { createHash as cryptoHash } from 'crypto'
import { fileURLToPath } from 'url'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { placeFoodIllustrationsPilot } from '../src/data/placeFoodIllustrations.pilot.js'
import {
  DISH_SPECS,
  dishSpecForPlace,
  downloadFile,
  extOf,
  scoreResult,
  searchOpenverse,
  sleep,
  uniquePlaces,
  needsAttribution,
} from './lib/openverseFoodShared.mjs'

const MAX_USES = 3
const SHARED_DIR = new URL('../public/food-illustrations/shared/', import.meta.url)
const STATE_PATH = new URL('../reports/openverse-food-diversity-state.json', import.meta.url)
const BULK_STATE = new URL('../reports/openverse-food-bulk-state.json', import.meta.url)
const DATA_PATH = new URL('../src/data/placeFoodIllustrations.js', import.meta.url)
const REPORT_MD = new URL('../reports/restaurant-images-diversity-audit.md', import.meta.url)
const REPORT_JSON = new URL('../reports/restaurant-images-diversity-audit.json', import.meta.url)
const COVERAGE_MD = new URL('../reports/restaurant-images-coverage.md', import.meta.url)
const COVERAGE_JSON = new URL('../reports/restaurant-images-coverage.json', import.meta.url)
const QUALITY_MD = new URL('../reports/restaurant-images-quality-audit.md', import.meta.url)

const SEARCH_DELAY = 1300
const DOWNLOAD_DELAY = 200
const MAX_429 = 5

/** Extra dotazy pro větší diverzitu výsledků. */
const EXTRA_QUERIES = {
  kava: ['cappuccino cup food', 'espresso coffee dark', 'latte art coffee', 'black coffee mug', 'coffee beans cup'],
  neuvedeno: ['grilled chicken plate food', 'roast dinner plate', 'rice bowl meal', 'steak fries plate', 'fish and chips food'],
  ceske: [
    'pork roast dumpling',
    'schnitzel potato food',
    'beef goulash bowl',
    'czech dumplings food',
    'roast pork cabbage',
    'wiener schnitzel food',
    'pork knuckle food',
    'svickova food',
    'cabbage roll food',
    'potato dumpling food',
    'roast goose food',
    'beef stew dumplings',
  ],
  asijske: ['pad thai noodles', 'asian rice bowl', 'stir fry vegetables', 'miso soup bowl', 'dumpling asian food'],
  pizza: ['pepperoni pizza food', 'neapolitan pizza', 'cheese pizza slice', 'wood fired pizza'],
  sladke: ['chocolate cake slice', 'croissant pastry', 'ice cream dessert', 'fruit tart dessert', 'cupcake frosting'],
  fastfood: ['french fries ketchup', 'onion rings food', 'hot dog food', 'chicken nuggets fries'],
  burger: ['cheeseburger fries', 'smash burger food', 'bacon burger plate', 'double cheeseburger'],
  kebab: ['shawarma plate food', 'doner kebab wrap', 'gyro meat pita', 'falafel wrap food'],
  cina: ['fried rice chinese', 'spring rolls food', 'sweet sour chicken', 'chow mein noodles'],
  mexiko: ['burrito plate food', 'guacamole nachos', 'quesadilla food', 'enchilada plate'],
  sushi: ['sushi roll platter', 'sashimi plate food', 'maki sushi food'],
  zdrave: ['quinoa salad bowl', 'avocado toast healthy', 'green smoothie bowl'],
  pho: ['pho beef noodles', 'vietnamese pho bowl'],
  fried_chicken: ['fried chicken bucket', 'crispy fried chicken meal'],
  ramen: ['tonkotsu ramen bowl', 'shoyu ramen noodles'],
  baguette: ['subway sandwich food', 'baguette sandwich filling'],
  vegetarianske: ['dal curry bowl', 'paneer tikka food'],
  veganske: ['vegan buddha bowl', 'tofu stir fry'],
}

mkdirSync(SHARED_DIR, { recursive: true })

function toFs(url) {
  return fileURLToPath(url)
}

function fileOk(pathOrUrl) {
  try {
    const p = typeof pathOrUrl === 'string' ? pathOrUrl : toFs(pathOrUrl)
    return existsSync(p) && statSync(p).size > 1000
  } catch {
    return false
  }
}

function sha12(filePath) {
  const buf = readFileSync(filePath)
  return cryptoHash('sha256').update(buf).digest('hex').slice(0, 16)
}

function hasOfficial(id) {
  const p = placePhotos[id]
  return Boolean(p?.heroImageKind === 'official' && p?.heroImageUrl)
}

function loadState() {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
  return {
    version: 1,
    pools: {}, // dishKey -> [{openverseId, publicUrl, ...}]
    queryCache: {},
    placeAssignment: {}, // placeId -> { assetId, dishKey, variant }
    usage: {}, // openverseId -> count
    updatedAt: null,
  }
}

function saveState(state) {
  state.updatedAt = new Date().toISOString()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

function normalizeResult(r) {
  return {
    id: r.id,
    title: r.title || '',
    license: r.license,
    license_url: r.license_url || '',
    creator: r.creator || '',
    creator_url: r.creator_url || '',
    foreign_landing_url: r.foreign_landing_url || '',
    attribution: r.attribution || '',
    url: r.url,
    filetype: r.filetype,
    width: r.width,
    height: r.height,
    mature: r.mature,
    tags: r.tags || [],
  }
}

async function searchWithRetry(query, page) {
  let attempt = 0
  for (;;) {
    try {
      await sleep(SEARCH_DELAY)
      return await searchOpenverse(query, { pageSize: 20, page })
    } catch (err) {
      if (err.code === 'RATE_LIMIT' && attempt < MAX_429) {
        attempt += 1
        const wait = 6000 * attempt
        console.warn(`429 ${query} p${page} – wait ${wait}ms`)
        await sleep(wait)
        continue
      }
      throw err
    }
  }
}

function globalIdsAndShas(state) {
  const ids = new Set()
  const shas = new Set()
  for (const pool of Object.values(state.pools || {})) {
    for (const a of pool) {
      if (a.openverseId) ids.add(a.openverseId)
      if (a.sha) shas.add(a.sha)
    }
  }
  return { ids, shas }
}

function seedExistingIntoPools(state) {
  const global = globalIdsAndShas(state)

  // From bulk state
  if (existsSync(BULK_STATE)) {
    const bulk = JSON.parse(readFileSync(BULK_STATE, 'utf8'))
    for (const [key, asset] of Object.entries(bulk.dishAssets || {})) {
      if (!asset?.openverseId || !asset.publicUrl) continue
      if (global.ids.has(asset.openverseId)) continue
      const local = new URL(`../public${asset.publicUrl}`, import.meta.url)
      if (!fileOk(local)) continue
      const sha = sha12(toFs(local))
      if (global.shas.has(sha)) continue
      if (!state.pools[key]) state.pools[key] = []
      state.pools[key].push({
        openverseId: asset.openverseId,
        dish: asset.dish || DISH_SPECS[key]?.dish || key,
        license: asset.license,
        licenseUrl: asset.licenseUrl || '',
        creator: asset.creator || '',
        creatorUrl: asset.creatorUrl || '',
        sourceUrl: asset.sourceUrl || '',
        attribution: asset.attribution || '',
        originalUrl: asset.originalUrl || '',
        publicUrl: asset.publicUrl,
        title: asset.title || '',
        sha,
        seeded: true,
      })
      global.ids.add(asset.openverseId)
      global.shas.add(sha)
    }
  }

  // Pilot place-specific → seed by dishSpec of that place
  for (const [id, rec] of Object.entries(placeFoodIllustrationsPilot)) {
    if (!rec.foodIllustrationOpenverseId || !rec.foodIllustrationUrl) continue
    if (global.ids.has(rec.foodIllustrationOpenverseId)) continue
    const local = new URL(`../public${rec.foodIllustrationUrl}`, import.meta.url)
    if (!fileOk(local)) continue
    const place = places.find((p) => p.id === id)
    const key = place ? dishSpecForPlace(place).key : 'neuvedeno'
    const ext = extOf(rec.foodIllustrationOriginalUrl || rec.foodIllustrationUrl, 'jpg')
    const sharedName = `${key}-${rec.foodIllustrationOpenverseId.slice(0, 8)}.${ext}`
    const sharedLocal = new URL(sharedName, SHARED_DIR)
    const publicUrl = `/food-illustrations/shared/${sharedName}`
    if (!fileOk(sharedLocal)) {
      try {
        copyFileSync(toFs(local), toFs(sharedLocal))
      } catch {
        continue
      }
    }
    const sha = sha12(toFs(sharedLocal))
    if (global.shas.has(sha)) continue
    if (!state.pools[key]) state.pools[key] = []
    state.pools[key].push({
      openverseId: rec.foodIllustrationOpenverseId,
      dish: rec.foodIllustrationDish || DISH_SPECS[key]?.dish || key,
      license: rec.foodIllustrationLicense,
      licenseUrl: rec.foodIllustrationLicenseUrl || '',
      creator: rec.foodIllustrationCreator || '',
      creatorUrl: rec.foodIllustrationCreatorUrl || '',
      sourceUrl: rec.foodIllustrationSourceUrl || '',
      attribution: rec.foodIllustrationAttribution || '',
      originalUrl: rec.foodIllustrationOriginalUrl || '',
      publicUrl,
      title: '',
      sha,
      seededFromPilot: id,
    })
    global.ids.add(rec.foodIllustrationOpenverseId)
    global.shas.add(sha)
  }
}

async function fillPool(state, dishKey, needed) {
  const spec = DISH_SPECS[dishKey]
  if (!spec) return
  if (!state.pools[dishKey]) state.pools[dishKey] = []

  const have = () => dedupePool(state.pools[dishKey]).length

  if (have() >= needed) return

  const queries = [spec.query, ...(spec.fallbacks || []), ...(EXTRA_QUERIES[dishKey] || [])]
  const global = globalIdsAndShas(state)
  const seenIds = new Set([...global.ids])

  for (const query of queries) {
    if (have() >= needed) break
    for (let page = 1; page <= 8; page += 1) {
      if (have() >= needed) break
      const cacheKey = `${query}::${page}`
      let pageData = state.queryCache[cacheKey]
      if (!pageData) {
        console.log(`search [${dishKey}] ${query} p${page}`)
        try {
          const res = await searchWithRetry(query, page)
          pageData = {
            results: (res.results || []).map(normalizeResult),
            pageCount: res.pageCount,
          }
        } catch (err) {
          console.warn(`search fail [${dishKey}] ${query} p${page}:`, err.message)
          pageData = { results: [], pageCount: 0 }
        }
        state.queryCache[cacheKey] = pageData
        saveState(state)
      }

      const minScore = have() < needed * 0.6 ? 1 : 2
      const ranked = pageData.results
        .map((item) => ({ item, score: scoreResult(item, spec.keywords) }))
        .filter((row) => row.score >= minScore && !seenIds.has(row.item.id))
        .sort((a, b) => b.score - a.score)

      for (const { item, score } of ranked) {
        if (have() >= needed) break
        if (seenIds.has(item.id)) continue
        const ext = extOf(item.url, item.filetype)
        const sharedName = `${dishKey}-${item.id.slice(0, 8)}.${ext}`
        const sharedLocal = new URL(sharedName, SHARED_DIR)
        const publicUrl = `/food-illustrations/shared/${sharedName}`
        if (!fileOk(sharedLocal)) {
          try {
            await sleep(DOWNLOAD_DELAY)
            console.log(`download [${dishKey}] ${item.title || item.id}`)
            await downloadFile(item.url, toFs(sharedLocal))
          } catch (err) {
            console.warn(`dl fail ${item.id}:`, err.message)
            seenIds.add(item.id) // don't retry endlessly
            continue
          }
        }
        if (!fileOk(sharedLocal)) continue
        const sha = sha12(toFs(sharedLocal))
        if (global.shas.has(sha) || state.pools[dishKey].some((a) => a.sha === sha)) {
          seenIds.add(item.id)
          continue
        }
        seenIds.add(item.id)
        global.ids.add(item.id)
        global.shas.add(sha)
        state.pools[dishKey].push({
          openverseId: item.id,
          dish: spec.dish,
          license: item.license,
          licenseUrl: item.license_url,
          creator: item.creator,
          creatorUrl: item.creator_url,
          sourceUrl: item.foreign_landing_url,
          attribution: item.attribution,
          originalUrl: item.url,
          publicUrl,
          title: item.title,
          score,
          sha,
        })
        saveState(state)
      }

      if ((pageData.pageCount || 1) <= page) break
    }
  }

  console.log(`pool [${dishKey}] ${have()}/${needed}`)
}

function dedupePool(pool) {
  const out = []
  const ids = new Set()
  const shas = new Set()
  for (const a of pool) {
    if (ids.has(a.openverseId)) continue
    if (a.sha && shas.has(a.sha)) continue
    ids.add(a.openverseId)
    if (a.sha) shas.add(a.sha)
    out.push(a)
  }
  return out
}

function assignPlaces(state, placesByKey) {
  const usage = {} // openverseId -> count
  const shaUsage = {}
  const assignment = {}
  const unmet = []
  const overCapFallback = []

  for (const [dishKey, list] of Object.entries(placesByKey)) {
    const pool = dedupePool(state.pools[dishKey] || [])
    state.pools[dishKey] = pool
    if (pool.length === 0) {
      for (const p of list) unmet.push({ id: p.id, name: p.name, dishKey, reason: 'prázdný pool' })
      continue
    }

    // Round-robin, skip assets already at MAX_USES globally
    let cursor = 0
    for (const place of list) {
      let placed = false
      for (let attempt = 0; attempt < pool.length; attempt += 1) {
        const asset = pool[(cursor + attempt) % pool.length]
        const u = usage[asset.openverseId] || 0
        const su = asset.sha ? shaUsage[asset.sha] || 0 : 0
        if (u >= MAX_USES || su >= MAX_USES) continue
        usage[asset.openverseId] = u + 1
        if (asset.sha) shaUsage[asset.sha] = su + 1
        assignment[place.id] = {
          dishKey,
          openverseId: asset.openverseId,
          variantKey: `${dishKey}__${pool.indexOf(asset)}`,
          publicUrl: asset.publicUrl,
          dishSource: dishSpecForPlace(place).source,
        }
        cursor = (cursor + attempt + 1) % pool.length
        placed = true
        break
      }
      if (!placed) {
        // Soft fallback: use least-used asset and flag exception
        let best = pool[0]
        let bestU = usage[best.openverseId] || 0
        for (const a of pool) {
          const u = usage[a.openverseId] || 0
          if (u < bestU) {
            best = a
            bestU = u
          }
        }
        usage[best.openverseId] = bestU + 1
        if (best.sha) shaUsage[best.sha] = (shaUsage[best.sha] || 0) + 1
        assignment[place.id] = {
          dishKey,
          openverseId: best.openverseId,
          variantKey: `${dishKey}__${pool.indexOf(best)}`,
          publicUrl: best.publicUrl,
          dishSource: dishSpecForPlace(place).source,
          exceededCap: true,
        }
        overCapFallback.push({
          id: place.id,
          name: place.name,
          dishKey,
          openverseId: best.openverseId,
          uses: usage[best.openverseId],
          reason: `Nedostatek unikátních legálních fotek pro ${dishKey}; překročen limit ${MAX_USES}.`,
        })
      }
    }
  }

  state.placeAssignment = assignment
  state.usage = usage
  state.shaUsage = shaUsage
  return { unmet, overCapFallback }
}

function writeDataFile(state) {
  const shared = {}
  for (const [dishKey, pool] of Object.entries(state.pools)) {
    pool.forEach((asset, idx) => {
      const vk = `${dishKey}__${idx}`
      shared[vk] = {
        foodIllustrationKind: 'openverse',
        foodIllustrationUrl: asset.publicUrl,
        foodIllustrationDish: asset.dish || DISH_SPECS[dishKey]?.dish || dishKey,
        foodIllustrationLicense: asset.license || '',
        foodIllustrationLicenseUrl: asset.licenseUrl || '',
        foodIllustrationCreator: asset.creator || '',
        foodIllustrationCreatorUrl: asset.creatorUrl || '',
        foodIllustrationSourceUrl: asset.sourceUrl || '',
        foodIllustrationOpenverseId: asset.openverseId,
        foodIllustrationAttribution: asset.attribution || '',
        foodIllustrationOriginalUrl: asset.originalUrl || '',
        foodIllustrationSharedKey: vk,
        foodIllustrationDishKey: dishKey,
      }
    })
  }

  // Place-specific: only keep pilot when unique and within cap for that openverse id
  // After diversify we assign everyone via variant keys; pilot records become optional overrides
  // only if assignment points to same file. Simpler: no place-specific layer — all via shared variants.
  const placeSpecific = {}
  const placeDishKey = {}
  for (const [placeId, row] of Object.entries(state.placeAssignment)) {
    placeDishKey[placeId] = row.variantKey
  }

  const body = `/** Ilustrace jídel z Openverse (diverzifikované, max ${MAX_USES}×). Regeneruj: node scripts/diversify-food-illustrations.mjs */
export const placeFoodIllustrationShared = ${JSON.stringify(shared, null, 2)}

export const placeFoodIllustrationDishKey = ${JSON.stringify(placeDishKey, null, 2)}

export const placeFoodIllustrationsPlaceSpecific = ${JSON.stringify(placeSpecific, null, 2)}

export function getPlaceFoodIllustration(placeId) {
  if (placeFoodIllustrationsPlaceSpecific[placeId]) {
    return placeFoodIllustrationsPlaceSpecific[placeId]
  }
  const key = placeFoodIllustrationDishKey[placeId]
  if (!key) return null
  return placeFoodIllustrationShared[key] || null
}

export const placeFoodIllustrations = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined
      if (prop === '__esModule') return false
      return getPlaceFoodIllustration(prop) || undefined
    },
    has(_t, prop) {
      return Boolean(getPlaceFoodIllustration(prop))
    },
    ownKeys() {
      return [
        ...Object.keys(placeFoodIllustrationsPlaceSpecific),
        ...Object.keys(placeFoodIllustrationDishKey),
      ]
    },
    getOwnPropertyDescriptor(_t, prop) {
      const value = getPlaceFoodIllustration(prop)
      if (!value) return undefined
      return { configurable: true, enumerable: true, value }
    },
  },
)
`
  writeFileSync(DATA_PATH, body, 'utf8')
  return { sharedCount: Object.keys(shared).length, mapped: Object.keys(placeDishKey).length }
}

const places = uniquePlaces(curatedPlaces, osmPlaces)
const state = loadState()
seedExistingIntoPools(state)
saveState(state)

const placesByKey = {}
let officialCount = 0
for (const place of places) {
  if (hasOfficial(place.id)) {
    officialCount += 1
    continue
  }
  const spec = dishSpecForPlace(place)
  if (!placesByKey[spec.key]) placesByKey[spec.key] = []
  placesByKey[spec.key].push(place)
}

console.log({
  places: places.length,
  official: officialCount,
  toIllustrate: places.length - officialCount,
  byKey: Object.fromEntries(Object.entries(placesByKey).map(([k, v]) => [k, v.length])),
})

// Fill pools
for (const [dishKey, list] of Object.entries(placesByKey)) {
  const needed = Math.ceil(list.length / MAX_USES)
  await fillPool(state, dishKey, needed)
}
saveState(state)

const { unmet, overCapFallback } = assignPlaces(state, placesByKey)
saveState(state)
const written = writeDataFile(state)

// Usage stats
const usageEntries = Object.entries(state.usage || {}).sort((a, b) => b[1] - a[1])
const overMax = usageEntries.filter(([, c]) => c > MAX_USES)
const atMax = usageEntries.filter(([, c]) => c === MAX_USES)

const poolSizes = Object.fromEntries(
  Object.entries(state.pools).map(([k, v]) => [k, dedupePool(v).length]),
)

const report = {
  generatedAt: new Date().toISOString(),
  totalPlaces: places.length,
  officialKept: officialCount,
  illustrated: written.mapped,
  missingIllustration: unmet.length,
  uniqueIllustrationAssets: usageEntries.length,
  maxUsesRule: MAX_USES,
  imagesAtMaxUses: atMax.length,
  imagesOverMaxUses: overMax.length,
  overCapFallbackCount: overCapFallback.length,
  poolSizes,
  neededVsHave: Object.fromEntries(
    Object.entries(placesByKey).map(([k, list]) => [
      k,
      { places: list.length, needed: Math.ceil(list.length / MAX_USES), have: poolSizes[k] || 0 },
    ]),
  ),
  unmetSample: unmet.slice(0, 40),
  overCapSample: overCapFallback.slice(0, 40),
  topUsed: usageEntries.slice(0, 30).map(([id, c]) => ({ openverseId: id, uses: c })),
  verificationNote:
    'Tematická shoda: scoring Openverse title/tags + dish rules. Plná vizuální kontrola všech fotek člověkem neproběhla; tvrzení o 100% vizuální správnosti neuvádíme.',
  visualSpotChecks: 'Spot-check nových assetů probíhá samostatně po běhu (viz report / agent log).',
}

writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8')
writeFileSync(
  REPORT_MD,
  [
    '# Audit diverzity a přiřazení ilustrací',
    '',
    `Vygenerováno: ${report.generatedAt}`,
    '',
    `Pravidlo: maximálně **${MAX_USES}** přiřazení stejného ilustračního obrázku (Openverse ID / SHA souboru).`,
    '',
    '## Souhrn',
    '',
    '| Metrika | Počet |',
    '| --- | ---: |',
    `| Podniků celkem | ${report.totalPlaces} |`,
    `| Oficiální fotky (ponechány) | ${report.officialKept} |`,
    `| S ilustrací | ${report.illustrated} |`,
    `| Bez ilustrace (fallback SVG) | ${report.missingIllustration} |`,
    `| Unikátních ilustračních assetů | ${report.uniqueIllustrationAssets} |`,
    `| Assetů na limitu ${MAX_USES}× | ${report.imagesAtMaxUses} |`,
    `| Assetů nad limitem ${MAX_USES}× | ${report.imagesOverMaxUses} |`,
    `| Výjimky (nelze nahradit – překročen limit) | ${report.overCapFallbackCount} |`,
    '',
    '## Potřeba vs dostupný pool',
    '',
    '| Dish key | Podniků | Potřeba (≥ ceil(n/3)) | Máme |',
    '| --- | ---: | ---: | ---: |',
    ...Object.entries(report.neededVsHave)
      .sort((a, b) => b[1].places - a[1].places)
      .map(([k, v]) => `| ${k} | ${v.places} | ${v.needed} | ${v.have} |`),
    '',
    '## Výjimky nad limitem 3',
    '',
    ...(overCapFallback.length
      ? overCapFallback
          .slice(0, 50)
          .map((x) => `- ${x.name} (\`${x.id}\`): ${x.dishKey}, uses=${x.uses} — ${x.reason}`)
      : ['- Žádné.']),
    '',
    '## Bez vhodné fotky',
    '',
    ...(unmet.length ? unmet.map((x) => `- ${x.name} (\`${x.id}\`): ${x.reason}`) : ['- Žádné.']),
    '',
    '## Ověření',
    '',
    `- ${report.verificationNote}`,
    '',
  ].join('\n'),
  'utf8',
)

// Refresh coverage summary
const coverage = {
  generatedAt: report.generatedAt,
  totalPlaces: places.length,
  withDetailPhoto: officialCount + written.mapped,
  officialVerified: officialCount,
  illustrationOpenverse: written.mapped,
  missingDetailPhoto: places.length - officialCount - written.mapped,
  uniqueIllustrationAssets: usageEntries.length,
  maxIllustrationReuse: MAX_USES,
  imagesOverReuseCap: overMax.length,
  coveragePct: Number((((officialCount + written.mapped) / places.length) * 100).toFixed(1)),
  notes: {
    official: 'Oficiální fotky z placePhotos – nepřepisují se.',
    illustration: `Openverse CC0/PDM/BY/BY-SA; max ${MAX_USES}× stejný obrázek.`,
    quality: 'Viz restaurant-images-diversity-audit.md a restaurant-images-quality-audit.md.',
  },
}
writeFileSync(COVERAGE_JSON, JSON.stringify(coverage, null, 2), 'utf8')
writeFileSync(
  COVERAGE_MD,
  [
    '# Pokrytí fotografií podniků (detail)',
    '',
    `Vygenerováno: ${coverage.generatedAt}`,
    '',
    '| Metrika | Počet |',
    '| --- | ---: |',
    `| Podniků celkem | ${coverage.totalPlaces} |`,
    `| S fotografií na detailu | ${coverage.withDetailPhoto} |`,
    `| Oficiální | ${coverage.officialVerified} |`,
    `| Ilustrace Openverse | ${coverage.illustrationOpenverse} |`,
    `| Bez fotografie | ${coverage.missingDetailPhoto} |`,
    `| Unikátních ilustrací | ${coverage.uniqueIllustrationAssets} |`,
    `| Max. opakování ilustrace | ${coverage.maxIllustrationReuse} |`,
    `| Ilustrací nad limitem opakování | ${coverage.imagesOverReuseCap} |`,
    `| Pokrytí (má fotku) | ${coverage.coveragePct} % |`,
    '',
    '> Pokrytí ≠ 100% vizuální správnost. Diverzita a výjimky: `restaurant-images-diversity-audit.md`.',
    '',
  ].join('\n'),
  'utf8',
)

// Append note to quality audit
if (existsSync(QUALITY_MD)) {
  const prev = readFileSync(QUALITY_MD, 'utf8')
  if (!prev.includes('diverzifikace ilustrací')) {
    writeFileSync(
      QUALITY_MD,
      prev.trimEnd() +
        `\n\n## Aktualizace diverzity (${report.generatedAt})\n\n` +
        `Spuštěna diverzifikace: max ${MAX_USES}× stejný obrázek. Unikátních assetů: ${usageEntries.length}. ` +
        `Výjimky nad limitem: ${overCapFallback.length}. Detail: \`restaurant-images-diversity-audit.md\`.\n`,
      'utf8',
    )
  }
}

console.log({
  written: written.mapped,
  uniqueAssets: usageEntries.length,
  overMax: overMax.length,
  unmet: unmet.length,
  overCap: overCapFallback.length,
  pools: poolSizes,
})
