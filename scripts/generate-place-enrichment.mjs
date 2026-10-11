/**
 * Oficiální weby a OSM fakta (kuchyně, amenity, bezlepkové, oběd) podle existujících
 * záznamů a osm-brno-food.json. Nevymýšlí URL. Regeneruj:
 *   node scripts/generate-place-enrichment.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { isOfficialWebsite } from '../src/utils/website.js'
import { googleRatings } from '../src/data/googleRatings.js'
import { hasGoogleRating } from '../src/utils/googleRating.js'

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/nám\./g, 'namesti')
    .replace(/[^a-z0-9]+/g, '')
}

function parseStreetHouse(address) {
  const first = String(address || '').split(',')[0] || ''
  const match = first.match(/^(.+?)\s+(\d[\w/-]*)/u)
  if (!match) return { street: first, house: '' }
  return { street: match[1], house: match[2] }
}

function addrKey(street, house) {
  return `${fold(street)}|${fold(house)}`
}

const seen = new Set()
const places = []
for (const r of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  places.push(r)
}

const osmByKey = new Map()
const osmPath = new URL('../osm-brno-food.json', import.meta.url)
if (existsSync(osmPath)) {
  const dump = JSON.parse(readFileSync(osmPath, 'utf8'))
  for (const el of dump.elements || []) {
    const t = el.tags || {}
    const street = (t['addr:street'] || '').trim()
    const house = (t['addr:housenumber'] || '').trim()
    const name = (t.name || '').trim()
    if (!name || !street || !house) continue
    const key = `${fold(name)}|${addrKey(street, house)}`
    if (!osmByKey.has(key)) osmByKey.set(key, t)
  }
}

const officialWebsites = {}
const osmFacts = {}
const skippedSites = { socialOrCatalog: 0, missing: 0, kept: 0 }

for (const place of places) {
  const { street, house } = parseStreetHouse(place.address)
  const tags = osmByKey.get(`${fold(place.name)}|${addrKey(street, house)}`) || {}
  const candidates = [place.website, tags.website, tags['contact:website']].filter(Boolean)
  const official = candidates.find((url) => isOfficialWebsite(url))
  if (official) {
    officialWebsites[place.id] = { officialWebsite: official }
    skippedSites.kept += 1
  } else {
    if (candidates.length) skippedSites.socialOrCatalog += 1
    else skippedSites.missing += 1
  }

  const facts = {}
  if (tags.cuisine) facts.osmCuisine = String(tags.cuisine)
  if (tags.amenity) facts.osmAmenity = String(tags.amenity)
  if (tags['diet:gluten_free'] === 'yes') facts.glutenFree = true
  if (tags.lunch === 'yes' || /^yes/i.test(String(tags.lunch || ''))) facts.lunchMenu = true
  if (Object.keys(facts).length) osmFacts[place.id] = facts
}

function writeJs(rel, header, data) {
  writeFileSync(
    new URL(rel, import.meta.url),
    `${header}${JSON.stringify(data, null, 2)}\n`,
    'utf8',
  )
}

writeJs(
  '../src/data/officialWebsites.js',
  `/** Oficiální weby z curated záznamů a OSM (bez katalogů a sítí). Regeneruj: node scripts/generate-place-enrichment.mjs */
export const officialWebsites = `,
  officialWebsites,
)

writeJs(
  '../src/data/osmFacts.js',
  `/** Doplňující OSM tagy k existujícím ID. Regeneruj: node scripts/generate-place-enrichment.mjs */
export const osmFacts = `,
  osmFacts,
)

const googleValues = places.map((p) => googleRatings[p.id] || {})
const report = {
  totalPlaces: places.length,
  officialWebsites: Object.keys(officialWebsites).length,
  withoutOfficialWebsite: places.length - Object.keys(officialWebsites).length,
  skippedSocialOrCatalog: skippedSites.socialOrCatalog,
  osmFacts: Object.keys(osmFacts).length,
  glutenFreeOsm: Object.values(osmFacts).filter((f) => f.glutenFree).length,
  lunchMenuOsm: Object.values(osmFacts).filter((f) => f.lunchMenu).length,
  googleVerified: googleValues.filter((g) => hasGoogleRating(g)).length,
  googleNotFound: googleValues.filter((g) => g.googleRatingStatus === 'not_found').length,
  googleNeedsReview: googleValues.filter((g) => g.googleRatingStatus === 'needs_review').length,
  googleMapsSearchOnly: googleValues.filter((g) => g.googleRatingStatus === 'maps_search').length,
}

writeFileSync(
  new URL('../reports/place-coverage.json', import.meta.url),
  JSON.stringify(report, null, 2),
  'utf8',
)
console.log(report)
