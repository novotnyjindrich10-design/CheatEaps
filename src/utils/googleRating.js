export const GOOGLE_STATUS_VERIFIED = 'verified'
export const GOOGLE_STATUS_NOT_FOUND = 'not_found'
export const GOOGLE_STATUS_NEEDS_REVIEW = 'needs_review'
export const GOOGLE_STATUS_MAPS_SEARCH = 'maps_search'

export function hasGoogleRating(restaurant) {
  return (
    restaurant?.googleRatingStatus === GOOGLE_STATUS_VERIFIED &&
    typeof restaurant.googleRating === 'number' &&
    restaurant.googleRating >= 0 &&
    restaurant.googleRating <= 5
  )
}

export function buildMapsSearchUrl(name, address) {
  const query = [name, address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function mapsLinkFor(restaurant) {
  if (hasGoogleRating(restaurant) && restaurant.googleMapsUrl) {
    return restaurant.googleMapsUrl
  }
  if (restaurant.googleMapsSearchUrl) return restaurant.googleMapsSearchUrl
  return buildMapsSearchUrl(restaurant?.name, restaurant?.address)
}

/** Navigace na cíl. Polohu uživatele do odkazu nevkládá. */
export function mapsDirectionsUrl(restaurant) {
  const lat = restaurant?.lat
  const lon = restaurant?.lon
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
  }
  const query = [restaurant?.name, restaurant?.address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
}

export function googleStatusLabel(restaurant) {
  if (hasGoogleRating(restaurant)) return 'Ověřené Google hodnocení'
  if (restaurant?.googleRatingStatus === GOOGLE_STATUS_NEEDS_REVIEW) {
    return 'Čeká na kontrolu pobočky'
  }
  if (restaurant?.googleRatingStatus === GOOGLE_STATUS_NOT_FOUND) {
    return 'Hodnocení nenalezené'
  }
  return 'Hodnocení neověřené'
}

export function formatRatingNumber(rating) {
  return rating.toLocaleString('cs-CZ', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

export function formatReviewCount(count) {
  if (typeof count !== 'number') return ''
  const n = Math.round(count)
  const mod100 = n % 100
  const mod10 = n % 10
  let word = 'recenzí'
  if (mod100 < 11 || mod100 > 14) {
    if (mod10 === 1) word = 'recenze'
    else if (mod10 >= 2 && mod10 <= 4) word = 'recenze'
  }
  return `${n.toLocaleString('cs-CZ')} ${word}`
}
