/**
 * Po opravě kategorií znovu přiřadí ilustrace (max 3×),
 * doplní nové dish keys (pasta, poke, bubble_tea, indian, vietnamese)
 * a odstraní ilustrace u illustrationRemovals.
 *
 * node scripts/upgrade-food-illustrations.mjs
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
} from 'fs'
import { createHash as cryptoHash } from 'crypto'
import { fileURLToPath } from 'url'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { categoryOverrides, illustrationRemovals } from '../src/data/categoryOverrides.js'
import {
  DISH_SPECS,
  PLACE_DISH_OVERRIDES,
  dishSpecForPlace,
  downloadFile,
  extOf,
  scoreResult,
  searchOpenverse,
  sleep,
  uniquePlaces,
} from './lib/openverseFoodShared.mjs'

const MAX_USES = 3
const SHARED_DIR = new URL('../public/food-illustrations/shared/', import.meta.url)
const STATE_PATH = new URL('../reports/openverse-food-diversity-state.json', import.meta.url)
const DATA_PATH = new URL('../src/data/placeFoodIllustrations.js', import.meta.url)
const REPORT_MD = new URL('../reports/restaurant-images-diversity-audit.md', import.meta.url)
const REPORT_JSON = new URL('../reports/restaurant-images-diversity-audit.json', import.meta.url)
const COVERAGE_MD = new URL('../reports/restaurant-images-coverage.md', import.meta.url)
const COVERAGE_JSON = new URL('../reports/restaurant-images-coverage.json', import.meta.url)
const QUALITY_MD = new URL('../reports/restaurant-images-quality-audit.md', import.meta.url)
const QUALITY_JSON = new URL('../reports/restaurant-images-quality-audit.json', import.meta.url)

const SEARCH_DELAY = 1300
const DOWNLOAD_DELAY = 250
const MAX_429 = 6
const MIN_WIDTH = 900

const EXTRA_QUERIES = {
  kava: ['cappuccino cup food', 'latte art coffee', 'espresso coffee dark', 'flat white coffee cup'],
  bubble_tea: ['bubble tea drink tapioca', 'boba milk tea cup', 'brown sugar bubble tea'],
  pasta: ['spaghetti bolognese close up', 'pasta carbonara plate', 'tagliatelle pasta food', 'penne pasta tomato'],
  poke: ['poke bowl salmon avocado', 'ahi tuna poke bowl', 'hawaiian poke rice bowl'],
  indian: ['butter chicken curry', 'chicken tikka masala rice', 'indian curry naan food'],
  vietnamese: ['pho noodle soup bowl', 'vietnamese bun cha', 'banh mi sandwich food'],
  ceske: [
    'svickova cream dumplings',
    'wiener schnitzel potato',
    'beef goulash dumplings',
    'roast pork cabbage dumpling',
    'pork knuckle food',
    'czech dumplings food',
  ],
  asijske: ['pad thai noodles plate', 'asian stir fry bowl', 'rice bowl asian food', 'gyoza dumplings food'],
  pizza: ['neapolitan pizza food', 'margherita pizza closeup', 'pepperoni pizza slice'],
  kebab: ['doner kebab wrap', 'shawarma pita food', 'gyro sandwich plate'],
  burger: ['smash burger food', 'cheeseburger close up', 'bacon cheeseburger plate'],
  cina: ['kung pao chicken rice', 'chinese stir fry noodles', 'sweet and sour chicken'],
  fastfood: ['chicken nuggets fries', 'onion rings food', 'hot dog fries plate'],
  sladke: ['chocolate cake slice', 'fruit tart dessert', 'croissant pastry food'],
  neuvedeno: ['grilled chicken plate food', 'roast dinner plate food', 'steak fries plate'],
  sushi: ['nigiri sushi platter', 'sushi roll plate food'],
  ramen: ['tonkotsu ramen bowl', 'shoyu ramen noodles'],
  pho: ['pho beef noodles bowl'],
  fried_chicken: ['fried chicken strips plate', 'crispy fried chicken meal'],
  mexiko: ['tacos mexican food', 'burrito plate food'],
  zdrave: ['salad bowl vegetables', 'quinoa salad bowl'],
  baguette: ['baguette sandwich filling'],
  vegetarianske: ['vegetable curry rice'],
  veganske: ['vegan buddha bowl'],
}

/** Dish keys, u kterých chceme aktivně hledat lepší fotky. */
const REFRESH_KEYS = new Set([
  'asijske',
  'ceske',
  'fastfood',
  'kebab',
  'kava',
  'pizza',
  'burger',
  'cina',
  'pasta',
  'poke',
  'bubble_tea',
  'indian',
  'vietnamese',
  'neuvedeno',
  'sladke',
])

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
  return cryptoHash('sha256').update(readFileSync(filePath)).digest('hex').slice(0, 16)
}

function hasOfficial(id) {
  const p = placePhotos[id]
  return Boolean(p?.heroImageKind === 'official' && p?.heroImageUrl)
}

function withCategoryOverrides(places) {
  return places.map((place) => {
    const override = categoryOverrides[place.id]
    if (!override) return place
    return {
      ...place,
      category: override.category,
      type: override.type || place.type,
    }
  })
}

function loadState() {
  if (existsSync(STATE_PATH)) return JSON.parse(readFileSync(STATE_PATH, 'utf8'))
  return { version: 1, pools: {}, queryCache: {}, placeAssignment: {}, usage: {}, updatedAt: null }
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
        const wait = 7000 * attempt
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

function dedupePool(pool) {
  const seen = new Set()
  const out = []
  for (const a of pool || []) {
    const key = a.openverseId || a.sha || a.publicUrl
    if (!key || seen.has(key)) continue
    if (!fileOk(new URL(`../public${a.publicUrl}`, import.meta.url))) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

function seedCurrentDataIntoPools(state) {
  const dataPath = toFs(DATA_PATH)
  if (!existsSync(dataPath)) return
  const text = readFileSync(dataPath, 'utf8')
  const sharedMatch = text.match(/export const placeFoodIllustrationShared = (\{[\s\S]*?\n\})\n\nexport const placeFoodIllustrationDishKey/)
  if (!sharedMatch) return
  const shared = JSON.parse(sharedMatch[1])
  const global = globalIdsAndShas(state)
  for (const rec of Object.values(shared)) {
    if (!rec.foodIllustrationOpenverseId || !rec.foodIllustrationUrl) continue
    if (global.ids.has(rec.foodIllustrationOpenverseId)) continue
    const local = new URL(`../public${rec.foodIllustrationUrl}`, import.meta.url)
    if (!fileOk(local)) continue
    const sha = sha12(toFs(local))
    if (global.shas.has(sha)) continue
    const key = rec.foodIllustrationDishKey || 'neuvedeno'
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
      publicUrl: rec.foodIllustrationUrl,
      title: '',
      sha,
      seededFromData: true,
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
    for (let page = 1; page <= 6; page += 1) {
      if (have() >= needed) break
      const cacheKey = `upgrade::${query}::${page}`
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

      const minScore = have() < needed * 0.5 ? 1 : 2
      const ranked = pageData.results
        .map((item) => ({ item, score: scoreResult(item, spec.keywords) }))
        .filter((row) => {
          if (row.score < minScore || seenIds.has(row.item.id)) return false
          if (row.item.width && row.item.width < MIN_WIDTH) return false
          return true
        })
        .sort((a, b) => b.score - a.score || (b.item.width || 0) - (a.item.width || 0))

      for (const { item } of ranked) {
        if (have() >= needed) break
        if (seenIds.has(item.id)) continue
        const ext = extOf(item.url, item.filetype)
        const sharedName = `${dishKey}-${item.id.slice(0, 8)}.${ext}`
        const sharedLocal = new URL(sharedName, SHARED_DIR)
        const publicUrl = `/food-illustrations/shared/${sharedName}`
        try {
          if (!fileOk(sharedLocal)) {
            await sleep(DOWNLOAD_DELAY)
            await downloadFile(item.url, toFs(sharedLocal))
          }
          if (!fileOk(sharedLocal)) continue
          const sha = sha12(toFs(sharedLocal))
          if (global.shas.has(sha)) {
            seenIds.add(item.id)
            continue
          }
          state.pools[dishKey].push({
            openverseId: item.id,
            dish: spec.dish,
            license: item.license,
            licenseUrl: item.license_url || '',
            creator: item.creator || '',
            creatorUrl: item.creator_url || '',
            sourceUrl: item.foreign_landing_url || '',
            attribution: item.attribution || '',
            originalUrl: item.url,
            publicUrl,
            title: item.title || '',
            sha,
            width: item.width || 0,
            upgraded: true,
          })
          seenIds.add(item.id)
          global.ids.add(item.id)
          global.shas.add(sha)
          console.log(`+ [${dishKey}] ${item.id.slice(0, 8)} score ok w=${item.width || '?'}`)
          saveState(state)
        } catch (err) {
          console.warn(`download fail ${item.id}:`, err.message)
        }
      }
    }
  }
  state.pools[dishKey] = dedupePool(state.pools[dishKey])
}

function assignPlaces(state, placesByKey) {
  const assignment = {}
  const usage = {}
  const shaUsage = {}
  const unmet = []
  const overCapFallback = []

  for (const [dishKey, list] of Object.entries(placesByKey)) {
    const pool = dedupePool(state.pools[dishKey] || [])
    state.pools[dishKey] = pool
    // Prefer newer upgraded assets, then unused
    pool.sort((a, b) => Number(Boolean(b.upgraded)) - Number(Boolean(a.upgraded)) || (b.width || 0) - (a.width || 0))

    for (const place of list) {
      let chosen = null
      for (const asset of pool) {
        const u = usage[asset.openverseId] || 0
        const su = asset.sha ? shaUsage[asset.sha] || 0 : 0
        if (u < MAX_USES && su < MAX_USES) {
          chosen = asset
          break
        }
      }
      if (chosen) {
        usage[chosen.openverseId] = (usage[chosen.openverseId] || 0) + 1
        if (chosen.sha) shaUsage[chosen.sha] = (shaUsage[chosen.sha] || 0) + 1
        assignment[place.id] = {
          dishKey,
          openverseId: chosen.openverseId,
          variantKey: `${dishKey}__${pool.indexOf(chosen)}`,
          publicUrl: chosen.publicUrl,
          dishSource: dishSpecForPlace(place).source,
        }
      } else if (pool[0]) {
        const best = pool.reduce((a, b) => ((usage[a.openverseId] || 0) <= (usage[b.openverseId] || 0) ? a : b))
        usage[best.openverseId] = (usage[best.openverseId] || 0) + 1
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
      } else {
        unmet.push({
          id: place.id,
          name: place.name,
          reason: `Žádný Openverse asset pro dish key ${dishKey}`,
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
    dedupePool(pool).forEach((asset, idx) => {
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

  // Rebuild variant keys after dedupe order
  const byIdAsset = new Map()
  for (const [vk, rec] of Object.entries(shared)) {
    byIdAsset.set(rec.foodIllustrationOpenverseId, vk)
  }
  const placeDishKey = {}
  for (const [placeId, row] of Object.entries(state.placeAssignment)) {
    if (illustrationRemovals.includes(placeId)) continue
    const vk = byIdAsset.get(row.openverseId)
    if (vk) placeDishKey[placeId] = vk
  }

  const body = `/** Ilustrace jídel z Openverse (diverzifikované, max ${MAX_USES}×). Regeneruj: node scripts/upgrade-food-illustrations.mjs */
export const placeFoodIllustrationShared = ${JSON.stringify(shared, null, 2)}

export const placeFoodIllustrationDishKey = ${JSON.stringify(placeDishKey, null, 2)}

export const placeFoodIllustrationsPlaceSpecific = {}

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

const basePlaces = withCategoryOverrides(uniquePlaces(curatedPlaces, osmPlaces))
const places = basePlaces.filter((p) => !illustrationRemovals.includes(p.id))
const state = loadState()
seedCurrentDataIntoPools(state)
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
  places: basePlaces.length,
  removedIllustration: illustrationRemovals.length,
  official: officialCount,
  toIllustrate: places.length - officialCount,
  byKey: Object.fromEntries(Object.entries(placesByKey).map(([k, v]) => [k, v.length])),
})

for (const [dishKey, list] of Object.entries(placesByKey)) {
  const needed = Math.ceil(list.length / MAX_USES)
  if (REFRESH_KEYS.has(dishKey) || (state.pools[dishKey] || []).length < needed) {
    await fillPool(state, dishKey, needed)
  }
}
saveState(state)

const { unmet, overCapFallback } = assignPlaces(state, placesByKey)
saveState(state)
const written = writeDataFile(state)

const usageEntries = Object.entries(state.usage || {}).sort((a, b) => b[1] - a[1])
const overMax = usageEntries.filter(([, c]) => c > MAX_USES)
const atMax = usageEntries.filter(([, c]) => c === MAX_USES)
const poolSizes = Object.fromEntries(
  Object.entries(state.pools).map(([k, v]) => [k, dedupePool(v).length]),
)

const generatedAt = new Date().toISOString()
const report = {
  generatedAt,
  totalPlaces: basePlaces.length,
  officialKept: officialCount,
  illustrated: written.mapped,
  missingIllustration: unmet.length + illustrationRemovals.length,
  illustrationRemovals,
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
    'Upgrade hledá kvalitnější Openverse fotky (min. šířka, lepší dotazy, specifické dish keys). Oficiální fotky se nemění. Plná vizuální kontrola člověkem je v contact sheetu.',
}

writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8')
writeFileSync(
  REPORT_MD,
  [
    '# Audit diverzity a přiřazení ilustrací',
    '',
    `Vygenerováno: ${generatedAt}`,
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
    `| Bez fotografie (vč. školní jídelny) | ${report.missingIllustration} |`,
    `| Úmyslně bez ilustrace | ${illustrationRemovals.length} |`,
    `| Unikátních ilustračních assetů | ${report.uniqueIllustrationAssets} |`,
    `| Assetů na limitu ${MAX_USES}× | ${report.imagesAtMaxUses} |`,
    `| Assetů nad limitem ${MAX_USES}× | ${report.imagesOverMaxUses} |`,
    `| Výjimky (překročen limit) | ${report.overCapFallbackCount} |`,
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
      ? overCapFallback.slice(0, 50).map((x) => `- ${x.name} (\`${x.id}\`): ${x.dishKey}, uses=${x.uses} — ${x.reason}`)
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

const coverage = {
  generatedAt,
  totalPlaces: basePlaces.length,
  withDetailPhoto: officialCount + written.mapped,
  officialVerified: officialCount,
  illustrationOpenverse: written.mapped,
  missingDetailPhoto: basePlaces.length - officialCount - written.mapped,
  uniqueIllustrationAssets: usageEntries.length,
  maxIllustrationReuse: MAX_USES,
  imagesOverReuseCap: overMax.length,
  coveragePct: Number((((officialCount + written.mapped) / basePlaces.length) * 100).toFixed(1)),
  notes: {
    official: 'Oficiální fotky z placePhotos – nepřepisují se.',
    illustration: `Openverse CC0/PDM/BY/BY-SA; max ${MAX_USES}× stejný obrázek.`,
    school: 'Školní jídelna Brno nemá ilustraci (záměrně).',
  },
}
writeFileSync(COVERAGE_JSON, JSON.stringify(coverage, null, 2), 'utf8')
writeFileSync(
  COVERAGE_MD,
  [
    '# Pokrytí fotografií podniků (detail)',
    '',
    `Vygenerováno: ${generatedAt}`,
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
    '> Školní jídelna Brno je záměrně bez ilustrace. Diverzita: `restaurant-images-diversity-audit.md`.',
    '',
  ].join('\n'),
  'utf8',
)

const quality = {
  generatedAt,
  uniqueAssets: written.sharedCount,
  assignedPlaces: written.mapped,
  dishKeys: Object.keys(placesByKey).sort(),
  placeDishOverrides: Object.keys(PLACE_DISH_OVERRIDES).length,
  illustrationRemovals,
  notes: [
    'Upgrade doplnil dish keys pasta/poke/bubble_tea/indian/vietnamese a preferuje širší fotky.',
    'Kontrola vizuálu: reports/illustration-contact-sheet.html',
  ],
}
writeFileSync(QUALITY_JSON, JSON.stringify(quality, null, 2), 'utf8')
writeFileSync(
  QUALITY_MD,
  [
    '# Audit kvality ilustrací',
    '',
    `Vygenerováno: ${generatedAt}`,
    '',
    '## Souhrn',
    '',
    `| Unikátních assetů v katalogu | ${quality.uniqueAssets} |`,
    `| Podniků s ilustrací | ${quality.assignedPlaces} |`,
    `| Dish keys v přiřazení | ${quality.dishKeys.length} |`,
    `| Place dish overrides | ${quality.placeDishOverrides} |`,
    `| Bez ilustrace (školní jídelna) | ${illustrationRemovals.join(', ') || '—'} |`,
    '',
    '## Dish keys',
    '',
    quality.dishKeys.map((k) => `- \`${k}\``).join('\n'),
    '',
    '## Poznámky',
    '',
    ...quality.notes.map((n) => `- ${n}`),
    '',
    'Detail diverzity: `restaurant-images-diversity-audit.md`. Kontaktní list: `illustration-contact-sheet.html`.',
    '',
  ].join('\n'),
  'utf8',
)

console.log({
  written: written.mapped,
  uniqueAssets: usageEntries.length,
  overMax: overMax.length,
  unmet: unmet.length,
  overCap: overCapFallback.length,
  removed: illustrationRemovals,
})
