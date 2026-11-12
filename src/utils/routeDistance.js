import {
  airDistanceKm,
  coordinateIssue,
  formatDistance,
  hasFiniteLatLon,
  hasVerifiedCoordinates,
} from './geo.js'

/**
 * Veřejná pěší instance OSRM od FOSSGIS (routing.openstreetmap.de).
 * FOSSGIS ToS: max 1 req/s, ne pro weby s vyšším provozem, platný User-Agent.
 * Prohlížeč UA knihovny nesplní — hromadné volání na ~800 podniků dostává 429 a porušuje podmínky.
 *
 * Výchozí: vypnuto. Katalog používá Haversine (vzdušnou čarou).
 * Zapnutí jen s vlastním/compliant endpointem: VITE_FOOT_ROUTING=1 a volitelně VITE_FOOT_ROUTE_TABLE_URL.
 * Parametr fallback_speed se nenastavuje, aby chybějící trasa neskončila jako odhad vzdušnou čarou.
 */
export const FOOT_ROUTE_TABLE_URL = 'https://routing.openstreetmap.de/routed-foot/table/v1/foot'

/** Tabulka OSRM bere nejvýš 100 souřadnic včetně startu. */
export const ROUTE_CHUNK_DESTINATIONS = 80

export function isFootRoutingEnabled(env = import.meta.env) {
  return String(env?.VITE_FOOT_ROUTING || '').trim() === '1'
}

export function resolveFootRouteTableUrl(env = import.meta.env) {
  const custom = String(env?.VITE_FOOT_ROUTE_TABLE_URL || '').trim()
  return custom || FOOT_ROUTE_TABLE_URL
}

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

function airFallback(origin, place, pending) {
  const km = airDistanceKm(origin, place)
  if (typeof km !== 'number' || !Number.isFinite(km)) {
    return { distanceKm: null, distanceState: 'unavailable' }
  }
  // pending = čekáme na pěší trasu; číslo už ukazujeme (Haversine), ne „…“.
  return {
    distanceKm: km,
    distanceState: pending ? 'air-pending' : 'air',
  }
}

/**
 * Připojí vzdálenosti k podnikům.
 * S polohou: ihned Haversine (air / air-pending), po OSRM upgrade na route (pěšky).
 * Vzdušnou čáru nikdy nevydáváme za pěší trasu.
 */
export function applyRouteDistances(
  places,
  distanceById,
  { hasOrigin = false, pending = false, originStatus = 'idle', origin = null } = {},
) {
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
      const fallback = airFallback(origin, place, pending)
      return { ...place, ...fallback, locationVerified: true }
    }
    const km = distanceById.get(place.id)
    if (typeof km !== 'number' || !Number.isFinite(km)) {
      // null z OSRM chunku / probíhající výpočet → Haversine, ne prázdná „—“
      const fallback = airFallback(origin, place, pending)
      return { ...place, ...fallback, locationVerified: true }
    }
    return { ...place, distanceKm: km, distanceState: 'route', locationVerified: true }
  })
}

export function formatRouteDistance(km, state) {
  if (state === 'locating') return '…'
  if (state === 'route' || state === 'air' || state === 'air-pending') {
    if (typeof km !== 'number' || !Number.isFinite(km)) return '—'
    return formatDistance(km)
  }
  return '—'
}

/** Krátký popisek pod hodnotou. Pěšky jen u skutečné trasy. */
export function routeDistanceCaption(state) {
  switch (state) {
    case 'route':
      return 'pěšky'
    case 'air-pending':
      return 'vzdušnou čarou · počítám trasu'
    case 'air':
      return 'vzdušnou čarou'
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
      return 'vzdálenost není k dispozici'
    case 'locating':
      return 'zjišťuji polohu'
    case 'loading':
      return 'počítám trasu'
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

/** Stavy se známým číslem km (řazení / filtr vzdálenosti). */
export function hasUsableDistanceState(state) {
  return state === 'route' || state === 'air' || state === 'air-pending'
}

export async function collectRouteDistances(origin, places, options = {}) {
  const {
    fetchImpl = globalThis.fetch,
    signal,
    onChunk,
    chunkSize = ROUTE_CHUNK_DESTINATIONS,
    endpoint = FOOT_ROUTE_TABLE_URL,
    minIntervalMs = 1100,
  } = options
  const targets = places.filter((place) => hasVerifiedCoordinates(place))
  const chunks = chunkItems(targets, chunkSize)
  const distances = new Map()
  let failedChunks = 0
  let lastRequestAt = 0

  for (const chunk of chunks) {
    if (signal?.aborted) {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    }
    const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt))
    if (wait > 0) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, wait)
        signal?.addEventListener?.(
          'abort',
          () => {
            clearTimeout(timer)
            resolve()
          },
          { once: true },
        )
      })
      if (signal?.aborted) {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
    }
    try {
      lastRequestAt = Date.now()
      const response = await fetchImpl(buildFootTableUrl(origin, chunk, endpoint), { signal })
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
