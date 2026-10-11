import { getVerifiedPriceCeiling } from './price.js'

/** Štítky zobrazované na kartách podniků. */
export function getRestaurantTags(restaurant) {
  const tags = []

  if (restaurant.veganFriendly) {
    tags.push({ key: 'vegan', label: 'Veganské', tone: 'mint' })
  } else if (restaurant.vegetarianFriendly) {
    tags.push({ key: 'veg', label: 'Vegetariánské', tone: 'green' })
  }

  const budgetPrice = getVerifiedPriceCeiling(restaurant)
  if (budgetPrice != null && budgetPrice <= 120) {
    tags.push({ key: 'budget', label: 'Do 120 Kč', tone: 'sky' })
  }

  if (restaurant.lunchMenu) {
    tags.push({ key: 'lunch', label: 'Polední menu', tone: 'sky' })
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
