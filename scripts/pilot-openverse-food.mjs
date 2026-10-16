/**
 * Pilot: ilustrační fotky jídel z Openverse (CC0 / PDM / CC BY / CC BY-SA)
 * pro podniky ze sekce Doporučené. Nestahuje se z webů restaurací.
 *
 * Regeneruj: node scripts/pilot-openverse-food.mjs
 */
import { mkdirSync, writeFileSync, createWriteStream, existsSync } from 'fs'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placePhotos } from '../src/data/placePhotos.js'

const UA = 'CheapEatsBrno/1.0 (student project; Openverse illustration pilot)'
const OPENVERSE = 'https://api.openverse.org/v1/images/'
const OUT_DIR = new URL('../public/food-illustrations/', import.meta.url)
const ALLOWED = new Set(['cc0', 'pdm', 'by', 'by-sa'])
const PREFERRED = new Set(['cc0', 'pdm'])

const DISH_BY_CATEGORY = {
  pizza: {
    query: 'margherita pizza food',
    fallbacks: ['pizza food plate'],
    dish: 'pizza',
    keywords: ['pizza', 'margherita'],
  },
  burger: {
    query: 'hamburger burger food',
    fallbacks: ['cheeseburger food'],
    dish: 'burger',
    keywords: ['burger', 'hamburger', 'cheeseburger'],
  },
  kebab: {
    query: 'doner kebab food',
    fallbacks: ['shawarma wrap', 'kebab food'],
    dish: 'kebab',
    keywords: ['kebab', 'doner', 'shawarma', 'gyro'],
  },
  cina: {
    query: 'chinese noodles stir fry food',
    fallbacks: ['kung pao chicken rice'],
    dish: 'čínské jídlo',
    keywords: ['chinese', 'noodle', 'stir', 'wok', 'kung'],
  },
  asijske: {
    query: 'pho vietnamese soup bowl',
    fallbacks: ['pho noodle soup'],
    dish: 'pho',
    keywords: ['pho', 'vietnamese', 'noodle', 'soup', 'ramen'],
  },
  mexiko: {
    query: 'tacos mexican food',
    fallbacks: ['taco food'],
    dish: 'tacos',
    keywords: ['taco', 'mexican', 'burrito'],
  },
  kava: {
    query: 'coffee latte cup cafe',
    fallbacks: ['espresso coffee cup'],
    dish: 'káva',
    keywords: ['coffee', 'latte', 'espresso', 'cappuccino'],
  },
  sladke: {
    query: 'cake pastry dessert',
    fallbacks: ['strawberry cake food'],
    dish: 'dort / zákusek',
    keywords: ['cake', 'pastry', 'dessert', 'cupcake', 'tart'],
  },
  fastfood: {
    query: 'baguette sandwich food',
    fallbacks: ['sandwich food'],
    dish: 'bageta / sendvič',
    keywords: ['sandwich', 'baguette', 'sub'],
  },
  ceske: {
    query: 'goulash stew dumplings food',
    fallbacks: ['goulash food'],
    dish: 'české jídlo',
    keywords: ['goulash', 'stew', 'dumpling', 'svickova', 'pork'],
  },
  zdrave: {
    query: 'salad bowl vegetables',
    fallbacks: ['salad lettuce food'],
    dish: 'salát / bowl',
    keywords: ['salad', 'bowl', 'healthy', 'vegetable', 'lettuce'],
  },
  vegetarianske: {
    query: 'indian curry rice',
    fallbacks: ['vegetarian curry food', 'thali indian food'],
    dish: 'vegetariánské jídlo',
    keywords: ['curry', 'rice', 'indian', 'vegetarian', 'thali', 'naan'],
  },
  veganske: {
    query: 'veggie burger food',
    fallbacks: ['plant based burger', 'vegan food burger'],
    dish: 'veganský burger',
    keywords: ['vegan', 'burger', 'veggie', 'plant'],
  },
  neuvedeno: {
    query: 'pasta italian food plate',
    fallbacks: ['spaghetti pasta food'],
    dish: 'těsto / hlavní jídlo',
    keywords: ['pasta', 'spaghetti', 'food', 'meal', 'dish'],
  },
}

const PLACE_OVERRIDES = {
  'dhaba-beas-panska': {
    query: 'vegetable curry rice',
    fallbacks: ['vegetarian curry tofu', 'paneer curry'],
    dish: 'indické vegetariánské jídlo',
    keywords: ['vegetable', 'curry', 'rice', 'tofu', 'vegetarian', 'paneer'],
  },
  'rebio-velky-spalicek': {
    query: 'salad bowl vegetables',
    fallbacks: ['salad lettuce food'],
    dish: 'salát / zdravá porce',
    keywords: ['salad', 'vegetable', 'healthy', 'lettuce', 'bowl'],
  },
  'rebio-orli': {
    query: 'salad bowl vegetables',
    fallbacks: ['salad lettuce food'],
    dish: 'salát / zdravá porce',
    keywords: ['salad', 'vegetable', 'healthy', 'lettuce', 'bowl'],
  },
  'oh-pho': {
    query: 'pho vietnamese noodle soup',
    fallbacks: ['pho soup'],
    dish: 'pho',
    keywords: ['pho', 'vietnamese', 'noodle', 'soup'],
  },
  'lokofu': {
    query: 'chinese kung pao chicken rice',
    fallbacks: ['kung pao chicken'],
    dish: 'kung-pao / čínské jídlo',
    keywords: ['chinese', 'kung', 'pao', 'rice', 'noodle'],
  },
  'new-era-restaurace': {
    query: 'asian noodle soup bowl',
    fallbacks: ['ramen noodle soup'],
    dish: 'asijská polévka s nudlemi',
    keywords: ['noodle', 'soup', 'asian', 'ramen', 'pho'],
  },
  'cukrarna-vetrnik-lidicka': {
    query: 'cream cake pastry dessert',
    fallbacks: ['strawberry cake food'],
    dish: 'dort',
    keywords: ['cake', 'pastry', 'cream', 'dessert'],
  },
  'skog-urban-hub': {
    query: 'flat white coffee cafe',
    fallbacks: ['latte coffee cup'],
    dish: 'káva',
    keywords: ['coffee', 'latte', 'flat', 'espresso'],
  },
  'kurdsky-kebab-cejl': {
    query: 'gyro pita sandwich',
    fallbacks: ['greek gyro food', 'shawarma wrap'],
    dish: 'kebab',
    keywords: ['gyro', 'pita', 'sandwich', 'kebab', 'shawarma'],
  },
  'antalya-doner-kebap-palavske-namesti-3c': {
    query: 'gyro pita sandwich',
    fallbacks: ['greek gyro food', 'shawarma wrap'],
    dish: 'kebab',
    keywords: ['gyro', 'pita', 'sandwich', 'kebab', 'shawarma'],
  },
  'forkys-vankovka': {
    query: 'veggie burger food',
    fallbacks: ['vegan burger plate', 'plant based burger food'],
    dish: 'veganský burger',
    keywords: ['vegan', 'burger', 'veggie', 'plant'],
  },
}

function pickRecommended(places, limit = 20) {
  const byCategory = new Map()
  for (const place of places) {
    const key = place.category || 'neuvedeno'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key).push(place)
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => Number(Boolean(b.curated)) - Number(Boolean(a.curated)))
  }
  const categories = [...byCategory.keys()]
  const picked = []
  const seen = new Set()
  while (picked.length < limit && categories.length > 0) {
    for (let i = 0; i < categories.length && picked.length < limit; ) {
      const key = categories[i]
      const list = byCategory.get(key)
      const next = list.shift()
      if (!next) {
        categories.splice(i, 1)
        continue
      }
      if (!seen.has(next.id)) {
        seen.add(next.id)
        picked.push(next)
      }
      if (list.length === 0) categories.splice(i, 1)
      else i += 1
    }
  }
  return picked
}

function dishSpec(place) {
  return PLACE_OVERRIDES[place.id] || DISH_BY_CATEGORY[place.category] || DISH_BY_CATEGORY.neuvedeno
}

function scoreResult(item, keywords) {
  if (!ALLOWED.has(item.license)) return -1
  if (item.mature) return -1
  const blob = `${item.title || ''} ${(item.tags || []).map((t) => t.name).join(' ')}`.toLowerCase()
  let score = 0
  for (const word of keywords) {
    if (blob.includes(word.toLowerCase())) score += 3
  }
  if (
    !/\b(food|pizza|burger|cake|coffee|salad|taco|kebab|noodle|soup|pasta|meal|dish|curry|pho|sandwich|veggie|lettuce|naan|shawarma|rice)\b/i.test(
      blob,
    )
  ) {
    score -= 4
  }
  if (/\b(logo|interior|building|street|person|people|map|screenshot|window|stall|shop)\b/i.test(blob)) score -= 5
  if (/\b(chicken|beef|pork|meat)\b/i.test(blob) && keywords.some((k) => /vegetar|vegan|paneer|tofu|thali/i.test(k))) {
    score -= 8
  }
  if (PREFERRED.has(item.license)) score += 2
  if ((item.width || 0) >= 800 && (item.height || 0) >= 500) score += 1
  if ((item.width || 0) < 400 || (item.height || 0) < 300) score -= 2
  return score
}

async function searchOpenverse(query) {
  const url = new URL(OPENVERSE)
  url.searchParams.set('q', query)
  url.searchParams.set('license', 'cc0,pdm,by,by-sa')
  url.searchParams.set('page_size', '20')
  url.searchParams.set('category', 'photograph')
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Openverse ${res.status} for ${query}`)
  const data = await res.json()
  return data.results || []
}

async function download(url, destPath) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`Download ${res.status} ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

function extOf(url, filetype) {
  if (filetype && /^[a-z0-9]+$/i.test(filetype)) return filetype.toLowerCase()
  try {
    const path = new URL(url).pathname
    const m = path.match(/\.(jpe?g|png|webp|gif)$/i)
    if (m) return m[1].toLowerCase().replace('jpeg', 'jpg')
  } catch {
    /* ignore */
  }
  return 'jpg'
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

mkdirSync(OUT_DIR, { recursive: true })

const seen = new Set()
const places = []
for (const r of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  places.push(r)
}
const pilot = pickRecommended(places, 20)

const cacheByQuery = new Map()
const overlay = {}
const reportRows = []

for (const place of pilot) {
  const hasOfficial = placePhotos[place.id]?.heroImageKind === 'official' && placePhotos[place.id]?.heroImageUrl
  const spec = dishSpec(place)

  if (hasOfficial) {
    reportRows.push({
      id: place.id,
      name: place.name,
      category: place.category,
      status: 'kept_official',
      dish: null,
      note: 'Ponechána oficiální fotografie z placePhotos.',
    })
    continue
  }

  const queries = [spec.query, ...(spec.fallbacks || [])]
  let results = []
  let ranked = []
  let usedQuery = spec.query
  let lastSearchError = null

  for (const query of queries) {
    let page = cacheByQuery.get(query)
    if (!page) {
      await sleep(1200)
      try {
        console.log(`search ${place.id}: ${query}`)
        page = await searchOpenverse(query)
        lastSearchError = null
      } catch (err) {
        lastSearchError = String(err.message || err)
        page = []
      }
      cacheByQuery.set(query, page)
    }
    results = page
    usedQuery = query
    ranked = results
      .map((item) => ({ item, score: scoreResult(item, spec.keywords) }))
      .filter((row) => row.score >= 2)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (PREFERRED.has(b.item.license) ? 1 : 0) - (PREFERRED.has(a.item.license) ? 1 : 0),
      )
    if (ranked[0]) break
  }

  const best = ranked[0]?.item
  if (!best) {
    reportRows.push({
      id: place.id,
      name: place.name,
      category: place.category,
      status: lastSearchError && results.length === 0 ? 'search_failed' : 'not_found',
      dish: spec.dish,
      note: lastSearchError || 'Openverse nevrátil relevantní CC0/PDM/BY/BY-SA fotografii jídla.',
      candidatesChecked: results.length,
      query: usedQuery,
    })
    continue
  }

  const fileBase = `${place.id}-${best.id.slice(0, 8)}`
  const ext = extOf(best.url, best.filetype)
  const fileName = `${fileBase}.${ext}`
  const localPath = new URL(fileName, OUT_DIR)
  const publicUrl = `/food-illustrations/${fileName}`

  try {
    if (!existsSync(localPath)) {
      await sleep(200)
      await download(best.url, localPath)
    }
  } catch (err) {
    reportRows.push({
      id: place.id,
      name: place.name,
      category: place.category,
      status: 'download_failed',
      dish: spec.dish,
      note: String(err.message || err),
      openverseId: best.id,
      sourceUrl: best.foreign_landing_url,
    })
    continue
  }

  overlay[place.id] = {
    foodIllustrationKind: 'openverse',
    foodIllustrationUrl: publicUrl,
    foodIllustrationDish: spec.dish,
    foodIllustrationAlt: `Ilustrační fotografie: ${spec.dish} (ne jídlo z podniku ${place.name})`,
    foodIllustrationLicense: best.license,
    foodIllustrationLicenseUrl: best.license_url,
    foodIllustrationCreator: best.creator || '',
    foodIllustrationCreatorUrl: best.creator_url || '',
    foodIllustrationSourceUrl: best.foreign_landing_url,
    foodIllustrationOpenverseId: best.id,
    foodIllustrationAttribution: best.attribution || '',
    foodIllustrationOriginalUrl: best.url,
  }

  reportRows.push({
    id: place.id,
    name: place.name,
    category: place.category,
    status: 'assigned',
    dish: spec.dish,
    license: best.license,
    creator: best.creator,
    title: best.title,
    sourceUrl: best.foreign_landing_url,
    localFile: publicUrl,
    score: ranked[0].score,
    query: usedQuery,
  })
  console.log(`assigned ${place.id} ← ${best.title} (${best.license})`)
}

writeFileSync(
  new URL('../src/data/placeFoodIllustrations.pilot.js', import.meta.url),
  `/** Pilot ilustrací jídel z Openverse. Regeneruj: node scripts/pilot-openverse-food.mjs */
export const placeFoodIllustrationsPilot = ${JSON.stringify(overlay, null, 2)}\n`,
  'utf8',
)

writeFileSync(
  new URL('../reports/openverse-food-pilot.json', import.meta.url),
  JSON.stringify({ generatedAt: new Date().toISOString(), pilotCount: pilot.length, assigned: Object.keys(overlay).length, rows: reportRows }, null, 2),
  'utf8',
)

const md = [
  '# Pilot ilustrací jídel (Openverse)',
  '',
  `Vygenerováno: ${new Date().toISOString()}`,
  '',
  'Zdroj: [Openverse Images API](https://api.openverse.org/v1/images/). Licence omezené na CC0, PDM, CC BY, CC BY-SA.',
  'Oficiální fotografie z `placePhotos` mají přednost. Openverse fotky jsou **ilustrace typu jídla**, ne snímky konkrétního podniku.',
  '',
  `| Stav | Počet |`,
  `| --- | ---: |`,
  `| Přiřazeno z Openverse | ${reportRows.filter((r) => r.status === 'assigned').length} |`,
  `| Ponechána oficiální | ${reportRows.filter((r) => r.status === 'kept_official').length} |`,
  `| Nenalezeno / chyba | ${reportRows.filter((r) => !['assigned', 'kept_official'].includes(r.status)).length} |`,
  '',
  '## Přiřazené',
  '',
  '| Podnik | Jídlo | Licence | Autor | Soubor |',
  '| --- | --- | --- | --- | --- |',
  ...reportRows
    .filter((r) => r.status === 'assigned')
    .map(
      (r) =>
        `| ${r.name} (\`${r.id}\`) | ${r.dish} | ${r.license} | ${r.creator || '—'} | ${r.localFile} |`,
    ),
  '',
  '## Ponecháno oficiální',
  '',
  ...reportRows.filter((r) => r.status === 'kept_official').map((r) => `- ${r.name} (\`${r.id}\`)`),
  '',
  '## Bez vhodné fotografie',
  '',
  ...reportRows
    .filter((r) => !['assigned', 'kept_official'].includes(r.status))
    .map((r) => `- ${r.name} (\`${r.id}\`): ${r.status} — ${r.note}`),
  '',
]

writeFileSync(new URL('../reports/openverse-food-pilot.md', import.meta.url), md.join('\n'), 'utf8')

console.log({
  pilot: pilot.length,
  assigned: Object.keys(overlay).length,
  keptOfficial: reportRows.filter((r) => r.status === 'kept_official').length,
  missing: reportRows.filter((r) => !['assigned', 'kept_official'].includes(r.status)).length,
})
