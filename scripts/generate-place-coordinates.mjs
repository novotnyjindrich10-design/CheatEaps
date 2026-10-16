/**
 * Souřadnice z OSM Overpass (out center), párování podle názvu a adresy.
 * Nevymýšlí lat/lon. Regeneruj: npm run data:coordinates
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { placeCoordinates as previousCoordinates } from '../src/data/placeCoordinates.js'
import { isInBrnoBounds } from '../src/utils/geo.js'
import { matchOsmCoordinate } from '../src/utils/matchOsmCoordinates.js'

const EXPECTED_TOTAL = 775

function coordsOf(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') {
    return { lat: el.lat, lon: el.lon }
  }
  if (typeof el.center?.lat === 'number' && typeof el.center?.lon === 'number') {
    return { lat: el.center.lat, lon: el.center.lon }
  }
  return null
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
  const xy = coordsOf(el)
  if (xy) dumpWithGeometry += 1
  if (!name || !xy || !isInBrnoBounds(xy.lat, xy.lon)) continue
  records.push({
    name,
    street: (t['addr:street'] || '').trim(),
    house: (t['addr:housenumber'] || '').trim(),
    amenity: t.amenity || t.shop || '',
    website: t.website || t['contact:website'] || '',
    lat: xy.lat,
    lon: xy.lon,
  })
}

const overlay = {}
const missing = []
const added = []
for (const place of places) {
  // Už ověřený bod z minula se nepřepisuje. Doplňují se jen podniky, které souřadnice neměly.
  if (previousCoordinates[place.id]) {
    overlay[place.id] = previousCoordinates[place.id]
    continue
  }
  const matched = matchOsmCoordinate(place, records)
  if (!matched) {
    missing.push({ id: place.id, name: place.name, address: place.address })
    continue
  }
  overlay[place.id] = matched
  added.push(place.id)
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
  added,
  missingSample: report.missingSample.map((m) => m.id),
})
