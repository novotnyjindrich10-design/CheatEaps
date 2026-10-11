/**
 * Pro všech 775 podniků uloží vyhledávací odkaz Google Maps (název + adresa).
 * Nevymýšlí hodnocení, Place ID ani přímý profil. Places overlay (verified /
 * not_found / needs_review) se zachová, pokud už existuje.
 */
import { writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { googleRatings as existing } from '../src/data/googleRatings.js'
import { buildMapsSearchUrl, GOOGLE_STATUS_MAPS_SEARCH } from '../src/utils/googleRating.js'

const EXPECTED_TOTAL = 775
const KEEP = new Set(['verified', 'not_found', 'needs_review'])

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

const overlay = {}
const counts = { verified: 0, not_found: 0, needs_review: 0, maps_search: 0 }

for (const place of places) {
  const prev = existing[place.id] || {}
  const searchUrl = buildMapsSearchUrl(place.name, place.address)
  if (KEEP.has(prev.googleRatingStatus)) {
    overlay[place.id] = { ...prev, googleMapsSearchUrl: searchUrl }
    counts[prev.googleRatingStatus] += 1
    continue
  }
  overlay[place.id] = {
    googleRatingStatus: GOOGLE_STATUS_MAPS_SEARCH,
    googleMapsSearchUrl: searchUrl,
  }
  counts.maps_search += 1
}

const header = `/** Google Maps odkazy a případná ověřená hodnocení. Regeneruj: npm run data:google-maps-links */
/** Hodnocení a Place ID jen z Places API. Tento soubor bez API obsahuje jen vyhledávací odkazy. */
export const googleRatings = `

writeFileSync(
  new URL('../src/data/googleRatings.js', import.meta.url),
  `${header}${JSON.stringify(overlay, null, 2)}\n`,
  'utf8',
)

const report = {
  totalPlaces: places.length,
  overlaySize: Object.keys(overlay).length,
  verifiedRatings: counts.verified,
  notFound: counts.not_found,
  needsReview: counts.needs_review,
  mapsSearchOnly: counts.maps_search,
  ranPlacesApi: false,
  note: 'Bez Places API nelze získat skutečná hodnocení. Každý podnik má vyhledávací odkaz název + adresa.',
}

writeFileSync(
  new URL('../reports/google-ratings-report.json', import.meta.url),
  JSON.stringify(report, null, 2),
  'utf8',
)
console.log(report)
