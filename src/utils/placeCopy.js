import { getCategoryMeta } from '../constants/filters'

const CUISINE_CS = {
  pizza: 'pizzu',
  burger: 'burgery',
  kebab: 'kebab',
  doner: 'kebab',
  gyros: 'gyros',
  chinese: 'čínskou kuchyni',
  vietnamese: 'vietnamskou kuchyni',
  thai: 'thajskou kuchyni',
  japanese: 'japonskou kuchyni',
  sushi: 'sushi',
  asian: 'asijskou kuchyni',
  indian: 'indickou kuchyni',
  korean: 'korejskou kuchyni',
  nepalese: 'nepálskou kuchyni',
  noodle: 'nudle',
  ramen: 'ramen',
  mexican: 'mexickou kuchyni',
  taco: 'taca',
  burrito: 'burrita',
  italian: 'italskou kuchyni',
  czech: 'českou kuchyni',
  regional: 'regionální kuchyni',
  local: 'místní kuchyni',
  coffee: 'kávu',
  cafe: 'kávu',
  tea: 'čaj',
  ice_cream: 'zmrzlinu',
  dessert: 'dezerty',
  pastry: 'cukrářské výrobky',
  cake: 'zákusky',
  sandwich: 'sendviče',
  chicken: 'kuřecí jídla',
  salad: 'saláty',
  vegetarian: 'vegetariánskou kuchyni',
  vegan: 'veganskou kuchyni',
  healthy: 'lehčí jídla',
  breakfast: 'snídaně',
  pancake: 'lívance',
  waffle: 'vafle',
  greek: 'řeckou kuchyni',
  turkish: 'tureckou kuchyni',
  american: 'americkou kuchyni',
  french: 'francouzskou kuchyni',
  steak: 'steaky',
  seafood: 'mořské plody',
  fish: 'ryby',
  barbecue: 'grilovaná jídla',
  bistro: 'bistro kuchyni',
}

const AMENITY_KIND = {
  cafe: 'kavárna',
  restaurant: 'restaurace',
  fast_food: 'rychlé občerstvení',
  ice_cream: 'zmrzlinárna nebo cukrárna',
  canteen: 'jídelna',
  food_court: 'stánek v food courtu',
  pub: 'hospoda s jídlem',
  bar: 'bar s občerstvením',
}

function uniqueJoin(parts) {
  return parts.filter(Boolean).join(' ')
}

export function streetLine(address) {
  return String(address || '').split(',')[0]?.trim() || ''
}

export function venueKind(restaurant) {
  const amenity = restaurant.osmAmenity
  if (amenity && AMENITY_KIND[amenity]) return AMENITY_KIND[amenity]
  const type = String(restaurant.type || '').toLowerCase()
  if (type.includes('kavár')) return 'kavárna'
  if (type.includes('bistro')) return 'bistro'
  if (type.includes('pizza')) return 'pizzerie'
  if (type.includes('cukr') || type.includes('slad')) return 'cukrárna'
  if (type.includes('fast')) return 'rychlé občerstvení'
  if (type.includes('jídel')) return 'jídelna'
  if (restaurant.category === 'kava') return 'kavárna'
  if (restaurant.category === 'fastfood') return 'rychlé občerstvení'
  if (restaurant.category === 'sladke') return 'sladký podnik'
  if (restaurant.type && restaurant.type !== 'Neuvedeno' && restaurant.type !== 'Restaurace') {
    return String(restaurant.type).toLowerCase()
  }
  return 'stravovací podnik'
}

function parseOsmCuisine(restaurant) {
  if (restaurant.osmCuisine) return String(restaurant.osmCuisine)
  const match = String(restaurant.description || '').match(/Kuchyně dle OSM:\s*([^.]+)/i)
  return match ? match[1].trim() : ''
}

export function cuisineFocus(restaurant) {
  const raw = parseOsmCuisine(restaurant)
  if (!raw) return ''
  const parts = raw
    .split(/[;,/]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
  const shown = []
  const seen = new Set()
  for (const part of parts) {
    const label = CUISINE_CS[part] || (part.length > 2 && !/^[a-z_]+$/.test(part) ? part : '')
    if (!label || seen.has(label)) continue
    seen.add(label)
    shown.push(label)
  }
  if (!shown.length) return ''
  if (shown.length === 1) return shown[0]
  return `${shown.slice(0, -1).join(', ')} a ${shown.at(-1)}`
}

export function studentFacts(restaurant) {
  const facts = []
  const seen = new Set()
  const add = (key, label) => {
    const n = String(label).trim().toLowerCase()
    if (!n || seen.has(n)) return
    seen.add(n)
    facts.push({ key, label })
  }
  if (restaurant.veganFriendly) add('vegan', 'Veganské')
  else if (restaurant.vegetarianFriendly) add('veg', 'Vegetariánské')
  const kind = venueKind(restaurant)
  if (!/vegan|vegetari/i.test(kind)) {
    add('kind', kind.charAt(0).toUpperCase() + kind.slice(1))
  }
  const cat = getCategoryMeta(restaurant.category)
  if (cat && restaurant.category !== 'neuvedeno' && cat.value !== 'veganske' && cat.value !== 'vegetarianske') {
    add('cat', cat.label)
  }
  if (restaurant.glutenFree) add('gf', 'Bezlepkové dle OSM')
  if (restaurant.lunchMenu) add('lunch', 'Polední menu dle OSM')
  return facts
}

function curatedLead(restaurant) {
  const text = String(restaurant.description || '').trim()
  if (!text || text.startsWith('Záznam z OpenStreetMap')) return ''
  return text
}

export function buildDetailParagraphs(restaurant) {
  const name = restaurant.name
  const street = streetLine(restaurant.address)
  const kind = venueKind(restaurant)
  const cuisine = cuisineFocus(restaurant)
  const paras = []
  const lead = curatedLead(restaurant)
  if (lead) paras.push(lead)

  const location = street
    ? `${name} najdete na adrese ${restaurant.address}.`
    : `${name} je evidovaný brněnský podnik.`
  const kindSentence = cuisine
    ? `Jde o ${kind} se zaměřením na ${cuisine}.`
    : `Jde o ${kind}.`
  if (!lead) paras.push(uniqueJoin([location, kindSentence]))
  else paras.push(uniqueJoin([location, !lead.toLowerCase().includes(kind) ? kindSentence : '']))

  const extras = []
  const alreadyDiet = paras.some((p) => /vegetari|vegan/i.test(p))
  if (restaurant.vegetarianInfo && !alreadyDiet) {
    extras.push(restaurant.vegetarianInfo)
  } else if (!alreadyDiet && restaurant.veganFriendly) {
    extras.push('Podle dostupných údajů je podnik vegansky vstřícný.')
  } else if (!alreadyDiet && restaurant.vegetarianFriendly) {
    extras.push('Podle dostupných údajů má vegetariánskou nabídku.')
  }
  if (restaurant.glutenFree) {
    extras.push('V OpenStreetMap je u podniku vyznačená bezlepková nabídka (diet:gluten_free).')
  }
  if (restaurant.lunchMenu) {
    extras.push('V OpenStreetMap je u podniku vyznačené polední menu.')
  }
  if (extras.length) paras.push(extras.join(' '))

  return paras.filter(Boolean)
}

export function cardExcerpt(restaurant, maxLen = 170) {
  const lead = curatedLead(restaurant)
  const text = lead || buildDetailParagraphs(restaurant)[0] || restaurant.name
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen - 1)
  const at = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(', '), cut.lastIndexOf(' '))
  return `${(at > 80 ? cut.slice(0, at) : cut).trim()}…`
}
