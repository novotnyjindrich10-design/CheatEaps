/**
 * Souřadnice z OSM Overpass (out center), párování podle názvu a adresy.
 * Nevymýšlí lat/lon. Regeneruj: npm run data:coordinates
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'

const EXPECTED_TOTAL = 775
const BRNO = { minLat: 49.1, maxLat: 49.32, minLon: 16.4, maxLon: 16.75 }

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

function houseParts(house) {
  const bits = String(house)
    .split(/[^\dA-Za-z]+/)
    .map(fold)
    .filter(Boolean)
  return new Set([fold(house), ...bits])
}

function housesOverlap(a, b) {
  const pa = houseParts(a)
  const pb = houseParts(b)
  for (const x of pa) {
    if (x && pb.has(x)) return true
  }
  return false
}

function namesOverlap(placeName, osmName) {
  const a = fold(placeName)
  const b = fold(osmName)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

function coordsOf(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon }
  }
  if (typeof el.center?.lat === 'number' && typeof el.center?.lon === 'number') {
    return { lat: el.center.lat, lon: el.center.lon }
  }
  return null
}

function inBrno(lat, lon) {
  return lat >= BRNO.minLat && lat <= BRNO.maxLat && lon >= BRNO.minLon && lon <= BRNO.maxLon
}

const seen = new Set()
const places = []
for (const r of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  places.push(r)
}

if (places.length !== EXPECTED_TOTAL) {
  console.error(`Očekáváno ${EXPECTED_TOTAL}, je ${places.length}`)
  process.exit(1)
}

const dumps = [
  new URL('../osm-brno-coords.json', import.meta.url),
  new URL('../osm-brno-food.json', import.meta.url),
]
let elements = []
let dumpUsed = null
for (const path of dumps) {
  if (!existsSync(path)) continue
  const data = JSON.parse(readFileSync(path, 'utf8'))
  elements = data.elements || []
  dumpUsed = path.pathname.split(/[/\\]/).at(-1)
  break
}

const records = []
let dumpWithGeometry = 0
for (const el of elements) {
  const t = el.tags || {}
  const name = (t.name || '').trim()
  const street = (t['addr:street'] || '').trim()
  const house = (t['addr:housenumber'] || '').trim()
  const xy = coordsOf(el)
  if (xy) dumpWithGeometry += 1
  if (!name || !street || !house || !xy) continue
  if (!inBrno(xy.lat, xy.lon)) continue
  records.push({ name, street, house, xy })
}

const overlay = {}
const missing = []
for (const place of places) {
  const { street, house } = parseStreetHouse(place.address)
  const streetFold = fold(street)
  const hits = records.filter(
    (r) =>
      fold(r.street) === streetFold &&
      housesOverlap(house, r.house) &&
      namesOverlap(place.name, r.name),
  )
  const unique = []
  for (const hit of hits) {
    const exists = unique.some(
      (u) => Math.abs(u.lat - hit.xy.lat) < 0.00015 && Math.abs(u.lon - hit.xy.lon) < 0.00015,
    )
    if (!exists) unique.push(hit.xy)
  }
  if (unique.length !== 1) {
    missing.push({ id: place.id, name: place.name, address: place.address })
    continue
  }
  const xy = unique[0]
  overlay[place.id] = {
    lat: Number(xy.lat.toFixed(6)),
    lon: Number(xy.lon.toFixed(6)),
    coordSource: 'osm',
  }
}

writeFileSync(
  new URL('../src/data/placeCoordinates.js', import.meta.url),
  `/** Souřadnice z OSM (out center). Regeneruj: npm run data:coordinates */
export const placeCoordinates = ${JSON.stringify(overlay, null, 2)}\n`,
  'utf8',
)

const report = {
  totalPlaces: places.length,
  dumpUsed,
  dumpElements: elements.length,
  dumpWithGeometry,
  withCoordinates: Object.keys(overlay).length,
  missingCoordinates: missing.length,
  missingSample: missing.slice(0, 40),
  note:
    dumpWithGeometry === 0
      ? 'Aktuální OSM dump nemá lat/lon (out tags). Stáhni geometrii: npm run data:osm-coords'
      : 'Souřadnice jen z OSM, bez vymýšlení.',
}

writeFileSync(
  new URL('../reports/coordinates-coverage.json', import.meta.url),
  JSON.stringify(report, null, 2),
  'utf8',
)
console.log({
  ...report,
  missingSample: report.missingSample.map((m) => m.id),
})
