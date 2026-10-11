import { writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { verifiedPrices } from '../src/data/verifiedPrices.js'
import { derivePriceCategory } from '../src/utils/price.js'

const seen = new Set()
const places = []
for (const r of [...curatedPlaces, ...osmPlaces]) {
  if (seen.has(r.id)) continue
  seen.add(r.id)
  places.push(r)
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function hash(id) {
  let h = 0
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

function jitter(id, step = 5) {
  return (hash(id) % 5) * step
}

function band(id, min, max, extra = 0) {
  const j = jitter(id) + extra
  const lo = min + j
  const hi = max + j
  return { min: lo, max: Math.max(lo + 30, hi) }
}

function isCenter(address) {
  return /602\s?00/.test(address || '')
}

function estimateFor(place) {
  const name = fold(place.name)
  const type = fold(place.type)
  const cat = place.category || ''
  const desc = fold(place.description)
  const hay = `${name} ${type} ${desc}`
  const extra = isCenter(place.address) ? 10 : 0

  if (place.id === 'rebio-velky-spalicek' || place.id === 'rebio-orli') {
    return {
      min: 132,
      max: 176,
      confidence: 'medium',
      item: 'orientační porce podle váhy',
      note: 'Oficiální ceník Rebio uvádí 43,90 Kč / 100 g. Rozpětí je odhad pro porci 300–400 g, ne cena konkrétního jídla.',
    }
  }
  if (place.id === 'dhaba-beas-panska') {
    return {
      min: 120,
      max: 200,
      confidence: 'medium',
      item: 'orientační porce podle váhy',
      note: 'Dhaba Beas účtuje podle váhy. Rozpětí je odhad běžné porce, ne ověřená položka z menu.',
    }
  }

  if (/\bmcdonald/.test(name)) {
    return {
      ...band(place.id, 99, 149, extra),
      confidence: 'medium',
      item: 'běžný burger',
      note: 'Odhad pro brněnský McDonald’s. Ceník této pobočky není ověřený; nepřevádíme cenu z Masarykovy.',
    }
  }
  if (/\bkfc\b/.test(name)) {
    return {
      ...band(place.id, 99, 159, extra),
      confidence: 'medium',
      item: 'kuřecí menu',
      note: 'Odhad pro KFC v Brně. Pobočkový ceník se nepodařilo otevřít v HTML.',
    }
  }
  if (/burger king/.test(name)) {
    return {
      ...band(place.id, 89, 149, extra),
      confidence: 'medium',
      item: 'běžný burger',
      note: 'Odhad pro Burger King v Brně. Oficiální HTML menu neobsahovalo cenu.',
    }
  }
  if (/\bsubway\b/.test(name)) {
    return {
      ...band(place.id, 99, 169, extra),
      confidence: 'medium',
      item: 'sendvič / wrap',
      note: 'Odhad pro Subway. Cena konkrétní pobočky není ověřená.',
    }
  }
  if (/bageterie boulevard/.test(name)) {
    return {
      ...band(place.id, 99, 169, extra),
      confidence: 'medium',
      item: 'bageta',
      note: 'Odhad pro Bageterii Boulevard. Pobočková stránka cenu v HTML neuvádí.',
    }
  }
  if (/\bstarbucks\b/.test(name)) {
    return {
      ...band(place.id, 79, 139, extra),
      confidence: 'medium',
      item: 'káva s malým jídlem',
      note: 'Odhad pro kavárnu řetězce. Nejde o ověřenou položku z ceníku pobočky.',
    }
  }
  if (/\bugo\b/.test(name)) {
    return {
      ...band(place.id, 89, 149, extra),
      confidence: 'medium',
      item: 'salát / fresh menu',
      note: 'Odhad pro UGO. Cena pobočky není ověřená z jídelního lístku.',
    }
  }

  if (/jidelna|menza|canteen|automat/.test(hay) || type.includes('jidelna')) {
    return {
      ...band(place.id, 79, 129, extra),
      confidence: 'medium',
      item: 'polední menu jídelny',
      note: 'Odhad podle typu jídelna / menza v Brně.',
    }
  }
  if (/steak|hotel |grandezza|pavillon|gourmet|fine dining/.test(hay)) {
    return {
      ...band(place.id, 289, 459, extra),
      confidence: 'low',
      item: 'hlavní jídlo v dražší restauraci',
      note: 'Širší odhad podle názvu / typu prémiového podniku. Nízká jistota.',
    }
  }
  if (/sushi/.test(hay)) {
    return {
      ...band(place.id, 189, 349, extra),
      confidence: 'medium',
      item: 'sushi sada / hlavní jídlo',
      note: 'Odhad podle sushi nabídky srovnatelných podniků v Brně.',
    }
  }

  const byCat = {
    kebab: [109, 159, 'kebab / wrap', 'medium', 'Odhad podle běžného kebabu v Brně.'],
    fastfood: [99, 159, 'rychlé občerstvení', 'medium', 'Odhad podle fast foodu v Brně.'],
    burger: [159, 279, 'burger', 'medium', 'Odhad podle burgerových podniků v Brně (bez ceníku pobočky).'],
    pizza: [159, 269, 'pizza', 'medium', 'Odhad podle pizzerií v Brně.'],
    asijske: [139, 229, 'asijské hlavní jídlo', 'medium', 'Odhad podle asijských restaurací v Brně.'],
    cina: [129, 189, 'čínské hlavní jídlo', 'medium', 'Odhad podle čínských restaurací v Brně.'],
    mexiko: [159, 229, 'taco / burrito', 'medium', 'Odhad podle mexických bister v Brně.'],
    ceske: [149, 249, 'české hlavní jídlo', 'medium', 'Odhad podle české restaurace / hospody v Brně.'],
    kava: [89, 159, 'snídaně nebo bageta ke kávě', 'medium', 'Odhad jídla v kavárně, ne cena espressa.'],
    sladke: [49, 89, 'zákusek', 'medium', 'Odhad zákusku v cukrárně, ne hlavní teplé jídlo.'],
    zdrave: [149, 219, 'bowl / zdravé hlavní jídlo', 'medium', 'Odhad podle bister se zdravou nabídkou v Brně.'],
    vegetarianske: [139, 199, 'vegetariánské hlavní jídlo', 'medium', 'Odhad podle vegetariánských podniků v Brně.'],
    veganske: [149, 199, 'veganské hlavní jídlo', 'medium', 'Odhad podle veganských bister v Brně.'],
  }

  if (byCat[cat]) {
    const [min, max, item, confidence, note] = byCat[cat]
    return { ...band(place.id, min, max, extra), confidence, item, note }
  }

  return {
    ...band(place.id, 139, 249, extra),
    confidence: 'low',
    item: 'běžné hlavní jídlo',
    note: 'Široký odhad: kategorie podniku není určená. Orientační odhad · nízká jistota.',
  }
}

const estimates = {}
const skipped = []
for (const place of places) {
  if (verifiedPrices[place.id]) {
    skipped.push(place.id)
    continue
  }
  const e = estimateFor(place)
  estimates[place.id] = {
    price: e.min,
    priceMax: e.max,
    priceKind: 'estimate',
    priceStatus: 'estimated',
    priceConfidence: e.confidence,
    priceItem: e.item,
    priceNote: e.note,
    priceCategory: derivePriceCategory(e.max),
  }
}

const header = `/** Auto-generated estimates. Regeneruj: node scripts/generate-price-estimates.mjs */
/** Nejsou ověřené ceny z menu. Ověřené záznamy v verifiedPrices.js mají přednost. */
export const estimatedPrices = `

writeFileSync(
  new URL('../src/data/estimatedPrices.js', import.meta.url),
  `${header}${JSON.stringify(estimates, null, 2)}\n`,
  'utf8',
)

const conf = { high: 0, medium: 0, low: 0 }
for (const e of Object.values(estimates)) conf[e.priceConfidence] += 1

const report = {
  totalPlaces: places.length,
  verifiedKept: skipped.length,
  estimates: Object.keys(estimates).length,
  coverage: skipped.length + Object.keys(estimates).length,
  confidence: conf,
}
writeFileSync(
  new URL('../reports/price-coverage.json', import.meta.url),
  JSON.stringify(report, null, 2),
  'utf8',
)
console.log(report)
