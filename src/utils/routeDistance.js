import { coordinateIssue, formatDistance, hasFiniteLatLon, hasVerifiedCoordinates } from './geo.js'

/**
 * Veřejná pěší instance OSRM od FOSSGIS (OpenStreetMap).
 * Bez API klíče. Volá se přímo z prohlížeče, ne z našeho serveru.
 * Parametr fallback_speed se nenastavuje, aby chybějící trasa neskončila jako odhad vzdušnou čarou.
 */
export const FOOT_ROUTE_TABLE_URL = 'https://routing.openstreetmap.de/routed-foot/table/v1/foot'

/** Tabulka OSRM bere nejvýš 100 souřadnic včetně startu. */
export const ROUTE_CHUNK_DESTINATIONS = 80

export function chunkItems(items, size) {
  if (size < 1) throw new Error('Velikost dávky musí být kladná')
  const chunks = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

function formatCoord(lat, lon) {
  return `${Number(lon).toFixed(6)},${Number(lat).toFixed(6)}`
}

function samePoint(origin, place) {
  if (!hasFiniteLatLon(origin?.lat, origin?.lon) || !hasVerifiedCoordinates(place)) return false
  return formatCoord(origin.lat, origin.lon) === formatCoord(place.lat, place.lon)
}

export function buildFootTableUrl(origin, destinations, endpoint = FOOT_ROUTE_TABLE_URL) {
  if (!hasFiniteLatLon(origin?.lat, origin?.lon)) throw new Error('Chybí výchozí souřadnice')
  if (!Array.isArray(destinations) || destinations.length === 0) throw new Error('Chybí cíle')
  if (destinations.length > 99) throw new Error('Příliš mnoho cílů v jednom dotazu')
  const path = [formatCoord(origin.lat, origin.lon), ...destinations.map((place) => formatCoord(place.lat, place.lon))].join(';')
  const dest = destinations.map((_, index) => index + 1).join(';')
  return `${endpoint}/${path}?sources=0&destinations=${dest}&annotations=distance`
}

/** Vzdálenosti z tabulky jsou v metrech. null zůstane null a nenahrazuje se vzdušnou čarou. */
export function distancesFromTable(payload, destinations) {
  const row = payload?.distances?.[0]
  const distances = new Map()
  destinations.forEach((place, index) => {
    const meters = Array.isArray(row) ? row[index] : null
    if (typeof meters !== 'number' || !Number.isFinite(meters) || meters < 0) {
      distances.set(place.id, null)
      return
    }
    distances.set(place.id, meters / 1000)
  })
  return distances
}

function originDistanceState(originStatus) {
  if (originStatus === 'denied') return 'denied'
  if (originStatus === 'locating') return 'locating'
  if (originStatus === 'idle' || originStatus == null || originStatus === '') return 'no-origin'
  return 'origin-failed'
}

export function applyRouteDistances(places, distanceById, { hasOrigin = false, pending = false, originStatus = 'idle' } = {}) {
  return places.map((place) => {
    const issue = coordinateIssue(place)
    if (issue) {
      return {
        ...place,
        distanceKm: null,
        distanceState: issue === 'invalid' ? 'invalid' : 'unverified',
        locationVerified: false,
      }
    }
    if (!hasOrigin) {
      return {
        ...place,
        distanceKm: null,
        distanceState: originDistanceState(originStatus),
        locationVerified: true,
      }
    }
    if (!distanceById?.has(place.id)) {
      return { ...place, distanceKm: null, distanceState: pending ? 'loading' : 'unavailable', locationVerified: true }
    }
    const km = distanceById.get(place.id)
    if (typeof km !== 'number' || !Number.isFinite(km)) {
      return { ...place, distanceKm: null, distanceState: 'unavailable', locationVerified: true }
    }
    return { ...place, distanceKm: km, distanceState: 'route', locationVerified: true }
  })
}

export function formatRouteDistance(km, state) {
  if (state === 'loading' || state === 'locating') return '…'
  if (state === 'route') return formatDistance(km)
  return '—'
}

/** Krátký popisek pod hodnotou. U známé trasy je to „pěšky“, jinak důvod, proč číslo není. */
export function routeDistanceCaption(state) {
  switch (state) {
    case 'route':
      return 'pěšky'
    case 'unverified':
    case 'invalid':
      return 'bez ověřené polohy'
    case 'denied':
      return 'poloha nepovolena'
    case 'no-origin':
      return 'zapni polohu'
    case 'origin-failed':
      return 'poloha není dostupná'
    case 'unavailable':
      return 'trasa není k dispozici'
    case 'locating':
      return 'zjišťuji polohu'
    default:
      return ''
  }
}

export function presentRouteDistance(km, state) {
  return {
    value: formatRouteDistance(km, state),
    caption: routeDistanceCaption(state),
  }
}

export async function collectRouteDistances(origin, places, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    signal,
    onChunk,
    chunkSize = ROUTE_CHUNK_DESTINATIONS,
  } = options
  const targets = places.filter((place) => hasVerifiedCoordinates(place))
  const chunks = chunkItems(targets, chunkSize)
  const distances = new Map()
  let failedChunks = 0

  for (const chunk of chunks) {
    if (signal?.aborted) {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    }
    try {
      const response = await fetchImpl(buildFootTableUrl(origin, chunk), { signal })
      if (!response.ok) throw new Error(String(response.status))
      const payload = await response.json()
      if (payload?.code !== 'Ok' || !Array.isArray(payload.distances?.[0])) {
        throw new Error(payload?.code || 'invalid')
      }
      distancesFromTable(payload, chunk).forEach((km, id) => distances.set(id, km))
      chunk.forEach((place) => {
        if (distances.get(place.id) == null && samePoint(origin, place)) distances.set(place.id, 0)
      })
    } catch (error) {
      if (error?.name === 'AbortError') throw error
      failedChunks += 1
      chunk.forEach((place) => distances.set(place.id, samePoint(origin, place) ? 0 : null))
    }
    onChunk?.(new Map(distances), { failedChunks, chunkCount: chunks.length })
  }

  return { distances, failedChunks, chunkCount: chunks.length }
}
