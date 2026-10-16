/** Haversine je jen vzdušná čára. Zobrazená vzdálenost ji nepoužívá. */

export const BRNO_BOUNDS = {
  minLat: 49.1,
  maxLat: 49.32,
  minLon: 16.4,
  maxLon: 16.75,
}

export function hasFiniteLatLon(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon)
}

/** Krátká hláška podle kódu Geolocation API nebo důvodu z aplikace. */
export function geolocationErrorMessage(reason) {
  switch (reason) {
    case 1:
    case 'denied':
      return 'Poloha je v prohlížeči zakázaná. Povol ji u ikony zámku nebo „i“ v adresním řádku: Oprávnění → Poloha → Povolit. Pak klikni na tlačítko znovu.'
    case 2:
    case 'unavailable':
      return 'Poloha teď není dostupná. Zkontroluj, že máš v systému zapnuté určování polohy, a zkus to znovu.'
    case 3:
    case 'timeout':
      return 'Zjištění polohy trvalo příliš dlouho a vypršel časový limit. Zkus to znovu.'
    case 'unsupported':
      return 'Tenhle prohlížeč polohu nezjišťuje. Ostatní filtry fungují dál.'
    case 'insecure':
      return 'Poloha funguje jen na https nebo na localhost. Tahle adresa ji prohlížeč nepovolí. Ostatní filtry fungují dál.'
    case 'invalid':
      return 'Prohlížeč nevrátil použitelné souřadnice, poloha proto není zapnutá.'
    default:
      return 'Polohu se nepodařilo zjistit. Ostatní filtry fungují dál.'
  }
}

export function hasCoordinates(place) {
  return (
    typeof place?.lat === 'number' &&
    typeof place?.lon === 'number' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon)
  )
}

/** missing = souřadnice v datech nejsou. invalid = jsou, ale nedají se použít. */
export function coordinateIssue(place) {
  const latMissing = place?.lat == null || place?.lat === ''
  const lonMissing = place?.lon == null || place?.lon === ''
  if (latMissing && lonMissing) return 'missing'
  if (!hasCoordinates(place) || !isInBrnoBounds(place.lat, place.lon)) return 'invalid'
  return null
}

export function hasVerifiedCoordinates(place) {
  return coordinateIssue(place) == null
}

export function isInBrnoBounds(lat, lon) {
  return (
    lat >= BRNO_BOUNDS.minLat &&
    lat <= BRNO_BOUNDS.maxLat &&
    lon >= BRNO_BOUNDS.minLon &&
    lon <= BRNO_BOUNDS.maxLon
  )
}

function toRad(deg) {
  return (deg * Math.PI) / 180
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const earthKm = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function airDistanceKm(origin, place) {
  if (!origin || !hasVerifiedCoordinates(place)) return null
  if (!hasFiniteLatLon(origin.lat, origin.lon)) return null
  return haversineKm(origin.lat, origin.lon, place.lat, place.lon)
}

export function formatDistance(km) {
  if (typeof km !== 'number' || Number.isNaN(km)) return '—'
  if (km < 0.95) return `${Math.round(km * 1000)} m`
  const digits = km < 10 ? 1 : 0
  return `${km.toLocaleString('cs-CZ', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} km`
}

