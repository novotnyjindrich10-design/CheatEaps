import { readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces as previousOsmPlaces } from '../src/data/osmPlaces.js'

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/nám\./g, 'namesti')
    .replace(/namesti/g, 'namesti')
    .replace(/[^a-z0-9]+/g, '')
}

function slug(value) {
  const s = String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s.slice(0, 72) || 'misto'
}

function addrKey(street, house) {
  return `${fold(street)}|${fold(house)}`
}

function parseStreetHouse(address) {
  const text = String(address || '')
  const match = text.match(/^(.+?)\s+(\d[\w/-]*)/u)
  if (!match) return { street: text, house: '' }
  return { street: match[1], house: match[2] }
}

function classifyFromCuisine(cuisine) {
  const c = String(cuisine || '').toLowerCase()
  if (!c.trim()) return null
  if (/pizza/.test(c)) return { type: 'Pizza', category: 'pizza' }
  if (/burger/.test(c)) return { type: 'Burger', category: 'burger' }
  if (/kebab|doner|döner|gyros/.test(c)) return { type: 'Kebab', category: 'kebab' }
  if (/chinese|szechuan|sichuan/.test(c)) return { type: 'Čína', category: 'cina' }
  if (
    /vietnamese|thai|japanese|sushi|asian|indian|korean|nepalese|noodle|ramen/.test(c)
  ) {
    return { type: 'Asijské', category: 'asijske' }
  }
  if (/mexican|taco|burrito/.test(c)) return { type: 'Mexiko', category: 'mexiko' }
  if (/ice_cream|dessert|pastry|cake|pancake|waffle|crepe/.test(c)) {
    return { type: 'Sladké', category: 'sladke' }
  }
  if (/healthy|salad/.test(c)) return { type: 'Zdravé', category: 'zdrave' }
  if (/coffee|cafe|tea|teahouse|bubble_tea/.test(c)) return { type: 'Kavárna', category: 'kava' }
  if (/czech|regional|local/.test(c)) return { type: 'České', category: 'ceske' }
  if (/sandwich|chicken|fried/.test(c)) return { type: 'Fast food', category: 'fastfood' }
  return null
}

function classify(tags) {
  const fromCuisine = classifyFromCuisine(tags.cuisine)
  if (fromCuisine) return fromCuisine

  const amenity = tags.amenity
  if (amenity === 'ice_cream') return { type: 'Sladké', category: 'sladke' }
  if (amenity === 'cafe') return { type: 'Kavárna', category: 'kava' }
  if (amenity === 'fast_food' || amenity === 'food_court') {
    return { type: 'Fast food', category: 'fastfood' }
  }
  if (amenity === 'canteen') return { type: 'Jídelna', category: 'neuvedeno' }
  if (amenity === 'restaurant') return { type: 'Restaurace', category: 'neuvedeno' }
  return { type: 'Neuvedeno', category: 'neuvedeno' }
}

const osm = JSON.parse(readFileSync(new URL('../osm-brno-food.json', import.meta.url), 'utf8'))

const curatedKeys = curatedPlaces.map((p) => {
  const { street, house } = parseStreetHouse(p.address)
  return { name: fold(p.name), addr: addrKey(street, house) }
})

function isCuratedDuplicate(name, street, house) {
  const n = fold(name)
  const a = addrKey(street, house)
  return curatedKeys.some((c) => c.addr === a && (c.name.includes(n) || n.includes(c.name) || n === c.name))
}

const seenAddrName = new Set()
const usedIds = new Set(curatedPlaces.map((p) => p.id))
const places = []
const skipped = { incomplete: 0, city: 0, closed: 0, curated: 0, dup: 0, name: 0 }

for (const el of osm.elements || []) {
  const t = el.tags || {}
  const name = (t.name || '').trim()
  const street = (t['addr:street'] || '').trim()
  const house = (t['addr:housenumber'] || '').trim()
  if (!name || !street || !house) {
    skipped.incomplete++
    continue
  }
  if (name.length < 2 || /^[?x._-]+$/i.test(name)) {
    skipped.name++
    continue
  }
  if (t.disused === 'yes' || t.abandoned === 'yes' || t['disused:amenity'] || t.opening_hours === 'closed') {
    skipped.closed++
    continue
  }
  const city = (t['addr:city'] || '').trim()
  if (city && !/brno/i.test(city)) {
    skipped.city++
    continue
  }
  if (isCuratedDuplicate(name, street, house)) {
    skipped.curated++
    continue
  }

  const dupKey = `${fold(name)}|${addrKey(street, house)}`
  if (seenAddrName.has(dupKey)) {
    skipped.dup++
    continue
  }
  seenAddrName.add(dupKey)

  const postcode = (t['addr:postcode'] || '').trim()
  const cityLabel = city || 'Brno'
  const address = [street, house].join(' ') + `, ${postcode ? `${postcode} ` : ''}${cityLabel}`.replace('  ', ' ')

  const { type, category } = classify(t)
  let id = slug(`${name}-${street}-${house}`)
  let n = 2
  while (usedIds.has(id)) {
    id = `${slug(`${name}-${street}-${house}`)}-${n}`
    n += 1
  }
  usedIds.add(id)

  const amenityCs = {
    cafe: 'kavárna',
    restaurant: 'restaurace',
    fast_food: 'rychlé občerstvení',
    ice_cream: 'zmrzlina / sladké',
    canteen: 'jídelna',
    food_court: 'food court',
  }[t.amenity] || 'podnik s jídlem'

  const bits = [`Záznam z OpenStreetMap (${amenityCs}).`]
  if (t.cuisine) bits.push(`Kuchyně dle OSM: ${t.cuisine}.`)

  const website = (t.website || t['contact:website'] || '').trim()
  const vegan = t['diet:vegan'] === 'yes' || String(t.cuisine || '').includes('vegan')
  const vegetarian =
    vegan || t['diet:vegetarian'] === 'yes' || String(t.cuisine || '').includes('vegetarian')

  const row = {
    id,
    name,
    description: bits.join(' '),
    type,
    category,
    address,
  }
  if (website.startsWith('http')) row.website = website
  if (vegetarian) row.vegetarianFriendly = true
  if (vegan) row.veganFriendly = true
  if (vegan) row.vegetarianInfo = 'V OpenStreetMap je u podniku vyznačená veganská nabídka (diet:vegan / cuisine).'
  else if (vegetarian) {
    row.vegetarianInfo = 'V OpenStreetMap je u podniku vyznačená vegetariánská nabídka (diet:vegetarian / cuisine).'
  }

  places.push(row)
}

places.sort((a, b) => a.name.localeCompare(b.name, 'cs'))

const prevById = new Map(previousOsmPlaces.map((p) => [p.id, p]))
const nextIds = places.map((p) => p.id)
const prevIds = previousOsmPlaces.map((p) => p.id)
const missingIds = prevIds.filter((id) => !nextIds.includes(id))
const extraIds = nextIds.filter((id) => !prevById.has(id))
if (missingIds.length || extraIds.length || places.length !== previousOsmPlaces.length) {
  console.error({
    error: 'Generátor by změnil sadu OSM záznamů nebo ID. Soubor osmPlaces.js se nezapisuje.',
    previous: previousOsmPlaces.length,
    generated: places.length,
    missingIds,
    extraIds,
  })
  process.exit(1)
}

let categoryChanged = 0
for (const p of places) {
  const prev = prevById.get(p.id)
  if (
    prev.name !== p.name ||
    prev.address !== p.address ||
    (prev.website || '') !== (p.website || '') ||
    Boolean(prev.vegetarianFriendly) !== Boolean(p.vegetarianFriendly) ||
    Boolean(prev.veganFriendly) !== Boolean(p.veganFriendly)
  ) {
    console.error({
      error: 'Generátor by změnil název, adresu, web nebo dietní příznaky.',
      id: p.id,
    })
    process.exit(1)
  }
  if (prev.category !== p.category) categoryChanged += 1
}

const header = `/** Auto-generated from OpenStreetMap Overpass. Regeneruj: node scripts/generate-osm-places.mjs */
export const osmPlaces = `

writeFileSync(
  new URL('../src/data/osmPlaces.js', import.meta.url),
  `${header}${JSON.stringify(places, null, 2)}\n`,
  'utf8',
)

console.log({
  generated: places.length,
  withCurated: places.length + curatedPlaces.length,
  categoryChanged,
  unknownCategory: places.filter((p) => p.category === 'neuvedeno').length,
  skipped,
})
