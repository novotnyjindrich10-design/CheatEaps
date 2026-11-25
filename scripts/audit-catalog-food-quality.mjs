/**
 * Audit nekulinárních záznamů, duplicit a podezřelých polí.
 * node scripts/audit-catalog-food-quality.mjs
 */
import { writeFileSync } from 'node:fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { osmFacts } from '../src/data/osmFacts.js'
import { officialWebsites } from '../src/data/officialWebsites.js'
import { placeCoordinates } from '../src/data/placeCoordinates.js'
import { estimatedPrices } from '../src/data/estimatedPrices.js'
import { verifiedPrices } from '../src/data/verifiedPrices.js'
import { getCategoryOverride } from '../src/data/categoryOverrides.js'
import { KNOWN_DUPLICATE_PAIRS } from '../src/utils/catalogDuplicates.js'
import { foldSearchText } from '../src/utils/smartSearch.js'

const REPORT_JSON = new URL('../reports/catalog-food-quality.json', import.meta.url)
const REPORT_MD = new URL('../reports/catalog-food-quality.md', import.meta.url)

const NON_FOOD_STRONG =
  /\b(barber|holič|holic|kadeřnict|kadernict|hairdresser|hair\s*salon|nail\s*salon|manikúr|pedikúr|tattoo\s*studio|tetovací|florist|květinářstv|optician|optika\b|advokát|notář|účetní\s*kancel|coworking|realitní|pojišťovn|lékárn|pharmacy|autoservis|car\s*wash|fitness\s*cent|fitcent|wellness\s*cent|beauty\s*salon|kosmetický\s*salon|prádelna|dry\s*clean|čistírna|zastavárn|zlatnict|hodinářstv|supermarket|hypermarket|convenience\s*shop|železářstv|hardware\s*store|čerpací\s*stanic|benzínka|petrol\s*station|trafik[ay]|cigarette|stomatolog|zubní\s*ordin|nemocnic|základní\s*škol|mateřská\s*škol|pošta\b)\b/i

const NON_FOOD_SOFT =
  /\b(salon|studio|office|kancelář|banka|gym|spa|masáž|massage|butik|boutique|fashion|laundry|hotel|hostel|motel|ubytování|klinik)\b/i

const FOOD_KEEP =
  /\b(café|cafe|coffee|restaur|bistro|pivnic|hospoda|hostinec|cukrár|pekár|pizza|kebab|burger|sushi|food|jídeln|gastronom|kuchyn|bar\b|pub\b|vinárn|wine\s*bar|ice\s*cream|zmrzlin)\b/i

function mergePlaces() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (byId.has(entry.id)) continue
    const override = getCategoryOverride(entry.id)
    byId.set(entry.id, {
      ...entry,
      ...(osmFacts[entry.id] || {}),
      ...(officialWebsites[entry.id] || {}),
      ...(placeCoordinates[entry.id] || {}),
      ...(estimatedPrices[entry.id] || {}),
      ...(verifiedPrices[entry.id] || {}),
      category: override?.category || entry.category,
      type: override?.type || entry.type,
      curated: curatedPlaces.some((item) => item.id === entry.id),
    })
  }
  return [...byId.values()]
}

function blobOf(place) {
  return [place.name, place.id, place.website, place.officialWebsite, place.description]
    .filter(Boolean)
    .join(' | ')
}

function streetKey(address) {
  return foldSearchText(String(address || ''))
    .replace(/,\s*\d{3}\s*\d{2}.*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function nameKey(name) {
  return foldSearchText(String(name || ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function haversineMeters(a, b) {
  const R = 6371000
  const toR = (x) => (x * Math.PI) / 180
  const dLat = toR(b.lat - a.lat)
  const dLon = toR(b.lon - a.lon)
  const lat1 = toR(a.lat)
  const lat2 = toR(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function pairKey(a, b) {
  return [a, b].sort().join('|')
}

function knownPairSet() {
  return new Set(KNOWN_DUPLICATE_PAIRS.map(([a, b]) => pairKey(a, b)))
}

function classifyNonFood(place) {
  const blob = blobOf(place)
  const folded = foldSearchText(blob)
  const strong = NON_FOOD_STRONG.test(blob) || NON_FOOD_STRONG.test(folded)
  const soft = NON_FOOD_SOFT.test(blob) || NON_FOOD_SOFT.test(folded)
  if (!strong && !soft) return null

  const foodish = FOOD_KEEP.test(blob) || FOOD_KEEP.test(folded)
  const barberish = /barber|holič|holic|hairdresser|hair\s*salon|kadeř|kadern/i.test(blob)

  if (barberish) {
    return {
      severity: 'confirmed',
      reason: 'Název/web jasně ukazuje holičství / kadeřnictví, ne gastronomii.',
    }
  }

  if (strong && !foodish) {
    return {
      severity: 'confirmed',
      reason: 'Silný nekulinární lexikální signál bez gastronomického kontextu.',
    }
  }

  if (strong && foodish) {
    return {
      severity: 'uncertain',
      reason: 'Nekulinární signál i gastronomický kontext — ruční kontrola.',
    }
  }

  if (soft && !foodish) {
    return {
      severity: 'uncertain',
      reason: 'Slabší nekulinární signál bez jasného food kontextu.',
    }
  }

  return null
}

function run() {
  const places = mergePlaces()
  const known = knownPairSet()
  const confirmedNonFood = []
  const uncertainNonFood = []

  for (const place of places) {
    const hit = classifyNonFood(place)
    if (!hit) continue
    const row = {
      id: place.id,
      name: place.name,
      category: place.category,
      amenity: place.osmAmenity || null,
      website: place.website || place.officialWebsite || null,
      reason: hit.reason,
    }
    if (hit.severity === 'confirmed') confirmedNonFood.push(row)
    else uncertainNonFood.push(row)
  }

  const nameAddrGroups = new Map()
  for (const place of places) {
    const key = `${nameKey(place.name)}|${streetKey(place.address)}`
    if (!nameKey(place.name)) continue
    if (!nameAddrGroups.has(key)) nameAddrGroups.set(key, [])
    nameAddrGroups.get(key).push(place.id)
  }
  const nameAddressDuplicates = [...nameAddrGroups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }))

  const withCoords = places.filter(
    (place) => Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)),
  )
  const coordNameDuplicates = []
  for (let i = 0; i < withCoords.length; i += 1) {
    for (let j = i + 1; j < withCoords.length; j += 1) {
      const a = withCoords[i]
      const b = withCoords[j]
      const meters = haversineMeters(
        { lat: Number(a.lat), lon: Number(a.lon) },
        { lat: Number(b.lat), lon: Number(b.lon) },
      )
      if (meters > 35) continue
      const na = nameKey(a.name)
      const nb = nameKey(b.name)
      if (!na || !nb) continue
      const firstA = na.split(' ')[0] || ''
      const firstB = nb.split(' ')[0] || ''
      const similar =
        na === nb ||
        na.includes(nb) ||
        nb.includes(na) ||
        (firstA.length > 4 && firstA === firstB)
      if (!similar) continue
      const key = pairKey(a.id, b.id)
      if (known.has(key)) continue
      coordNameDuplicates.push({
        ids: [a.id, b.id],
        names: [a.name, b.name],
        meters: Math.round(meters),
        status: 'uncertain',
      })
    }
  }

  const suspiciousPrices = places
    .filter((place) => {
      const price = Number(place.price)
      const max = Number(place.priceMax)
      if (Number.isFinite(price) && (price < 15 || price > 2500)) return true
      if (Number.isFinite(price) && Number.isFinite(max) && max < price) return true
      return false
    })
    .map((place) => ({
      id: place.id,
      name: place.name,
      price: place.price,
      priceMax: place.priceMax,
      priceKind: place.priceKind || null,
    }))

  const coordsOutsideBrno = places
    .filter((place) => {
      const lat = Number(place.lat)
      const lon = Number(place.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
      return lat < 48.95 || lat > 49.35 || lon < 16.35 || lon > 16.85
    })
    .map((place) => ({
      id: place.id,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
    }))

  const oddWebsites = places
    .filter((place) => {
      const web = String(place.website || place.officialWebsite || '').trim()
      if (!web) return false
      if (!/^https?:\/\//i.test(web)) return true
      if (/\s/.test(web)) return true
      return false
    })
    .map((place) => ({
      id: place.id,
      name: place.name,
      website: place.website || place.officialWebsite,
    }))

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      places: places.length,
      confirmedNonFood: confirmedNonFood.length,
      uncertainNonFood: uncertainNonFood.length,
      knownDuplicatePairs: KNOWN_DUPLICATE_PAIRS.length,
      newNameAddressDuplicateGroups: nameAddressDuplicates.length,
      newCoordNameDuplicates: coordNameDuplicates.length,
      suspiciousPrices: suspiciousPrices.length,
      coordsOutsideBrno: coordsOutsideBrno.length,
      oddWebsites: oddWebsites.length,
    },
    confirmedNonFood,
    uncertainNonFood,
    nameAddressDuplicates,
    coordNameDuplicates,
    suspiciousPrices,
    coordsOutsideBrno,
    oddWebsites,
  }

  const md = [
    '# Catalog food quality audit',
    '',
    `Vygenerováno: ${report.generatedAt}`,
    '',
    '## Souhrn',
    '',
    `- Podniků: **${report.totals.places}**`,
    `- Potvrzené nekulinární: **${report.totals.confirmedNonFood}**`,
    `- Nejisté nekulinární: **${report.totals.uncertainNonFood}**`,
    `- Známé duplicitní páry: **${report.totals.knownDuplicatePairs}**`,
    `- Nové skupiny name+adresa: **${report.totals.newNameAddressDuplicateGroups}**`,
    `- Nové blízké souřadnice + podobný název: **${report.totals.newCoordNameDuplicates}**`,
    `- Podezřelé ceny: **${report.totals.suspiciousPrices}**`,
    `- Souřadnice mimo Brno: **${report.totals.coordsOutsideBrno}**`,
    `- Divné weby: **${report.totals.oddWebsites}**`,
    '',
    '## Potvrzené nekulinární',
    '',
    ...(confirmedNonFood.length
      ? confirmedNonFood.map(
          (row) =>
            `- \`${row.id}\` — ${row.name} (${row.category}, amenity=${row.amenity || '—'}). ${row.reason}${row.website ? ` Web: ${row.website}` : ''}`,
        )
      : ['- Žádné.']),
    '',
    '## Nejisté (ruční kontrola)',
    '',
    ...(uncertainNonFood.length
      ? uncertainNonFood.map(
          (row) =>
            `- \`${row.id}\` — ${row.name} (${row.category}). ${row.reason}${row.website ? ` Web: ${row.website}` : ''}`,
        )
      : ['- Žádné.']),
    '',
    '## Nové potenciální duplicity (souřadnice)',
    '',
    ...(coordNameDuplicates.length
      ? coordNameDuplicates.map(
          (row) =>
            `- \`${row.ids[0]}\` / \`${row.ids[1]}\` — ${row.names[0]} / ${row.names[1]} (~${row.meters} m)`,
        )
      : ['- Žádné nové.']),
    '',
  ].join('\n')

  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))
  writeFileSync(REPORT_MD, md)
  console.log(JSON.stringify(report.totals, null, 2))
  console.log(`Wrote ${REPORT_MD.pathname}`)
}

run()
