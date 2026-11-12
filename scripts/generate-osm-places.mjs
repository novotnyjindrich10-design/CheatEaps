import { readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces as previousOsmPlaces } from '../src/data/osmPlaces.js'
import { extractOsmContact } from '../src/utils/osmContact.js'
import { classifyOsmTags } from '../src/utils/cuisineClassify.js'

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

function classify(tags) {
  return classifyOsmTags({ cuisine: tags.cuisine, amenity: tags.amenity })
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

  // Popisek podle výsledné kategorie (cuisine má přednost před amenity=cafe).
  const amenityCs =
    {
      pizza: 'pizzerie',
      burger: 'burger restaurace',
      kebab: 'kebab',
      cina: 'čínská restaurace',
      asijske: 'asijská restaurace',
      mexiko: 'mexická restaurace',
      sladke: 'sladké / cukrárna',
      zdrave: 'zdravé bistro',
      kava: 'kavárna',
      ceske: 'česká restaurace',
      fastfood: 'rychlé občerstvení',
      neuvedeno: t.amenity === 'canteen' ? 'jídelna' : 'restaurace',
    }[category] ||
    {
      cafe: 'kavárna',
      restaurant: 'restaurace',
      fast_food: 'rychlé občerstvení',
      ice_cream: 'zmrzlina / sladké',
      canteen: 'jídelna',
      food_court: 'food court',
    }[t.amenity] ||
    'podnik s jídlem'

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

  const contact = extractOsmContact(t)
  if (contact.osmOpeningHours) {
    row.osmOpeningHours = contact.osmOpeningHours
    row.osmOpeningHoursDisplay = contact.osmOpeningHoursDisplay
  }
  if (contact.osmPhone) {
    row.osmPhone = contact.osmPhone
    row.osmPhoneTel = contact.osmPhoneTel
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

// Zachovej existující záznamy (včetně category overrides) a jen doplň OSM kontakt.
const freshById = new Map(places.map((p) => [p.id, p]))
const merged = previousOsmPlaces.map((prev) => {
  const fresh = freshById.get(prev.id)
  const next = { ...prev }
  delete next.osmOpeningHours
  delete next.osmOpeningHoursDisplay
  delete next.osmPhone
  delete next.osmPhoneTel
  if (!fresh) return next
  if (fresh.osmOpeningHours) {
    next.osmOpeningHours = fresh.osmOpeningHours
    next.osmOpeningHoursDisplay = fresh.osmOpeningHoursDisplay
  }
  if (fresh.osmPhone) {
    next.osmPhone = fresh.osmPhone
    next.osmPhoneTel = fresh.osmPhoneTel
  }
  return next
})

const header = `/** Auto-generated from OpenStreetMap Overpass. Regeneruj: node scripts/generate-osm-places.mjs */
export const osmPlaces = `

writeFileSync(
  new URL('../src/data/osmPlaces.js', import.meta.url),
  `${header}${JSON.stringify(merged, null, 2)}\n`,
  'utf8',
)

console.log({
  generated: places.length,
  withCurated: places.length + curatedPlaces.length,
  categoryChanged,
  unknownCategory: places.filter((p) => p.category === 'neuvedeno').length,
  withOpeningHours: merged.filter((p) => p.osmOpeningHours).length,
  withPhone: merged.filter((p) => p.osmPhone).length,
  skipped,
})
