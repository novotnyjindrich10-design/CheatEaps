import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { verifiedPrices } from '../src/data/verifiedPrices.js'
import { estimatedPrices } from '../src/data/estimatedPrices.js'
import { googleRatings } from '../src/data/googleRatings.js'
import { officialWebsites } from '../src/data/officialWebsites.js'
import { placeCoordinates } from '../src/data/placeCoordinates.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { isOfficialWebsite } from '../src/utils/website.js'
import { ALLOWED_PLACE_CATEGORIES } from '../src/constants/filters.js'
import { hasEstimatePrice, hasVerifiedPrice } from '../src/utils/price.js'
import {
  buildMapsSearchUrl,
  hasGoogleRating,
  GOOGLE_STATUS_MAPS_SEARCH,
} from '../src/utils/googleRating.js'
import { formatAirDistance, haversineKm, isInBrnoBounds } from '../src/utils/geo.js'

const EXPECTED_TOTAL = 775

const demoRestaurants = []
const seen = new Set()
for (const r of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  demoRestaurants.push(r)
}

const errors = []
const ids = demoRestaurants.map((r) => r.id)
const uniqueIds = new Set(ids)

if (demoRestaurants.length !== EXPECTED_TOTAL) {
  errors.push(`Očekáváno ${EXPECTED_TOTAL} záznamů, je ${demoRestaurants.length}`)
}
if (uniqueIds.size !== ids.length) {
  const dups = ids.filter((id, i) => ids.indexOf(id) === i && ids.lastIndexOf(id) !== i)
  errors.push(`Duplicitní ID: ${dups.join(', ')}`)
}
if (uniqueIds.size !== EXPECTED_TOTAL) {
  errors.push(`Unikátních ID ${uniqueIds.size}, očekáváno ${EXPECTED_TOTAL}`)
}

const missing = demoRestaurants.filter((r) => !r.id || !r.name || !r.address)
if (missing.length) errors.push(`Chybí id/název/adresa: ${missing.map((r) => r.id).join(', ')}`)

const badCategory = demoRestaurants.filter(
  (r) => !ALLOWED_PLACE_CATEGORIES.includes(r.category),
)
if (badCategory.length) {
  errors.push(
    `Nepovolená kategorie (${badCategory.length}): ${badCategory
      .slice(0, 8)
      .map((r) => `${r.id}=${JSON.stringify(r.category)}`)
      .join('; ')}`,
  )
}

for (const curated of curatedPlaces) {
  const merged = demoRestaurants.find((r) => r.id === curated.id)
  if (!merged) {
    errors.push(`Curated záznam chybí po sloučení: ${curated.id}`)
    continue
  }
  if (!merged.curated) {
    errors.push(`OSM přepsal curated záznam: ${curated.id}`)
  }
  if (merged.address !== curated.address || merged.name !== curated.name) {
    errors.push(`Curated název/adresa se po sloučení liší: ${curated.id}`)
  }
}

const cats = {}
for (const r of demoRestaurants) {
  cats[r.category || '(prázdná)'] = (cats[r.category || '(prázdná)'] || 0) + 1
}

for (const id of Object.keys(verifiedPrices)) {
  if (!uniqueIds.has(id)) errors.push(`Cena odkazuje na neexistující id: ${id}`)
}

const merged = demoRestaurants.map((r) => ({ ...r, ...(verifiedPrices[r.id] || {}) }))
for (const r of merged) {
  const overlay = verifiedPrices[r.id]
  if (!overlay && typeof r.price === 'number' && !r.priceKind) {
    errors.push(`Cena bez druhu a zdroje: ${r.id}`)
  }
  if (overlay && !hasVerifiedPrice({ ...r, ...overlay })) {
    errors.push(`Neúplný cenový záznam: ${r.id}`)
  }
}

for (const id of Object.keys(estimatedPrices)) {
  if (!uniqueIds.has(id)) errors.push(`Odhad odkazuje na neexistující id: ${id}`)
  if (estimatedPrices[id].priceSource) {
    errors.push(`Odhad nesmí předstírat zdroj: ${id}`)
  }
  if (estimatedPrices[id].priceVerifiedAt) {
    errors.push(`Odhad nesmí mít datum ověření: ${id}`)
  }
}

const withPrice = demoRestaurants.map((r) => ({
  ...r,
  ...(estimatedPrices[r.id] || {}),
  ...(verifiedPrices[r.id] || {}),
}))
const googleIds = Object.keys(googleRatings)
if (googleIds.length !== EXPECTED_TOTAL) {
  errors.push(`Google overlay má ${googleIds.length} záznamů, očekáváno ${EXPECTED_TOTAL}`)
}

for (const id of googleIds) {
  if (!uniqueIds.has(id)) errors.push(`Google overlay odkazuje na neexistující id: ${id}`)
  const g = googleRatings[id]
  if (!g?.googleMapsSearchUrl || !String(g.googleMapsSearchUrl).startsWith('https://www.google.com/maps/search/?api=1&query=')) {
    errors.push(`Chybí vyhledávací odkaz Google Maps: ${id}`)
  }
  if (g.googleRatingStatus === 'verified') {
    if (typeof g.googleRating !== 'number' || g.googleRating < 0 || g.googleRating > 5) {
      errors.push(`Ověřené Google hodnocení bez platné hodnoty: ${id}`)
    }
  } else if (g.googleRating != null || g.googleReviewCount != null) {
    errors.push(`Neověřený záznam nesmí mít Google hvězdy: ${id}`)
  }
}

for (const r of demoRestaurants) {
  const g = googleRatings[r.id]
  if (!g) {
    errors.push(`Chybí Google overlay: ${r.id}`)
    continue
  }
  const expectedUrl = buildMapsSearchUrl(r.name, r.address)
  if (g.googleMapsSearchUrl !== expectedUrl) {
    errors.push(`Vyhledávací odkaz neodpovídá názvu a adrese: ${r.id}`)
  }
}

const withAll = withPrice.map((r) => ({ ...r, ...(googleRatings[r.id] || {}) }))
const fakeStars = withAll.filter(
  (r) =>
    typeof r.googleRating === 'number' && r.googleRatingStatus !== 'verified',
)
if (fakeStars.length) {
  errors.push(`Falešné Google hodnocení: ${fakeStars.map((r) => r.id).join(', ')}`)
}

for (const id of Object.keys(placeCoordinates)) {
  if (!uniqueIds.has(id)) errors.push(`Souřadnice odkazují na neexistující id: ${id}`)
  const c = placeCoordinates[id]
  if (typeof c.lat !== 'number' || typeof c.lon !== 'number' || !isInBrnoBounds(c.lat, c.lon)) {
    errors.push(`Neplatné OSM souřadnice: ${id}`)
  }
}

const sampleKm = haversineKm(49.1951, 16.6068, 49.1951, 16.6068)
if (sampleKm !== 0) errors.push('Haversine stejného bodu musí být 0')
const nearbyKm = haversineKm(49.1951, 16.6068, 49.2001, 16.6068)
if (nearbyKm < 0.5 || nearbyKm > 0.6) errors.push(`Neočekávaná haversine vzdálenost: ${nearbyKm}`)
if (formatAirDistance(0.35) !== '350 m') errors.push('Formát metrů selhal')

for (const id of Object.keys(officialWebsites)) {
  if (!uniqueIds.has(id)) errors.push(`Oficiální web odkazuje na neexistující id: ${id}`)
  const url = officialWebsites[id]?.officialWebsite
  if (!isOfficialWebsite(url)) errors.push(`Neoficiální nebo neplatný web: ${id}`)
}

for (const id of Object.keys(placePhotos)) {
  if (!uniqueIds.has(id)) errors.push(`Fotografie odkazuje na neexistující id: ${id}`)
  const photo = placePhotos[id]
  if (photo?.heroImageKind !== 'official' || !String(photo.heroImageUrl || '').startsWith('https://')) {
    errors.push(`Neplatná oficiální fotografie: ${id}`)
  }
}

const missingPrice = withPrice.filter((r) => !hasVerifiedPrice(r) && !hasEstimatePrice(r))
if (missingPrice.length) {
  errors.push(`Bez cenové informace: ${missingPrice.length} (${missingPrice[0].id})`)
}

const verified = withPrice.filter((r) => hasVerifiedPrice(r))
const estimated = withPrice.filter((r) => hasEstimatePrice(r))
const summary = {
  total: demoRestaurants.length,
  uniqueIds: uniqueIds.size,
  curated: demoRestaurants.filter((r) => r.curated).length,
  withWebsite: demoRestaurants.filter((r) => r.website).length,
  vegetarian: demoRestaurants.filter((r) => r.vegetarianFriendly).length,
  vegan: demoRestaurants.filter((r) => r.veganFriendly).length,
  menuPrices: verified.filter((r) => r.priceKind === 'menu').length,
  rangePrices: verified.filter((r) => r.priceKind === 'range').length,
  deliveryPrices: verified.filter((r) => r.priceChannel === 'delivery').length,
  estimates: estimated.length,
  estimateLow: estimated.filter((r) => r.priceConfidence === 'low').length,
  uncovered: missingPrice.length,
  unknownCategory: demoRestaurants.filter((r) => r.category === 'neuvedeno').length,
  googleVerified: withAll.filter((r) => hasGoogleRating(r)).length,
  googleNotFound: withAll.filter((r) => r.googleRatingStatus === 'not_found').length,
  googleNeedsReview: withAll.filter((r) => r.googleRatingStatus === 'needs_review').length,
  googleMapsSearchOnly: withAll.filter((r) => r.googleRatingStatus === GOOGLE_STATUS_MAPS_SEARCH)
    .length,
  officialWebsites: Object.keys(officialWebsites).length,
  withCoordinates: Object.keys(placeCoordinates).length,
  missingCoordinates: EXPECTED_TOTAL - Object.keys(placeCoordinates).length,
  officialPhotos: Object.keys(placePhotos).length,
  cats,
}

if (errors.length) {
  console.error(summary)
  console.error(errors)
  process.exit(1)
}

console.log(summary)
console.log('check-places: OK')
