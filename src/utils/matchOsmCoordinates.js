import { haversineKm, isInBrnoBounds } from './geo.js'

/** Body stejného podniku v jedné budově. 50 m je pořád stejné místo, ne odhad polohy. */
export const SAME_PLACE_METERS = 50

/** Záloha jen pro bod bez adresy, který leží u jediného čísla popisného z katalogu. */
export const ADDRESS_ANCHOR_METERS = 80

export function foldPlaceText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/nam\./g, 'namesti')
    .replace(/[^a-z0-9]+/g, '')
}

/** Číslo domu je poslední token. „28.“ v „náměstí 28. dubna“ zůstane součástí ulice. */
export function parseStreetHouse(address) {
  const first = String(address || '').split(',')[0].trim()
  const match = first.match(/^(.*)\s+(\d[\dA-Za-z/-]*)$/u)
  if (!match) return { street: first, house: '' }
  return { street: match[1].trim(), house: match[2] }
}

function houseParts(house) {
  const bits = String(house)
    .split(/[^\dA-Za-z]+/)
    .map(foldPlaceText)
    .filter(Boolean)
  return new Set([foldPlaceText(house), ...bits])
}

export function housesOverlap(a, b) {
  const left = houseParts(a)
  const right = houseParts(b)
  for (const part of left) {
    if (part && right.has(part)) return true
  }
  return false
}

export function namesOverlap(placeName, osmName) {
  const left = foldPlaceText(placeName)
  const right = foldPlaceText(osmName)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

function websiteHost(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function finitePoint(record) {
  return Number.isFinite(record?.lat) && Number.isFinite(record?.lon) && isInBrnoBounds(record.lat, record.lon)
}

function clusterRecords(records, maxMeters) {
  const clusters = []
  for (const record of records) {
    const cluster = clusters.find((group) =>
      group.some((item) => haversineKm(item.lat, item.lon, record.lat, record.lon) * 1000 <= maxMeters),
    )
    if (cluster) cluster.push(record)
    else clusters.push([record])
  }
  return clusters
}

function representative(records) {
  const chosen = records.find((record) => record.amenity === 'restaurant') || records[0]
  return {
    lat: Number(chosen.lat.toFixed(6)),
    lon: Number(chosen.lon.toFixed(6)),
    coordSource: 'osm',
  }
}

function sameAddress(place, record) {
  if (!record.street || !record.house || !finitePoint(record)) return false
  const { street, house } = parseStreetHouse(place.address)
  return foldPlaceText(record.street) === foldPlaceText(street) && housesOverlap(house, record.house)
}

function strictHits(place, records) {
  return records.filter((record) => sameAddress(place, record) && namesOverlap(place.name, record.name))
}

function websiteHits(place, records) {
  const host = websiteHost(place.website)
  if (!host) return []
  const sameName = records.filter((record) => {
    if (!finitePoint(record)) return false
    const osmName = foldPlaceText(record.name)
    return osmName.length >= 4 && namesOverlap(place.name, record.name)
  })
  // Stejný název na dvou místech: web řetězce neřekne, která pobočka to je.
  if (clusterRecords(sameName, SAME_PLACE_METERS).length !== 1) return []
  return sameName.filter((record) => websiteHost(record.website) === host)
}

function proximityHits(place, records) {
  const { street, house } = parseStreetHouse(place.address)
  const streetFold = foldPlaceText(street)
  if (!streetFold || !house) return []
  const anchors = records.filter(
    (record) =>
      finitePoint(record) &&
      foldPlaceText(record.street) === streetFold &&
      housesOverlap(house, record.house),
  )
  if (anchors.length === 0) {
    const streetAnchors = records.filter(
      (record) => finitePoint(record) && record.street && foldPlaceText(record.street) === streetFold,
    )
    anchors.push(...streetAnchors)
  }
  if (anchors.length === 0) return []

  return records.filter((record) => {
    if (!finitePoint(record)) return false
    const osmName = foldPlaceText(record.name)
    if (osmName.length < 4 || !namesOverlap(place.name, record.name)) return false
    if (record.street && foldPlaceText(record.street) !== streetFold) return false
    if (record.house && !housesOverlap(house, record.house)) return false
    return anchors.some(
      (anchor) => haversineKm(anchor.lat, anchor.lon, record.lat, record.lon) * 1000 <= ADDRESS_ANCHOR_METERS,
    )
  })
}

/**
 * Vrátí jediný bod z OSM, nebo null. Více vzdálených kandidátů se nepřijme.
 * Souřadnice se neskládají ani nedoplňují středem Brna.
 */
export function matchOsmCoordinate(place, records) {
  const attempts = [strictHits(place, records), websiteHits(place, records), proximityHits(place, records)]
  for (const hits of attempts) {
    const clusters = clusterRecords(hits, SAME_PLACE_METERS)
    if (clusters.length === 1) return representative(clusters[0])
  }
  return null
}
