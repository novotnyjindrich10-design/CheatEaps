import { normalizeCategoryParam } from '../constants/filters.js'
import { restaurantHasPublicDeal } from '../data/restaurantDeals.js'

const SORTS = new Set(['quality', 'relevance', 'rating', 'price-asc', 'price-desc', 'distance', 'name'])
import { getRestaurantCategory } from './restaurantTags.js'
import { compareByPrice, getBudgetComparePrice, hasVerifiedPrice } from './price.js'
import { compareByRecordQuality } from './recordQuality.js'
import { suppressCatalogDuplicates } from './catalogDuplicates.js'
import { presentOsmContact } from './osmContact.js'
import { isOpenNowReliable } from './openingStatus.js'
import {
  CATEGORY_SEARCH_ALIASES,
  foldSearchText,
  interpretSearchQuery,
  matchRestaurantQuery,
} from './smartSearch.js'

function inMapBounds(place, bounds) {
  if (!bounds) return true
  const lat = Number(place?.lat)
  const lon = Number(place?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false
  const south = Number(bounds.south)
  const north = Number(bounds.north)
  const west = Number(bounds.west)
  const east = Number(bounds.east)
  if (![south, north, west, east].every(Number.isFinite)) return true
  return lat >= south && lat <= north && lon >= west && lon <= east
}

export { CATEGORY_SEARCH_ALIASES, foldSearchText }

/**
 * Prázdné řazení = výchozí „Nejblíž ke mně“.
 * S polohou řadíme podle vzdálenosti; bez polohy neslibujeme vzdálenost a držíme abecedu.
 * Explicitní „distance“ bez polohy se chová stejně (bez falešných km).
 */
export function resolveEffectiveSort(sortBy, { hasOrigin = false } = {}) {
  const requested = sortBy && SORTS.has(sortBy) ? sortBy : ''
  if (!requested || requested === 'distance') {
    return hasOrigin ? 'distance' : 'name'
  }
  return requested
}

/** True, když UI žádá řazení podle vzdálenosti (výchozí nebo explicitní). */
export function wantsDistanceSort(sortBy) {
  return !sortBy || sortBy === 'distance'
}

function compareByNameThenId(a, b) {
  return (
    String(a.name || '').localeCompare(String(b.name || ''), 'cs') ||
    String(a.id).localeCompare(String(b.id))
  )
}

function tighterBudget(urlBudget, queryBudget) {
  const values = [urlBudget, queryBudget]
    .filter((value) => value !== '' && value != null)
    .map(Number)
    .filter((value) => Number.isFinite(value))
  if (values.length === 0) return ''
  return String(Math.min(...values))
}

function finiteParam(value) {
  if (value == null || String(value).trim() === '') return ''
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return ''
  return String(n)
}

function missingLast(a, b, pick, direction = 'asc') {
  const av = pick(a)
  const bv = pick(b)
  const aMissing = av == null || Number.isNaN(Number(av))
  const bMissing = bv == null || Number.isNaN(Number(bv))
  if (aMissing && bMissing) return 0
  if (aMissing) return 1
  if (bMissing) return -1
  return direction === 'desc' ? Number(bv) - Number(av) : Number(av) - Number(bv)
}

function matchesVeganIntent(restaurant) {
  return Boolean(restaurant?.veganFriendly) || getRestaurantCategory(restaurant) === 'veganske'
}

function matchesVegetarianIntent(restaurant) {
  return (
    Boolean(restaurant?.vegetarianFriendly || restaurant?.veganFriendly) ||
    getRestaurantCategory(restaurant) === 'vegetarianske' ||
    getRestaurantCategory(restaurant) === 'veganske'
  )
}

/** „bez masa“ = podniky bez masa, ne každá restaurace s jednou vegetariánskou položkou. */
function matchesMeatFreeSearch(restaurant) {
  const category = getRestaurantCategory(restaurant)
  return category === 'vegetarianske' || category === 'veganske' || Boolean(restaurant?.veganFriendly)
}

/**
 * Filtruje a řadí restaurace.
 * Hledání: název, adresa, doložené jídlo, typ kuchyně a veřejné slevy.
 * „pizza do 200“ bere kategorii a ověřený strop ceny. Odhad limit nesplní.
 * Sushi a jiná konkrétní jídla se neberou jen z obecné kategorie.
 * Podniky bez vzdálenosti se při filtru vzdálenosti vynechají.
 * Známé OSM kopie curated podniků se ve výpisu skryjí (ID zůstává).
 */
export function filterAndSortRestaurants(restaurants, options) {
  const {
    search = '',
    maxBudget = '',
    cuisineType = '',
    maxDistance = '',
    sortBy = '',
    vegetarianOnly = false,
    veganOnly = false,
    verifiedPricesOnly = false,
    dealsOnly = false,
    hoursOnly = false,
    openNowOnly = false,
    mapBounds = null,
    hasOrigin = false,
    suppressDuplicates = true,
  } = options

  const intent = interpretSearchQuery(search)
  const budget = tighterBudget(maxBudget, intent.maxBudget)
  const categoryFilter = normalizeCategoryParam(cuisineType)
  const scores = new Map()
  const effectiveSort = resolveEffectiveSort(sortBy, { hasOrigin })

  let list = restaurants.filter((r) => {
    if (verifiedPricesOnly && !hasVerifiedPrice(r)) return false
    if (dealsOnly && !restaurantHasPublicDeal(r.id)) return false
    if (hoursOnly && !presentOsmContact(r).hasHours) return false
    if (openNowOnly) {
      const hoursRaw = presentOsmContact(r).hoursRaw
      if (!hoursRaw || !isOpenNowReliable(hoursRaw)) return false
    }
    if (mapBounds && !inMapBounds(r, mapBounds)) return false

    if (budget !== '') {
      const comparePrice = getBudgetComparePrice(r)
      if (comparePrice == null || comparePrice > Number(budget)) return false
    }

    if (categoryFilter !== '') {
      const cat = getRestaurantCategory(r)
      if (cat !== categoryFilter) return false
    }

    if (maxDistance !== '' && hasOrigin) {
      // Limit vzdálenosti bere známé km (pěšky i vzdušnou čáru). Bez čísla podnik vynecháme.
      if (r.distanceState === 'locating') return false
      if (r.distanceKm == null || !Number.isFinite(Number(r.distanceKm))) return false
      if (Number(r.distanceKm) > Number(maxDistance)) return false
    }

    if (veganOnly || intent.veganOnly) {
      if (veganOnly && !intent.veganOnly) {
        if (!r.veganFriendly) return false
      } else if (!matchesVeganIntent(r)) return false
    } else if (intent.vegetarianOnly) {
      if (!matchesMeatFreeSearch(r)) return false
    } else if (vegetarianOnly) {
      if (!matchesVegetarianIntent(r)) return false
    }

    if (intent.lunchOnly && !r.lunchMenu) return false

    const score = matchRestaurantQuery(r, intent)
    if (score == null) return false
    scores.set(r.id, score)
    return true
  })

  if (suppressDuplicates) {
    list = suppressCatalogDuplicates(list)
  }

  list = [...list].sort((a, b) => {
    switch (effectiveSort) {
      case 'price-asc':
        return compareByPrice(a, b, 'asc') || compareByNameThenId(a, b)
      case 'price-desc':
        return compareByPrice(a, b, 'desc') || compareByNameThenId(a, b)
      case 'distance':
        return missingLast(a, b, (r) => r.distanceKm, 'asc') || compareByNameThenId(a, b)
      case 'name':
        return compareByNameThenId(a, b)
      case 'rating':
        return (
          missingLast(
            a,
            b,
            (r) => (r.googleRatingStatus === 'verified' ? r.googleRating : null),
            'desc',
          ) || compareByNameThenId(a, b)
        )
      case 'relevance':
        return (scores.get(b.id) || 0) - (scores.get(a.id) || 0) || compareByNameThenId(a, b)
      case 'quality':
        return compareByRecordQuality(a, b)
      default:
        return compareByNameThenId(a, b)
    }
  })

  return list
}

export function parseResultsSearchParams(searchParams) {
  const veganOnly = searchParams.get('vegan') === '1'
  const vegetarianOnly = searchParams.get('veg') === '1'
  const view = searchParams.get('view') === 'map' ? 'map' : 'list'

  return {
    search: searchParams.get('q') ?? '',
    maxBudget: finiteParam(searchParams.get('budget')),
    cuisineType: normalizeCategoryParam(searchParams.get('type') ?? ''),
    maxDistance: finiteParam(searchParams.get('distance')),
    sortBy: SORTS.has(searchParams.get('sort')) ? searchParams.get('sort') : '',
    veganOnly,
    vegetarianOnly: veganOnly ? false : vegetarianOnly,
    verifiedPricesOnly: searchParams.get('verified') === '1',
    dealsOnly: searchParams.get('deals') === '1',
    hoursOnly: searchParams.get('hours') === '1',
    openNowOnly: searchParams.get('open') === '1',
    view,
  }
}

export function buildResultsSearchParams(filters) {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set('q', filters.search.trim())
  if (filters.maxBudget) params.set('budget', filters.maxBudget)
  if (filters.cuisineType) params.set('type', filters.cuisineType)
  if (filters.maxDistance) params.set('distance', filters.maxDistance)
  if (filters.sortBy) params.set('sort', filters.sortBy)
  if (filters.veganOnly) {
    params.set('vegan', '1')
  } else if (filters.vegetarianOnly) {
    params.set('veg', '1')
  }
  if (filters.verifiedPricesOnly) params.set('verified', '1')
  if (filters.dealsOnly) params.set('deals', '1')
  if (filters.hoursOnly) params.set('hours', '1')
  if (filters.openNowOnly) params.set('open', '1')
  if (filters.view === 'map') params.set('view', 'map')
  return params
}
