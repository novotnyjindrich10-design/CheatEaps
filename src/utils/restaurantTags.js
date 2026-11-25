import { getVerifiedPriceCeiling } from './price.js'

/**
 * Štítek nabídky. Kategorie veganske / vegetarianske znamená zaměření podniku.
 * Samotný příznak z OSM diet:*=yes znamená, že v nabídce takové jídlo je.
 */
export function dietOfferTag(restaurant) {
  const category = restaurant?.category ?? restaurant?.cuisineType
  if (restaurant?.veganFriendly) {
    return {
      key: 'vegan',
      label: category === 'veganske' ? 'Veganské' : 'Veganská jídla',
      tone: 'mint',
    }
  }
  if (restaurant?.vegetarianFriendly) {
    return {
      key: 'veg',
      label: category === 'vegetarianske' ? 'Bez masa' : 'Vegetariánská jídla',
      tone: 'green',
    }
  }
  return null
}

/** Štítky zobrazované na kartách podniků. */
export function getRestaurantTags(restaurant) {
  const tags = []
  const diet = dietOfferTag(restaurant)
  if (diet) tags.push(diet)

  const budgetPrice = getVerifiedPriceCeiling(restaurant)
  if (budgetPrice != null && budgetPrice <= 120) {
    tags.push({ key: 'budget', label: 'Do 120 Kč', tone: 'sky' })
  }

  if (restaurant.lunchMenu) {
    tags.push({ key: 'lunch', label: 'Polední zmínka (OSM)', tone: 'sky' })
  }

  if (
    restaurant.popular ||
    (restaurant.googleRatingStatus === 'verified' &&
      typeof restaurant.googleRating === 'number' &&
      restaurant.googleRating >= 4.5)
  ) {
    tags.push({ key: 'popular', label: 'Oblíbené', tone: 'amber' })
  }

  return tags.slice(0, 3)
}

export function getRestaurantCategory(restaurant) {
  return restaurant.category ?? restaurant.cuisineType
}

/** Ověřené vedlejší kategorie (bez duplicity primární). */
export function getSecondaryCategories(restaurant) {
  const primary = getRestaurantCategory(restaurant)
  const list = Array.isArray(restaurant?.secondaryCategories) ? restaurant.secondaryCategories : []
  return [...new Set(list.map(String).filter((value) => value && value !== primary))]
}

/**
 * primary = hlavní zaměření
 * secondary = ověřená vedlejší kategorie
 * null = žádná shoda kategorie
 */
export function categoryMatchTier(restaurant, category) {
  if (!category) return null
  if (getRestaurantCategory(restaurant) === category) return 'primary'
  if (getSecondaryCategories(restaurant).includes(category)) return 'secondary'
  return null
}

export function restaurantMatchesCategory(restaurant, category) {
  return categoryMatchTier(restaurant, category) != null
}
