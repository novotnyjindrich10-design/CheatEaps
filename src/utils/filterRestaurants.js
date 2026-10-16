import { normalizeCategoryParam } from '../constants/filters.js'
import { getRestaurantCategory } from './restaurantTags.js'
import { compareByPrice, getBudgetComparePrice, hasVerifiedPrice } from './price.js'

/** Hledání bez háčků a čárek, se sloučenými mezerami. */
export function foldSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
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

/**
 * Filtruje a řadí restaurace. Hledání bere název a adresu, ne typ jídla.
 * Rozpočet bere horní ověřenou cenu (u rozmezí max). Odhad ani chybějící cena filtr nesplní.
 * Podniky bez vzdálenosti se při filtru vzdálenosti vynechají.
 */
export function filterAndSortRestaurants(restaurants, options) {
  const {
    search = '',
    maxBudget = '',
    cuisineType = '',
    maxDistance = '',
    sortBy = 'rating',
    vegetarianOnly = false,
    veganOnly = false,
    verifiedPricesOnly = false,
    hasOrigin = false,
  } = options

  const query = foldSearchText(search)
  const categoryFilter = normalizeCategoryParam(cuisineType)

  let list = restaurants.filter((r) => {
    if (verifiedPricesOnly && !hasVerifiedPrice(r)) return false

    if (maxBudget !== '') {
      const comparePrice = getBudgetComparePrice(r)
      if (comparePrice == null || comparePrice > Number(maxBudget)) return false
    }

    if (categoryFilter !== '') {
      const cat = getRestaurantCategory(r)
      if (cat !== categoryFilter) return false
    }

    if (maxDistance !== '' && hasOrigin) {
      if (r.distanceKm == null || r.distanceKm > Number(maxDistance)) return false
    }

    // veganFriendly splňuje i vegetariánský filtr. Když jsou oba aktivní, platí přísnější vegan.
    if (veganOnly) {
      if (!r.veganFriendly) return false
    } else if (vegetarianOnly) {
      if (!r.vegetarianFriendly && !r.veganFriendly) return false
    }

    if (query) {
      const haystack = foldSearchText(`${r.name} ${r.address ?? ''}`)
      if (!haystack.includes(query)) return false
    }

    return true
  })

  list = [...list].sort((a, b) => {
    switch (sortBy) {
      case 'price-asc':
        return compareByPrice(a, b, 'asc')
      case 'price-desc':
        return compareByPrice(a, b, 'desc')
      case 'distance':
        return missingLast(a, b, (r) => r.distanceKm, 'asc')
      case 'rating':
      default:
        return missingLast(
          a,
          b,
          (r) => (r.googleRatingStatus === 'verified' ? r.googleRating : null),
          'desc',
        )
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
    sortBy: searchParams.get('sort') ?? 'rating',
    veganOnly,
    vegetarianOnly: veganOnly ? false : vegetarianOnly,
    verifiedPricesOnly: searchParams.get('verified') === '1',
  }
}

export function buildResultsSearchParams(filters) {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set('q', filters.search.trim())
  if (filters.maxBudget) params.set('budget', filters.maxBudget)
  if (filters.cuisineType) params.set('type', filters.cuisineType)
  if (filters.maxDistance) params.set('distance', filters.maxDistance)
  if (filters.sortBy && filters.sortBy !== 'rating') params.set('sort', filters.sortBy)
  if (filters.veganOnly) {
    params.set('vegan', '1')
  } else if (filters.vegetarianOnly) {
    params.set('veg', '1')
  }
  if (filters.verifiedPricesOnly) params.set('verified', '1')
  return params
}
