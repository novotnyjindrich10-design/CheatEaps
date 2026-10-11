import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'

function mapsNavigateUrl(restaurant) {
  const query =
    restaurant.mapsQuery ??
    [restaurant.name, restaurant.address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/nám\./g, 'namesti')
    .replace(/namesti/g, 'namesti')
    .replace(/[^a-z0-9]+/g, '')
}

function parseStreetHouse(address) {
  const text = String(address || '')
  const match = text.match(/^(.+?)\s+(\d[\w./-]*)/u)
  if (!match) return { street: text, house: '' }
  return { street: match[1], house: match[2] }
}

function addrKeyFromAddress(address) {
  const { street, house } = parseStreetHouse(address)
  return `${fold(street)}|${fold(house)}`
}

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function expectedCategoryFromOsmTags(tags) {
  const cuisine = String(tags.cuisine || '').toLowerCase()
  const amenity = tags.amenity
  if (cuisine.includes('vegan')) return 'veganske'
  if (cuisine.includes('vegetarian')) return 'vegetarianske'
  if (/pizza/.test(cuisine)) return 'pizza'
  if (/burger/.test(cuisine)) return 'burger'
  if (/kebab|doner|döner|gyros/.test(cuisine)) return 'kebab'
  if (/chinese|szechuan|sichuan/.test(cuisine)) return 'cina'
  if (/vietnamese|thai|japanese|sushi|asian|indian|korean|nepalese|noodle/.test(cuisine)) {
    return 'asijske'
  }
  if (/mexican|taco|burrito/.test(cuisine)) return 'mexiko'
  if (/ice_cream|dessert|pastry|cake/.test(cuisine) || amenity === 'ice_cream') return 'sladke'
  if (/healthy|salad/.test(cuisine)) return 'zdrave'
  if (/coffee|cafe|tea|teahouse|bubble_tea/.test(cuisine) || amenity === 'cafe') return 'kava'
  if (/czech|regional|local/.test(cuisine) || amenity === 'canteen') return 'ceske'
  if (amenity === 'fast_food' || amenity === 'food_court') return 'fastfood'
  if (amenity === 'restaurant') return ''
  return ''
}

function dietFromOsmTags(tags) {
  const cuisine = String(tags.cuisine || '')
  const vegan = tags['diet:vegan'] === 'yes' || cuisine.includes('vegan')
  const vegetarian =
    vegan || tags['diet:vegetarian'] === 'yes' || cuisine.includes('vegetarian')
  return { vegan, vegetarian }
}

const all = [
  ...curatedPlaces.map((p) => ({ ...p, source: 'curated' })),
  ...osmPlaces.map((p) => ({ ...p, source: 'osm' })),
]

const byId = new Map()
for (const p of all) {
  if (!byId.has(p.id)) byId.set(p.id, p)
}
const places = [...byId.values()]

let osmRaw = { elements: [] }
try {
  osmRaw = JSON.parse(readFileSync(new URL('../osm-brno-food.json', import.meta.url), 'utf8'))
} catch {
  osmRaw = { elements: [] }
}

const osmIndex = new Map()
for (const el of osmRaw.elements || []) {
  const t = el.tags || {}
  if (!t.name || !t['addr:street'] || !t['addr:housenumber']) continue
  const key = `${fold(t.name)}|${fold(t['addr:street'])}|${fold(t['addr:housenumber'])}`
  if (!osmIndex.has(key)) osmIndex.set(key, { el, tags: t })
}

function lookupOsm(place) {
  const { street, house } = parseStreetHouse(place.address)
  return osmIndex.get(`${fold(place.name)}|${fold(street)}|${fold(house)}`) || null
}

const issues = []
function addIssue(place, severity, code, note) {
  issues.push({
    id: place.id,
    name: place.name,
    address: place.address,
    source: place.source,
    category: place.category || '',
    type: place.type || '',
    website: place.website || '',
    severity,
    code,
    note,
  })
}

const idCounts = new Map()
for (const p of places) idCounts.set(p.id, (idCounts.get(p.id) || 0) + 1)
for (const [id, n] of idCounts) {
  if (n > 1) {
    const p = places.find((x) => x.id === id)
    addIssue(p, 'error', 'duplicate_id', `ID se opakuje ${n}×`)
  }
}

const missingCore = places.filter((p) => !p.id || !p.name || !p.address)
for (const p of missingCore) addIssue(p, 'error', 'missing_core', 'Chybí id, název nebo adresa')

const exactDupGroups = new Map()
const addrGroups = new Map()
const nameGroups = new Map()

for (const p of places) {
  const ek = `${fold(p.name)}|${addrKeyFromAddress(p.address)}`
  const ak = addrKeyFromAddress(p.address)
  const nk = fold(p.name)
  if (!exactDupGroups.has(ek)) exactDupGroups.set(ek, [])
  exactDupGroups.get(ek).push(p)
  if (!addrGroups.has(ak)) addrGroups.set(ak, [])
  addrGroups.get(ak).push(p)
  if (!nameGroups.has(nk)) nameGroups.set(nk, [])
  nameGroups.get(nk).push(p)
}

const exactDupIds = new Set()
for (const group of exactDupGroups.values()) {
  if (group.length > 1) {
    for (const p of group) {
      exactDupIds.add(p.id)
      addIssue(
        p,
        'error',
        'exact_duplicate',
        `Stejný název i adresa: ${group.map((g) => g.id).join(', ')}`,
      )
    }
  }
}

const probableAddrDupIds = new Set()
for (const group of addrGroups.values()) {
  if (group.length < 2) continue
  const uniqueNames = new Set(group.map((g) => fold(g.name)))
  if (uniqueNames.size === 1) continue
  const names = group.map((g) => g.name)
  const similar = names.some((a, i) =>
    names.some((b, j) => i < j && (fold(a).includes(fold(b)) || fold(b).includes(fold(a)))),
  )
  for (const p of group) {
    if (exactDupIds.has(p.id)) continue
    probableAddrDupIds.add(p.id)
    addIssue(
      p,
      similar ? 'warning' : 'info',
      similar ? 'probable_address_duplicate' : 'shared_address',
      `Stejná adresa, různé názvy: ${names.join(' | ')}`,
    )
  }
}

const branchNameIds = new Set()
for (const group of nameGroups.values()) {
  if (group.length < 2) continue
  const addrs = new Set(group.map((g) => addrKeyFromAddress(g.address)))
  if (addrs.size === 1) continue
  for (const p of group) {
    branchNameIds.add(p.id)
    addIssue(
      p,
      'info',
      'same_name_other_address',
      `Stejný název na ${group.length} adresách (pravděpodobně pobočky): ${[...addrs].length} adres`,
    )
  }
}

let withCoords = 0
const coordPairs = []
for (const p of places) {
  if (p.source !== 'osm') continue
  const hit = lookupOsm(p)
  const lat = hit?.el.lat ?? hit?.el.center?.lat
  const lon = hit?.el.lon ?? hit?.el.center?.lon
  if (typeof lat === 'number' && typeof lon === 'number') {
    withCoords++
    coordPairs.push({ p, lat, lon })
  }
}

function haversine(a, b) {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

const nearDupIds = new Set()
for (let i = 0; i < coordPairs.length; i += 1) {
  for (let j = i + 1; j < coordPairs.length; j += 1) {
    const a = coordPairs[i]
    const b = coordPairs[j]
    if (fold(a.p.name) !== fold(b.p.name)) continue
    const d = haversine(a, b)
    if (d < 40 && addrKeyFromAddress(a.p.address) !== addrKeyFromAddress(b.p.address)) {
      nearDupIds.add(a.p.id)
      nearDupIds.add(b.p.id)
      addIssue(
        a.p,
        'warning',
        'near_duplicate_coords',
        `Stejný název do 40 m od ${b.p.id} (${Math.round(d)} m)`,
      )
    }
  }
}

const noPostcode = []
const oddAddress = []
const trackingWebsite = []
const missingWebsite = []
const emptyCategory = []
const inventedPrice = []
const inventedRating = []
const mapsBroken = []
const noSourceHint = []
const categoryMismatch = []
const dietFromNameOnly = []
const dietDocumented = []
const suspiciousNonFood = []
const unusualName = []
const unverifiedExistence = []

const nonFoodRe =
  /\b(knihkupectví|kino\b|divadlo|fitness|posilovna|lékárna|lekarna|tabák|trafik|banka|pošta|škola|univerzita|kostel|farnost|muzeum|galerie umění)\b/i
const unusualNameRe = /^(\.\.\.|[0-9]+$|test\b|xxx|n\/a|provozovna|objekt)/i

for (const p of places) {
  if (!/\d{3}\s?\d{2}/.test(p.address)) noPostcode.push(p)
  if (!/\d/.test(p.address) || p.address.length < 10) {
    oddAddress.push(p)
    addIssue(p, 'warning', 'odd_address', 'Adresa je krátká nebo bez čísla')
  }
  if (!p.website) missingWebsite.push(p)
  if (p.website && /ved=|usg=|fbclid=|&amp;/.test(p.website)) {
    trackingWebsite.push(p)
    addIssue(p, 'info', 'messy_website', 'Web URL vypadá jako sledovací odkaz ze vyhledávání')
  }
  if (!p.category) emptyCategory.push(p)

  if (typeof p.price === 'number' && p.source === 'osm') {
    inventedPrice.push(p)
    addIssue(p, 'error', 'osm_has_price', 'OSM záznam má cenu, přestože generátor cenu nemá vkládat')
  }
  if (typeof p.rating === 'number') {
    inventedRating.push(p)
    addIssue(p, 'error', 'has_rating', 'V datech je hodnocení – nemělo se odhadovat')
  }
  if (typeof p.distance === 'number' && p.source === 'osm') {
    addIssue(p, 'error', 'osm_has_distance', 'OSM záznam má vzdálenost')
  }

  const maps = mapsNavigateUrl(p)
  if (!maps.startsWith('https://www.google.com/maps/search/?api=1&query=')) {
    mapsBroken.push(p)
    addIssue(p, 'error', 'bad_maps_url', maps)
  } else {
    const decoded = decodeURIComponent(maps.split('query=')[1] || '')
    if (!decoded.includes(p.name) || !decoded.includes(String(p.address || '').split(',')[0])) {
      mapsBroken.push(p)
      addIssue(p, 'warning', 'maps_query_mismatch', decoded)
    }
  }

  if (p.source === 'osm' && !/OpenStreetMap/i.test(p.description || '')) {
    noSourceHint.push(p)
    addIssue(p, 'warning', 'missing_source_text', 'OSM záznam nemá v popisu uvedeny zdroj')
  }
  if (p.source === 'curated' && !p.website) {
    addIssue(p, 'info', 'curated_no_website', 'Curated záznam bez webu')
  }

  if (nonFoodRe.test(p.name)) {
    suspiciousNonFood.push(p)
    addIssue(p, 'warning', 'possible_non_food', 'Název evokuje jiný typ provozu než jídlo (pouhé podezření)')
  }
  if (unusualNameRe.test(p.name) || p.name.length < 3) {
    unusualName.push(p)
    addIssue(p, 'info', 'unusual_name', 'Neobvyklý nebo velmi krátký název')
  }

  if (p.source === 'osm') {
    const hit = lookupOsm(p)
    if (!hit) {
      unverifiedExistence.push(p)
      addIssue(
        p,
        'info',
        'osm_match_missing',
        'Nepodařilo se zpětně spárovat s raw OSM JSON (mohlo jít o změnu normalizace, ne o neexistenci)',
      )
    } else {
      const expected = expectedCategoryFromOsmTags(hit.tags)
      if ((p.category || '') !== expected) {
        categoryMismatch.push({ p, expected, cuisine: hit.tags.cuisine, amenity: hit.tags.amenity })
        addIssue(
          p,
          'warning',
          'category_vs_osm_tags',
          `Kategorie v DB="${p.category || '(prázdná)'}", z OSM tagů bez názvu="${expected || '(prázdná)'}" (amenity=${hit.tags.amenity || ''}, cuisine=${hit.tags.cuisine || ''})`,
        )
      }
      const dietTags = dietFromOsmTags(hit.tags)
      if (p.vegetarianFriendly && !dietTags.vegetarian) {
        dietFromNameOnly.push(p)
        addIssue(
          p,
          'warning',
          'diet_not_from_osm_tags',
          'vegetarianFriendly=true, ale OSM nemá diet:vegetarian/vegan ani cuisine vegetarian/vegan',
        )
      }
      if (p.veganFriendly && !dietTags.vegan) {
        dietFromNameOnly.push(p)
        addIssue(
          p,
          'warning',
          'diet_not_from_osm_tags',
          'veganFriendly=true, ale OSM nemá diet:vegan ani cuisine vegan',
        )
      }
      if (p.vegetarianFriendly && dietTags.vegetarian) dietDocumented.push(p)
    }
  } else if (p.vegetarianFriendly || p.veganFriendly) {
    dietDocumented.push(p)
  }
}

const curatedWithPrice = curatedPlaces.filter((p) => typeof p.price === 'number')
const osmWithPrice = osmPlaces.filter((p) => typeof p.price === 'number')
const withDiet = places.filter((p) => p.vegetarianFriendly || p.veganFriendly)
const withDietOsmTags = dietDocumented
const withDietNameOnly = [...new Set(dietFromNameOnly.map((p) => p.id))]

const summary = {
  total: places.length,
  uniqueIds: new Set(places.map((p) => p.id)).size,
  curated: places.filter((p) => p.source === 'curated').length,
  osm: places.filter((p) => p.source === 'osm').length,
  osmRawLoaded: (osmRaw.elements || []).length > 0,
  withCoords,
  exactDuplicates: exactDupIds.size,
  probableAddressDuplicates: probableAddrDupIds.size,
  sameNameOtherAddress: branchNameIds.size,
  nearDuplicateCoords: nearDupIds.size,
  missingCore: missingCore.length,
  noPostcode: noPostcode.length,
  oddAddress: oddAddress.length,
  missingWebsite: missingWebsite.length,
  trackingWebsite: trackingWebsite.length,
  emptyCategory: emptyCategory.length,
  categoryMismatchVsOsmTags: categoryMismatch.length,
  documentedPrice: curatedWithPrice.length + osmWithPrice.length,
  curatedPrice: curatedWithPrice.length,
  osmPrice: osmWithPrice.length,
  documentedRating: places.filter((p) => typeof p.rating === 'number').length,
  documentedDistance: places.filter((p) => typeof p.distance === 'number').length,
  documentedDietFlags: withDiet.length,
  dietFromOsmOrOfficial: withDietOsmTags.length,
  dietPossiblyFromName: withDietNameOnly.length,
  suspiciousNonFood: suspiciousNonFood.length,
  unusualName: unusualName.length,
  unverifiedExistence: unverifiedExistence.length,
  mapsBroken: mapsBroken.length,
  noSourceHint: noSourceHint.length,
  issueCounts: issues.reduce((acc, i) => {
    acc[i.severity] = (acc[i.severity] || 0) + 1
    return acc
  }, {}),
}

mkdirSync(new URL('../reports', import.meta.url), { recursive: true })
writeFileSync(
  new URL('../reports/audit-summary.json', import.meta.url),
  JSON.stringify(summary, null, 2),
  'utf8',
)

const header = [
  'severity',
  'code',
  'id',
  'name',
  'address',
  'source',
  'category',
  'type',
  'website',
  'note',
]
const csvLines = [
  header.join(','),
  ...issues.map((i) =>
    [
      i.severity,
      i.code,
      i.id,
      csvEscape(i.name),
      csvEscape(i.address),
      i.source,
      i.category,
      csvEscape(i.type),
      csvEscape(i.website),
      csvEscape(i.note),
    ].join(','),
  ),
]
writeFileSync(new URL('../reports/audit-places.csv', import.meta.url), csvLines.join('\n'), 'utf8')

const overviewHeader = [
  'id',
  'source',
  'name',
  'address',
  'category',
  'type',
  'website',
  'price',
  'vegetarianFriendly',
  'veganFriendly',
  'hasPostcode',
]
writeFileSync(
  new URL('../reports/places-overview.csv', import.meta.url),
  [
    overviewHeader.join(','),
    ...places.map((p) =>
      [
        p.id,
        p.source,
        csvEscape(p.name),
        csvEscape(p.address),
        p.category || '',
        csvEscape(p.type || ''),
        csvEscape(p.website || ''),
        p.price ?? '',
        p.vegetarianFriendly ? '1' : '',
        p.veganFriendly ? '1' : '',
        /\d{3}\s?\d{2}/.test(p.address) ? '1' : '',
      ].join(','),
    ),
  ].join('\n'),
  'utf8',
)

console.log(JSON.stringify(summary, null, 2))
console.log('issues', issues.length)
console.log('wrote reports/audit-places.csv, reports/places-overview.csv, reports/audit-summary.json')
