import { getCategoryMeta } from '../constants/filters.js'
import { BRNO_BOUNDS, hasVerifiedCoordinates } from './geo.js'
import { formatRatingNumber, formatReviewCount, hasGoogleRating, osmDirectionsUrl } from './googleRating.js'
import { resolveDetailHero } from './placePhoto.js'
import { formatCardPrice } from './price.js'
import { presentRouteDistance } from './routeDistance.js'

/** Brno střed — výchozí viewport mapy. */
export const BRNO_MAP_CENTER = Object.freeze({ lat: 49.1951, lon: 16.6068 })
export const BRNO_MAP_DEFAULT_ZOOM = 12

/** Volnější rám kolem Brna — mapa se neodscrolluje do Prahy, ale jde mírně oddálit. */
export const BRNO_MAP_MAX_BOUNDS = Object.freeze([
  [BRNO_BOUNDS.minLat - 0.08, BRNO_BOUNDS.minLon - 0.12],
  [BRNO_BOUNDS.maxLat + 0.08, BRNO_BOUNDS.maxLon + 0.12],
])

/** Stabilní otisk sad bodů — fitBounds jen když se množina ID změní. */
export function placesFingerprint(places) {
  if (!places?.length) return ''
  return places
    .map((place) => place.id)
    .filter(Boolean)
    .sort()
    .join('|')
}

function safeImageUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('/') && !url.startsWith('//')) return url
  if (url.startsWith('https://') || url.startsWith('http://')) return url
  return ''
}

function cardPhoto(place) {
  const photo = resolveDetailHero(place)
  const url = safeImageUrl(photo?.detailUrl || photo?.url)
  if (!url) return { photoUrl: '', photoAlt: '' }
  return {
    photoUrl: url,
    photoAlt: String(photo?.alt || '').trim().slice(0, 180),
  }
}

function cardRating(place) {
  if (!hasGoogleRating(place)) return ''
  const score = formatRatingNumber(place.googleRating)
  const count = typeof place.googleReviewCount === 'number' ? formatReviewCount(place.googleReviewCount) : ''
  return count ? `${score} · Google · ${count}` : `${score} · Google`
}

function cardDistance(place) {
  if (typeof place?.distanceKm !== 'number' || !Number.isFinite(place.distanceKm)) return { distanceKm: null, distanceLabel: '' }
  const presented = presentRouteDistance(place.distanceKm, place.distanceState)
  if (!presented.value || presented.value === '—') return { distanceKm: place.distanceKm, distanceLabel: '' }
  const distanceLabel = presented.caption ? `${presented.value} ${presented.caption}` : presented.value
  return { distanceKm: place.distanceKm, distanceLabel }
}

/**
 * Body pro mapu z už filtrovaného seznamu.
 * Neplatné / mimo Brno souřadnice vynechá.
 * Navigace obsahuje jen cíl, ne polohu uživatele.
 */
export function placesForMap(restaurants) {
  if (!Array.isArray(restaurants)) return []
  const out = []
  for (const place of restaurants) {
    if (!place?.id || !hasVerifiedCoordinates(place)) continue
    const cardPrice = formatCardPrice(place)
    const photo = cardPhoto(place)
    const distance = cardDistance(place)
    const cuisineLabel = getCategoryMeta(place.category)?.label || ''
    out.push({
      id: place.id,
      name: String(place.name || '').trim() || place.id,
      address: String(place.address || '').trim(),
      lat: place.lat,
      lon: place.lon,
      category: place.category || '',
      cuisineLabel,
      sponsored: Boolean(place.sponsored || place.placement === 'sponsored'),
      priceFrom: place.priceFrom ?? place.price ?? null,
      priceVerified: Boolean(place.priceVerified),
      priceLabel: cardPrice.primary !== '—' ? cardPrice.primary : '',
      priceStatus: cardPrice.status || '',
      ratingLabel: cardRating(place),
      ...photo,
      ...distance,
      detailPath: `/restaurant/${encodeURIComponent(place.id)}`,
      navigateUrl: osmDirectionsUrl(place),
    })
  }
  return out
}

export function boundsFromPlaces(places) {
  if (!places?.length) return null
  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const place of places) {
    minLat = Math.min(minLat, place.lat)
    maxLat = Math.max(maxLat, place.lat)
    minLon = Math.min(minLon, place.lon)
    maxLon = Math.max(maxLon, place.lon)
  }
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite)) return null
  return [
    [minLat, minLon],
    [maxLat, maxLon],
  ]
}

/**
 * Čtverec kolem bodu (poloměr v metrech).
 * @returns {[[number, number], [number, number]] | null}
 */
export function boundsAroundPoint(lat, lon, radiusMeters = 350) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return null
  }
  const earth = 6378137
  const dLat = (radiusMeters / earth) * (180 / Math.PI)
  const cos = Math.cos((lat * Math.PI) / 180)
  const dLon = cos > 0.01 ? dLat / cos : dLat
  return [
    [lat - dLat, lon - dLon],
    [lat + dLat, lon + dLon],
  ]
}

/** Cílová šířka výchozího viewportu mapy (mobil ~500–800 m). */
export const MAP_FOCUS_WIDTH_M = 650
export const MAP_FOCUS_ZOOM = 16
/** Popisky od tohoto zoomu — výchozí přiblížení je ≥ 16. */
export const MAP_LABEL_MIN_ZOOM = 15
/** Od tohoto zoomu jednotlivé značky místo clusterů. */
export const MAP_CLUSTER_DISABLE_ZOOM = 15

/**
 * Zoom tak, aby šířka mapy odpovídala cca `widthMeters` kolem `lat`.
 */
export function zoomForMapWidth(map, lat, widthMeters = MAP_FOCUS_WIDTH_M) {
  if (!map || !Number.isFinite(lat) || !Number.isFinite(widthMeters) || widthMeters <= 0) {
    return MAP_FOCUS_ZOOM
  }
  const size = typeof map.getSize === 'function' ? map.getSize() : null
  // Dokud Leaflet nezná šířku (0), počítej s typickým mobile canvasem — jinak zoom padne moc daleko.
  const widthPx = Math.max(Number(size?.x) || 0, 360)
  const metersPerPixel = widthMeters / widthPx
  const cos = Math.max(0.01, Math.cos((lat * Math.PI) / 180))
  const zoom = Math.log2((156543.03392 * cos) / metersPerPixel)
  if (!Number.isFinite(zoom)) return MAP_FOCUS_ZOOM
  return Math.min(17, Math.max(MAP_FOCUS_ZOOM, Math.round(zoom * 2) / 2))
}

/**
 * Vybere body, jejichž popisek se vejde. Vyšší priority vyhraje blízký konflikt.
 * @param {{ id: string, x: number, y: number, priority?: number }[]} points
 */
export function pickVisibleLabels(points, minDistancePx = 64) {
  const ranked = [...(points || [])].sort((a, b) => {
    const priority = (b.priority || 0) - (a.priority || 0)
    if (priority !== 0) return priority
    return String(a.id).localeCompare(String(b.id), 'cs')
  })
  const placed = []
  const ids = []
  for (const point of ranked) {
    if (!point?.id || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
    const crowded = placed.some((item) => Math.hypot(item.x - point.x, item.y - point.y) < minDistancePx)
    if (crowded) continue
    placed.push(point)
    ids.push(point.id)
  }
  return ids
}

export function escapeMapLabel(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
