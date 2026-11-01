import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { verifiedPrices } from '../src/data/verifiedPrices.js'
import { estimatedPrices } from '../src/data/estimatedPrices.js'
import { officialWebsites } from '../src/data/officialWebsites.js'
import { placeCoordinates } from '../src/data/placeCoordinates.js'
import { hasEstimatePrice, hasVerifiedPrice } from '../src/utils/price.js'
import { isInBrnoBounds } from '../src/utils/geo.js'

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const seen = new Set()
const places = []
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(entry.id)) continue
  seen.add(entry.id)
  places.push(entry)
}

const merged = places.map((entry) => ({
  ...entry,
  ...(estimatedPrices[entry.id] || {}),
  ...(verifiedPrices[entry.id] || {}),
  ...(officialWebsites[entry.id] || {}),
  ...(placeCoordinates[entry.id] || {}),
}))

const verified = merged.filter(hasVerifiedPrice)
const estimates = merged.filter(hasEstimatePrice)
const neither = merged.filter((r) => !hasVerifiedPrice(r) && !hasEstimatePrice(r))
const both = merged.filter((r) => verifiedPrices[r.id] && estimatedPrices[r.id])

const inconsistent = merged.filter((r) => {
  if (typeof r.price !== 'number' || typeof r.priceMax !== 'number') return false
  return r.priceMax < r.price
})

const estimatePretend = Object.entries(estimatedPrices).filter(
  ([, row]) => row.priceSource || row.priceVerifiedAt || row.priceKind !== 'estimate',
)

const verifiedIncomplete = Object.keys(verifiedPrices).filter((id) => {
  const row = merged.find((r) => r.id === id)
  return !row || !hasVerifiedPrice(row)
})

const byName = new Map()
for (const r of merged) {
  const key = fold(r.name)
  if (!byName.has(key)) byName.set(key, [])
  byName.get(key).push(r)
}

function addrKey(address) {
  return fold(address).replace(/[^a-z0-9]+/g, '')
}

const sameName = []
for (const [name, rows] of byName) {
  if (rows.length < 2) continue
  sameName.push({
    name,
    places: rows.map((r) => ({
      id: r.id,
      address: r.address,
      lat: r.lat ?? null,
      lon: r.lon ?? null,
      category: r.category,
      curated: Boolean(r.curated),
    })),
  })
}

const focusNames = ['franz', 'stopkova', 'caipl', 'monogram']
const focus = merged
  .filter((r) => focusNames.some((n) => fold(r.name).includes(n) || r.id.includes(n)))
  .map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    lat: r.lat ?? null,
    lon: r.lon ?? null,
    category: r.category,
    curated: Boolean(r.curated),
    priceKind: r.priceKind,
    price: r.price,
    priceMax: r.priceMax ?? null,
    priceSource: r.priceSource ?? null,
    vegetarianFriendly: Boolean(r.vegetarianFriendly),
    veganFriendly: Boolean(r.veganFriendly),
  }))

const missingCoords = merged.filter((r) => typeof r.lat !== 'number' || typeof r.lon !== 'number')
const outside = merged.filter(
  (r) => typeof r.lat === 'number' && typeof r.lon === 'number' && !isInBrnoBounds(r.lat, r.lon),
)
const missingId = merged.filter((r) => !r.id || !r.name || !r.address)

const diet = {
  vegetarianOnlyFlag: merged.filter((r) => r.vegetarianFriendly && !r.veganFriendly).length,
  veganFlag: merged.filter((r) => r.veganFriendly).length,
  veganWithoutVegetarian: merged.filter((r) => r.veganFriendly && !r.vegetarianFriendly).length,
  vegetarianCategory: merged.filter((r) => r.category === 'vegetarianske').length,
  veganCategory: merged.filter((r) => r.category === 'veganske').length,
  vegetarianFlagNotSpecialist: merged
    .filter(
      (r) =>
        r.vegetarianFriendly &&
        !r.veganFriendly &&
        r.category !== 'vegetarianske' &&
        r.category !== 'veganske',
    )
    .map((r) => ({ id: r.id, name: r.name, category: r.category })),
  veganFlagNotSpecialist: merged
    .filter((r) => r.veganFriendly && r.category !== 'veganske')
    .map((r) => ({ id: r.id, name: r.name, category: r.category })),
}

const mcdonald = merged
  .filter((r) => /mcdonald/i.test(r.name))
  .map((r) => ({
    id: r.id,
    address: r.address,
    category: r.category,
    vegetarianFriendly: Boolean(r.vegetarianFriendly),
    veganFriendly: Boolean(r.veganFriendly),
    vegetarianInfo: r.vegetarianInfo || '',
    priceKind: r.priceKind,
    price: r.price,
    priceItem: r.priceItem || null,
    priceSource: r.priceSource || null,
  }))

const sources = verified.map((r) => r.priceSource)
const uniqueSources = new Set(sources)
const httpSources = verified.filter((r) => String(r.priceSource).startsWith('http://'))

const official = merged.filter((r) => r.officialWebsite || r.website)
const unusedSites = official
  .filter((r) => !verifiedPrices[r.id])
  .map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    url: r.officialWebsite || r.website,
  }))

const sameNameAndAddr = []
for (const group of sameName) {
  const keys = group.places.map((p) => addrKey(p.address))
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i)
  if (dupKeys.length) sameNameAndAddr.push(group)
}

const summary = {
  total: merged.length,
  verified: verified.length,
  verifiedMenu: verified.filter((r) => r.priceKind === 'menu').length,
  verifiedRange: verified.filter((r) => r.priceKind === 'range').length,
  estimates: estimates.length,
  neither: neither.length,
  overlayBoth: both.map((r) => r.id),
  verifiedIds: Object.keys(verifiedPrices).length,
  estimateIds: Object.keys(estimatedPrices).length,
  inconsistentRanges: inconsistent.map((r) => ({
    id: r.id,
    price: r.price,
    priceMax: r.priceMax,
    kind: r.priceKind,
  })),
  estimatePretend: estimatePretend.map(([id]) => id),
  verifiedIncomplete,
  missingId: missingId.map((r) => r.id),
  missingCoords: missingCoords.map((r) => ({ id: r.id, name: r.name, address: r.address })),
  outside: outside.map((r) => ({ id: r.id, name: r.name, lat: r.lat, lon: r.lon })),
  sameNameCount: sameName.length,
  sameNameAndAddr,
  focus,
  dietCounts: {
    vegetarianOnlyFlag: diet.vegetarianOnlyFlag,
    veganFlag: diet.veganFlag,
    veganWithoutVegetarian: diet.veganWithoutVegetarian,
    vegetarianCategory: diet.vegetarianCategory,
    veganCategory: diet.veganCategory,
    vegetarianFlagNotSpecialist: diet.vegetarianFlagNotSpecialist.length,
    veganFlagNotSpecialist: diet.veganFlagNotSpecialist.length,
  },
  mcdonald,
  uniquePriceSources: uniqueSources.size,
  httpSources: httpSources.map((r) => ({ id: r.id, source: r.priceSource })),
  unusedOfficialSites: unusedSites.length,
}

console.log(JSON.stringify(summary, null, 2))
console.error('---DIET NON SPECIALIST VEG---')
console.error(JSON.stringify(diet.vegetarianFlagNotSpecialist.slice(0, 40), null, 2))
console.error('---VEGAN NON SPECIALIST---')
console.error(JSON.stringify(diet.veganFlagNotSpecialist, null, 2))
console.error('---SAME NAME---')
console.error(
  JSON.stringify(
    sameName.map((g) => ({
      name: g.name,
      n: g.places.length,
      places: g.places.map((p) => `${p.id} | ${p.address}`),
    })),
    null,
    2,
  ),
)
