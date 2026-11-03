import { normalizeCategoryParam } from '../constants/filters.js'
import { restaurantHasPublicDeal } from '../data/restaurantDeals.js'

const SORTS = new Set(['quality', 'relevance', 'rating', 'price-asc', 'price-desc', 'distance', 'name'])
import { getRestaurantCategory } from './restaurantTags.js'
import { compareByPrice, getBudgetComparePrice, hasVerifiedPrice } from './price.js'
import { compareByRecordQuality } from './recordQuality.js'
import { suppressCatalogDuplicates } from './catalogDuplicates.js'
import { presentOsmContact } from './osmContact.js'
import {
  CATEGORY_SEARCH_ALIASES,
  foldSearchText,
  interpretSearchQuery,
  matchRestaurantQuery,
} from './smartSearch.js'

export { CATEGORY_SEARCH_ALIASES, foldSearchText }

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
    sortBy = 'quality',
    vegetarianOnly = false,
    veganOnly = false,
    verifiedPricesOnly = false,
    dealsOnly = false,
    hoursOnly = false,
    hasOrigin = false,
    suppressDuplicates = true,
  } = options

  const intent = interpretSearchQuery(search)
  const budget = tighterBudget(maxBudget, intent.maxBudget)
  const categoryFilter = normalizeCategoryParam(cuisineType)
  const scores = new Map()

  let list = restaurants.filter((r) => {
    if (verifiedPricesOnly && !hasVerifiedPrice(r)) return false
    if (dealsOnly && !restaurantHasPublicDeal(r.id)) return false
    if (hoursOnly && !presentOsmContact(r).hasHours) return false

    if (budget !== '') {
      const comparePrice = getBudgetComparePrice(r)
      if (comparePrice == null || comparePrice > Number(budget)) return false
    }

    if (categoryFilter !== '') {
      const cat = getRestaurantCategory(r)
      if (cat !== categoryFilter) return false
    }

    if (maxDistance !== '' && hasOrigin) {
      if (r.distanceKm == null || r.distanceKm > Number(maxDistance)) return false
    }

    if (veganOnly || intent.veganOnly) {
      if (veganOnly && !intent.veganOnly) {
        if (!r.veganFriendly) return false
      } else if (!matchesVeganIntent(r)) return false
    } else if (vegetarianOnly || intent.vegetarianOnly) {
      if (vegetarianOnly && !intent.vegetarianOnly) {
        if (!r.vegetarianFriendly && !r.veganFriendly) return false
      } else if (!matchesVegetarianIntent(r)) return false
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
    switch (sortBy) {
      case 'price-asc':
        return compareByPrice(a, b, 'asc')
      case 'price-desc':
        return compareByPrice(a, b, 'desc')
      case 'distance':
        return missingLast(a, b, (r) => r.distanceKm, 'asc')
      case 'name':
        return (
          String(a.name || '').localeCompare(String(b.name || ''), 'cs') ||
          String(a.id).localeCompare(String(b.id))
        )
      case 'rating':
        return missingLast(
          a,
          b,
          (r) => (r.googleRatingStatus === 'verified' ? r.googleRating : null),
          'desc',
        )
      case 'relevance':
        return (scores.get(b.id) || 0) - (scores.get(a.id) || 0) || compareByRecordQuality(a, b)
      case 'quality':
      default:
        return compareByRecordQuality(a, b)
    }
  })

  return list
}

export function parseResultsSearchParams(searchParams) {
  const veganOnly = searchParams.get('vegan') === '1'
  const vegetarianOnly = searchParams.get('veg') === '1'

  return {
    search: searchParams.get('q') ?? '',
    maxBudget: finiteParam(searchParams.get('budget')),
    cuisineType: normalizeCategoryParam(searchParams.get('type') ?? ''),
    maxDistance: finiteParam(searchParams.get('distance')),
    sortBy: SORTS.has(searchParams.get('sort')) ? searchParams.get('sort') : 'quality',
    veganOnly,
    vegetarianOnly: veganOnly ? false : vegetarianOnly,
    verifiedPricesOnly: searchParams.get('verified') === '1',
    dealsOnly: searchParams.get('deals') === '1',
    hoursOnly: searchParams.get('hours') === '1',
  }
}

export function buildResultsSearchParams(filters) {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set('q', filters.search.trim())
  if (filters.maxBudget) params.set('budget', filters.maxBudget)
  if (filters.cuisineType) params.set('type', filters.cuisineType)
  if (filters.maxDistance) params.set('distance', filters.maxDistance)
  if (filters.sortBy && filters.sortBy !== 'quality') params.set('sort', filters.sortBy)
  if (filters.veganOnly) {
    params.set('vegan', '1')
  } else if (filters.vegetarianOnly) {
    params.set('veg', '1')
  }
  if (filters.verifiedPricesOnly) params.set('verified', '1')
  if (filters.dealsOnly) params.set('deals', '1')
  if (filters.hoursOnly) params.set('hours', '1')
  return params
}
