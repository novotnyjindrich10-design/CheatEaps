/**
 * Ilustrační fotky z oficiálního Pixabay API.
 *
 * Dokumentace (pixabay.com/api/docs, ověřeno 3. 11. 2026):
 * - trvalé hotlinkování URL z API není dovolené, použité snímky se stáhnou k nám
 * - odpovědi hledání se ukládají 24 hodin a znovu se nevolají
 * - systematické hromadné stahování celé knihovny není dovolené
 * - originály (imageURL / fullHDURL) vyžadují schválený plný přístup, nepoužíváme je
 *
 * Skript proto udělá nejvýš 31 předem daných dotazů a stáhne jen vybranou sadu
 * do velikosti largeImageURL (nejvýš 1280 px). Bez PIXABAY_API_KEY nic nestahuje
 * a knihovnu nemění. Klíč patří jen do .env, nikdy do VITE_* ani do logu.
 *
 *   npm run data:pixabay-illustrations
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { getCategoryOverride } from '../src/data/categoryOverrides.js'
import { DISH_SPECS, dishSpecForPlace } from './lib/openverseFoodShared.mjs'
import { assignPhotoIds, selectPixabayPhotos } from './lib/pixabaySelect.mjs'
import { loadDotEnv } from './lib/loadDotEnv.mjs'
import { pixabayManualPhotoByPlaceId, pixabayManualPhotos } from '../src/data/pixabayManualPicks.js'

const MAX_REQUESTS = 31
/** Strop lokálních náhledů — vyšší fond = méně opakování u kaváren, české kuchyně a pizzy. */
const MAX_DOWNLOADS = 420
const CACHE_MS = 24 * 60 * 60 * 1000
const PER_PAGE = 80
const CACHE_VERSION = `p${PER_PAGE}-v2`

/**
 * Dotazy jsou cílené na nejčastější témata katalogu (káva, české, pizza, …).
 * page: 2 u vybraných témat rozšíří fond bez nových frází.
 */
const SEARCHES = [
  { theme: 'pizza', query: 'margherita pizza' },
  { theme: 'pizza', query: 'wood fired pizza' },
  { theme: 'burger', query: 'cheeseburger' },
  { theme: 'burger', query: 'smash burger food' },
  { theme: 'kebab', query: 'shawarma wrap' },
  { theme: 'pho', query: 'vietnamese pho' },
  { theme: 'vietnamese', query: 'vietnamese food' },
  { theme: 'sushi', query: 'nigiri sushi' },
  { theme: 'ramen', query: 'ramen bowl' },
  { theme: 'cina', query: 'chinese noodles' },
  { theme: 'asijske', query: 'asian noodle bowl' },
  { theme: 'asijske', query: 'asian rice bowl' },
  { theme: 'mexiko', query: 'tacos' },
  { theme: 'pasta', query: 'pasta dish' },
  { theme: 'ceske', query: 'goulash dumplings' },
  { theme: 'ceske', query: 'schnitzel potatoes' },
  { theme: 'ceske', query: 'roast pork dumplings', page: 2 },
  { theme: 'kava', query: 'latte art' },
  { theme: 'kava', query: 'espresso cup', page: 2 },
  { theme: 'kava', query: 'cappuccino foam' },
  { theme: 'kava', query: 'coffee cup cafe', page: 2 },
  { theme: 'sladke', query: 'pastry dessert' },
  { theme: 'zdrave', query: 'salad bowl' },
  { theme: 'veganske', query: 'veggie burger' },
  { theme: 'fastfood', query: 'french fries' },
  { theme: 'fried_chicken', query: 'fried chicken' },
  { theme: 'neuvedeno', query: 'plated dinner' },
  { theme: 'bubble_tea', query: 'bubble tea drink' },
  { theme: 'indian', query: 'indian curry food' },
  { theme: 'poke', query: 'poke bowl salmon' },
  { theme: 'baguette', query: 'baguette sandwich' },
]

const KEEP = {
  pizza: 40,
  burger: 26,
  kebab: 12,
  pho: 6,
  vietnamese: 6,
  sushi: 9,
  ramen: 4,
  cina: 8,
  asijske: 30,
  mexiko: 8,
  pasta: 5,
  ceske: 50,
  kava: 70,
  sladke: 16,
  zdrave: 8,
  veganske: 4,
  fastfood: 14,
  fried_chicken: 5,
  neuvedeno: 45,
  vegetarianske: 4,
  bubble_tea: 4,
  poke: 4,
  baguette: 4,
  indian: 4,
}

const NEUTRAL_SPEC = {
  key: 'neuvedeno',
  dish: 'jídlo',
  keywords: ['food', 'plate', 'dish', 'meal', 'dinner', 'lunch', 'cuisine', 'restaurant', 'gourmet'],
  forbidTags: [],
}

const cacheDir = new URL('../.cache/pixabay/', import.meta.url)
const imageDir = new URL('../public/food-illustrations/pixabay/', import.meta.url)

function specFor(theme) {
  if (theme === 'neuvedeno') return NEUTRAL_SPEC
  const spec = DISH_SPECS[theme]
  if (!spec) throw new Error(`Chybí dish spec pro téma ${theme}`)
  return spec
}

function places() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  }
  return [...byId.values()].map((entry) => {
    const override = getCategoryOverride(entry.id)
    return {
      ...entry,
      category: override?.category || entry.category || 'neuvedeno',
      type: override?.type || entry.type,
    }
  })
}

function cacheFile(query, page) {
  const name = createHash('sha256')
    .update(`${CACHE_VERSION}|${page}|${query}`)
    .digest('hex')
    .slice(0, 16)
  return new URL(`${name}.json`, cacheDir)
}

function readCache(query, page) {
  const file = cacheFile(query, page)
  if (!existsSync(file)) return null
  try {
    const cached = JSON.parse(readFileSync(file, 'utf8'))
    if (!cached || Date.now() - cached.fetchedAt >= CACHE_MS || !Array.isArray(cached.hits)) return null
    return cached.hits
  } catch {
    return null
  }
}

function writeCache(query, page, hits) {
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile(query, page), JSON.stringify({ fetchedAt: Date.now(), query, page, hits }))
}

async function search(key, query, page = 1) {
  const url = new URL('https://pixabay.com/api/')
  url.searchParams.set('key', key)
  url.searchParams.set('q', query)
  url.searchParams.set('image_type', 'photo')
  url.searchParams.set('orientation', 'horizontal')
  url.searchParams.set('category', 'food')
  url.searchParams.set('min_width', '1600')
  url.searchParams.set('min_height', '1000')
  url.searchParams.set('safesearch', 'true')
  url.searchParams.set('order', 'popular')
  url.searchParams.set('lang', 'en')
  url.searchParams.set('per_page', String(PER_PAGE))
  url.searchParams.set('page', String(page))

  let response
  try {
    response = await fetch(url)
  } catch {
    throw new Error(`Pixabay API nedostupné u dotazu „${query}“`)
  }
  if (response.status === 429) throw new Error(`Limit API u dotazu „${query}“. Knihovna se nemění.`)
  if (!response.ok) throw new Error(`Pixabay HTTP ${response.status} u dotazu „${query}“`)
  const body = await response.json()
  if (!Array.isArray(body.hits)) throw new Error(`API nevrátilo seznam fotek pro „${query}“`)
  const remaining = response.headers.get('X-RateLimit-Remaining')
  return { hits: body.hits, remaining }
}

function extensionFor(type) {
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg'
  return ''
}

async function downloadSelected(photo) {
  const response = await fetch(photo.downloadUrl)
  if (!response.ok) throw new Error(`stažení ${photo.id} selhalo`)
  const type = response.headers.get('content-type') || ''
  const extension = extensionFor(type)
  if (!extension) throw new Error(`stažení ${photo.id} není obrázek`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length < 8_000 || bytes.length > 3_500_000) throw new Error(`stažení ${photo.id} má neočekávanou velikost`)
  mkdirSync(imageDir, { recursive: true })
  const filename = `${photo.id}.${extension}`
  writeFileSync(new URL(filename, imageDir), bytes)
  return `/food-illustrations/pixabay/${filename}`
}

function writeLibrary({ photosById, idsByTheme, assignment, generatedAt }) {
  const body = `/**
 * Vygenerováno scripts/fetch-pixabay-illustrations.mjs z Pixabay API.
 * V souboru jsou jen lokální cesty stažených náhledů, ne cizí URL.
 * Ruční výjimky drží src/data/pixabayManualPicks.js.
 */
export const pixabayLibraryReady = ${Object.keys(assignment).length > 0}

export const pixabayGeneratedAt = ${JSON.stringify(generatedAt)}

export const pixabayPhotosById = ${JSON.stringify(photosById, null, 2)}

export const pixabayIdsByTheme = ${JSON.stringify(idsByTheme, null, 2)}

export const placePixabayPhotoId = ${JSON.stringify(assignment, null, 2)}
`
  writeFileSync(new URL('../src/data/pixabayLibrary.data.js', import.meta.url), body)
}

function reservedPhotoIds() {
  return new Set(Object.values(pixabayManualPhotoByPlaceId).map(Number))
}

function keepManualPhotosOutOfPool(idsByTheme, photosById) {
  const reserved = reservedPhotoIds()
  for (const theme of Object.keys(idsByTheme)) {
    idsByTheme[theme] = idsByTheme[theme].filter((id) => !reserved.has(Number(id)))
  }
  for (const id of reserved) delete photosById[id]
}

function applyManualPhotos(assignment, photosById) {
  for (const [placeId, photoId] of Object.entries(pixabayManualPhotoByPlaceId)) {
    const photo = pixabayManualPhotos[photoId]
    if (!photo || photo.id !== Number(photoId)) continue
    if (!String(photo.cardUrl || '').startsWith('/food-illustrations/pixabay/')) continue
    if (!String(photo.detailUrl || '').startsWith('/food-illustrations/pixabay/')) continue
    photosById[photo.id] = { ...photo }
    assignment[placeId] = photo.id
  }
}

function trimToCap(idsByTheme, photosById) {
  const themes = Object.keys(idsByTheme).sort(
    (a, b) => idsByTheme[b].length - idsByTheme[a].length,
  )
  let total = themes.reduce((sum, theme) => sum + idsByTheme[theme].length, 0)
  for (const theme of themes) {
    while (total > MAX_DOWNLOADS && idsByTheme[theme].length > 4) {
      const dropped = idsByTheme[theme].pop()
      delete photosById[dropped]
      total -= 1
    }
  }
}

async function main() {
  if (SEARCHES.length > MAX_REQUESTS) {
    console.error(`Seznam dotazů má ${SEARCHES.length}, povolený strop je ${MAX_REQUESTS}.`)
    process.exit(1)
  }
  loadDotEnv()
  const key = process.env.PIXABAY_API_KEY || ''
  if (key.length < 16) {
    console.error('Chybí PIXABAY_API_KEY v .env. Nic se nestahuje a knihovna se nemění.')
    process.exit(1)
  }

  const buckets = new Map()
  for (const row of SEARCHES) {
    if (!buckets.has(row.theme)) buckets.set(row.theme, [])
  }

  for (let i = 0; i < SEARCHES.length; i += 1) {
    const row = SEARCHES[i]
    const page = Number.isInteger(row.page) && row.page > 0 ? row.page : 1
    const cached = readCache(row.query, page)
    if (cached) {
      buckets.get(row.theme).push(...cached)
      console.log(`${i + 1}/${SEARCHES.length} ${row.theme}: cache p${page}, ${cached.length} kandidátů`)
      continue
    }
    const result = await search(key, row.query, page)
    writeCache(row.query, page, result.hits)
    buckets.get(row.theme).push(...result.hits)
    console.log(
      `${i + 1}/${SEARCHES.length} ${row.theme}: p${page} ${result.hits.length} kandidátů, zbývá požadavků ${result.remaining ?? '?'}`,
    )
    if (i < SEARCHES.length - 1) await new Promise((resolve) => setTimeout(resolve, 700))
  }

  const selectedById = new Map()
  const idsByTheme = {}
  /** Jedno Pixabay ID smí patřit jen do jednoho tématu (jinak burger dostane fastfood snímek). */
  const claimedIds = new Set()
  const themeOrder = [...buckets.keys()].sort((a, b) => {
    const rank = (theme) => {
      if (theme === 'pizza' || theme === 'burger' || theme === 'kava' || theme === 'ceske') return 0
      if (theme === 'neuvedeno' || theme === 'fastfood') return 2
      return 1
    }
    return rank(a) - rank(b) || a.localeCompare(b)
  })
  for (const theme of themeOrder) {
    const rawPhotos = buckets.get(theme) || []
    const selected = selectPixabayPhotos(rawPhotos, specFor(theme), {
      limit: KEEP[theme] || 6,
      perUser: theme === 'kava' || theme === 'ceske' || theme === 'pizza' ? 6 : 4,
      excludeIds: claimedIds,
    })
    idsByTheme[theme] = selected.map((photo) => photo.id)
    for (const photo of selected) {
      claimedIds.add(photo.id)
      selectedById.set(photo.id, { ...photo, theme, dish: specFor(theme).dish })
    }
    console.log(`${theme}: vybráno ${selected.length}`)
  }

  const photosById = {}
  for (const photo of selectedById.values()) photosById[photo.id] = photo
  trimToCap(idsByTheme, photosById)
  keepManualPhotosOutOfPool(idsByTheme, photosById)
  const chosen = Object.values(photosById)
  if (chosen.length === 0) {
    console.error('API nevrátilo žádnou použitelnou fotku. Knihovna se nezměnila.')
    process.exit(1)
  }
  if (chosen.length > MAX_DOWNLOADS) {
    console.error(`Výběr má ${chosen.length} fotek, strop je ${MAX_DOWNLOADS}. Knihovna se nezměnila.`)
    process.exit(1)
  }

  let saved = 0
  for (const photo of chosen) {
    const existingJpg = new URL(`${photo.id}.jpg`, imageDir)
    const existingPng = new URL(`${photo.id}.png`, imageDir)
    const existingWebp = new URL(`${photo.id}.webp`, imageDir)
    if (existsSync(existingJpg) || existsSync(existingPng) || existsSync(existingWebp)) {
      const localUrl = existsSync(existingJpg)
        ? `/food-illustrations/pixabay/${photo.id}.jpg`
        : existsSync(existingPng)
          ? `/food-illustrations/pixabay/${photo.id}.png`
          : `/food-illustrations/pixabay/${photo.id}.webp`
      photosById[photo.id] = {
        id: photo.id,
        width: photo.displayWidth,
        height: photo.displayHeight,
        user: photo.user,
        userId: photo.userId,
        pageUrl: photo.pageUrl,
        profileUrl: photo.profileUrl,
        cardUrl: localUrl,
        detailUrl: localUrl,
        theme: photo.theme,
        dish: photo.dish,
      }
      saved += 1
      continue
    }
    try {
      const localUrl = await downloadSelected(photo)
      photosById[photo.id] = {
        id: photo.id,
        width: photo.displayWidth,
        height: photo.displayHeight,
        user: photo.user,
        userId: photo.userId,
        pageUrl: photo.pageUrl,
        profileUrl: photo.profileUrl,
        cardUrl: localUrl,
        detailUrl: localUrl,
        theme: photo.theme,
        dish: photo.dish,
      }
      saved += 1
    } catch (error) {
      delete photosById[photo.id]
      console.log(`přeskočeno ${photo.id}: ${error instanceof Error ? error.message : 'stažení selhalo'}`)
    }
  }

  for (const theme of Object.keys(idsByTheme)) {
    idsByTheme[theme] = idsByTheme[theme].filter((id) => photosById[id])
  }

  const placeIdsByTheme = {}
  for (const place of places()) {
    const spec = dishSpecForPlace(place)
    const theme = idsByTheme[spec.key]?.length ? spec.key : 'neuvedeno'
    if (!idsByTheme[theme]?.length) continue
    if (!placeIdsByTheme[theme]) placeIdsByTheme[theme] = []
    placeIdsByTheme[theme].push(place.id)
  }
  for (const ids of Object.values(placeIdsByTheme)) ids.sort()

  const assignment = assignPhotoIds(placeIdsByTheme, idsByTheme)
  applyManualPhotos(assignment, photosById)
  if (saved === 0 || Object.keys(assignment).length === 0) {
    console.error('Žádná fotka se nepodařila uložit. Knihovna se nezměnila.')
    process.exit(1)
  }

  writeLibrary({
    photosById,
    idsByTheme,
    assignment,
    generatedAt: new Date().toISOString(),
  })
  console.log(`Uloženo ${saved} fotek pro ${Object.keys(assignment).length} podniků.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Pixabay API selhalo. Knihovna se nezměnila.')
  process.exit(1)
})
