import { hasVerifiedCoordinates } from './geo.js'
import { hasGoogleRating } from './googleRating.js'
import { hasVerifiedPrice } from './price.js'
import { foodIllustration, officialHero } from './placePhoto.js'
import { httpUrl, officialWebsiteOf } from './website.js'

/**
 * Kvalita záznamu pro výchozí řazení.
 * Body jen za údaje, které v záznamu opravdu jsou.
 * Odhad ceny, neověřené hodnocení, SVG a ukázkový obrázek kategorie se nepočítají.
 */
const WEIGHTS = {
  officialWebsite: 28,
  realDescription: 18,
  verifiedCoordinates: 12,
  streetAddress: 4,
  verifiedPrice: 40,
  officialPhoto: 22,
  foodPhoto: 6,
  knownCategory: 5,
  dietNote: 2,
  ratingStar: 2,
  ratingReviewsFew: 2,
  ratingReviewsSome: 4,
  ratingReviewsMany: 6,
}

function realDescription(restaurant) {
  const text = String(restaurant?.description || '').trim()
  if (text.length < 40) return false
  if (text.startsWith('Záznam z OpenStreetMap')) return false
  return true
}

function streetAddress(restaurant) {
  const address = String(restaurant?.address || '')
  return /\d/.test(address) && /brno/i.test(address)
}

function knownCategory(restaurant) {
  const category = restaurant?.category || restaurant?.cuisineType || ''
  return category !== '' && category !== 'neuvedeno'
}

function photoPoints(restaurant) {
  const official = officialHero(restaurant)
  if (official && httpUrl(official.url)) return WEIGHTS.officialPhoto
  const food = foodIllustration(restaurant)
  const url = food?.url || ''
  const localFood = typeof url === 'string' && url.startsWith('/food-illustrations/')
  if (food && (localFood || httpUrl(url))) return WEIGHTS.foodPhoto
  return 0
}

function ratingPoints(restaurant) {
  if (!hasGoogleRating(restaurant)) return 0
  let points = Math.round(restaurant.googleRating) * WEIGHTS.ratingStar
  const count = restaurant.googleReviewCount
  if (typeof count === 'number' && Number.isFinite(count) && count >= 1) {
    if (count >= 80) points += WEIGHTS.ratingReviewsMany
    else if (count >= 15) points += WEIGHTS.ratingReviewsSome
    else points += WEIGHTS.ratingReviewsFew
  }
  return points
}

/** Rozpis bodů. Slouží řazení i testům. */
export function recordQualityParts(restaurant) {
  const information =
    (officialWebsiteOf(restaurant) ? WEIGHTS.officialWebsite : 0) +
    (realDescription(restaurant) ? WEIGHTS.realDescription : 0) +
    (hasVerifiedCoordinates(restaurant) ? WEIGHTS.verifiedCoordinates : 0) +
    (streetAddress(restaurant) ? WEIGHTS.streetAddress : 0)
  const price = hasVerifiedPrice(restaurant) ? WEIGHTS.verifiedPrice : 0
  const photo = photoPoints(restaurant)
  const rating = ratingPoints(restaurant)
  const other =
    (knownCategory(restaurant) ? WEIGHTS.knownCategory : 0) +
    (String(restaurant?.vegetarianInfo || '').trim() ? WEIGHTS.dietNote : 0)
  return {
    information,
    price,
    photo,
    rating,
    other,
    total: information + price + photo + rating + other,
  }
}

export function recordQualityScore(restaurant) {
  return recordQualityParts(restaurant).total
}

/** Vyšší skóre první. Stejné skóre rozhodne název a id. */
export function compareByRecordQuality(a, b) {
  const diff = recordQualityScore(b) - recordQualityScore(a)
  if (diff !== 0) return diff
  const byName = String(a?.name || '').localeCompare(String(b?.name || ''), 'cs')
  if (byName !== 0) return byName
  return String(a?.id || '').localeCompare(String(b?.id || ''), 'cs')
}
