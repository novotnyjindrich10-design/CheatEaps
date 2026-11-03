/**
 * Etapa 4: audit kvality katalogu (bez demoRestaurants / bez Vite path aliasů).
 * node scripts/audit-catalog-quality.mjs
 */
import { writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { verifiedPrices } from '../src/data/verifiedPrices.js'
import { estimatedPrices } from '../src/data/estimatedPrices.js'
import { placeCoordinates } from '../src/data/placeCoordinates.js'
import { osmFacts } from '../src/data/osmFacts.js'
import { getCategoryOverride } from '../src/data/categoryOverrides.js'
import { hasEstimatePrice, hasVerifiedPrice } from '../src/utils/price.js'
import { filterAndSortRestaurants } from '../src/utils/filterRestaurants.js'
import { KNOWN_DUPLICATE_PAIRS } from '../src/utils/catalogDuplicates.js'

const seen = new Set()
const places = []
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(entry.id)) continue
  seen.add(entry.id)
  const override = getCategoryOverride(entry.id)
  places.push({
    ...entry,
    ...(estimatedPrices[entry.id] || {}),
    ...(verifiedPrices[entry.id] || {}),
    ...(osmFacts[entry.id] || {}),
    category: override?.category || entry.category,
    type: override?.type || entry.type,
  })
}

const missingCoords = places.filter((p) => !placeCoordinates[p.id]).map((p) => p.id)
const pizzaSearch = filterAndSortRestaurants(places, { search: 'pizza' })
const pizzaCategory = filterAndSortRestaurants(places, { cuisineType: 'pizza' })
const cheapPizza = filterAndSortRestaurants(places, { cuisineType: 'pizza', maxBudget: '150' })
const levnaPizza = filterAndSortRestaurants(places, { search: 'levná pizza' })

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    places: places.length,
    verifiedPrices: places.filter((p) => hasVerifiedPrice(p)).length,
    estimates: places.filter((p) => hasEstimatePrice(p)).length,
    missingCoords: missingCoords.length,
    unknownCategory: places.filter((p) => p.category === 'neuvedeno').length,
    withOsmHours: places.filter((p) => p.osmOpeningHours).length,
    withOsmPhone: places.filter((p) => p.osmPhone).length,
    knownDuplicatePairs: KNOWN_DUPLICATE_PAIRS.length,
  },
  missingCoords,
  searchProbe: {
    qPizza: pizzaSearch.length,
    typePizza: pizzaCategory.length,
    typePizzaBudget150: cheapPizza.length,
    qLevnaPizza: levnaPizza.length,
  },
}

writeFileSync(
  new URL('../reports/catalog-quality-audit-etapa4.json', import.meta.url),
  JSON.stringify(report, null, 2),
)
console.log(JSON.stringify(report, null, 2))
