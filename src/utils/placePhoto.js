export function officialHero(restaurant) {
  if (restaurant?.heroImageKind !== 'official') return null
  if (!restaurant.heroImageUrl) return null
  return {
    url: restaurant.heroImageUrl,
    alt: restaurant.heroImageAlt || `Jídlo z oficiálního webu – ${restaurant.name}`,
    source: restaurant.heroImageSource || restaurant.officialWebsite,
    transparent: Boolean(restaurant.heroImageTransparent),
  }
}
