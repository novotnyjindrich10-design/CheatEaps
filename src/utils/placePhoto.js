export function officialHero(restaurant) {
  if (restaurant?.heroImageKind !== 'official') return null
  if (!restaurant.heroImageUrl) return null
  return {
    kind: 'official',
    url: restaurant.heroImageUrl,
    alt: restaurant.heroImageAlt || `Jídlo z oficiálního webu – ${restaurant.name}`,
    source: restaurant.heroImageSource || restaurant.officialWebsite,
    transparent: Boolean(restaurant.heroImageTransparent),
  }
}

export function foodIllustration(restaurant) {
  if (restaurant?.foodIllustrationKind !== 'openverse') return null
  if (!restaurant.foodIllustrationUrl) return null
  return {
    kind: 'illustration',
    url: restaurant.foodIllustrationUrl,
    alt:
      restaurant.foodIllustrationAlt ||
      `Ilustrační fotografie: ${restaurant.foodIllustrationDish || 'jídlo'} (ne jídlo z podniku ${restaurant.name || ''})`,
    dish: restaurant.foodIllustrationDish || '',
    license: restaurant.foodIllustrationLicense || '',
    licenseUrl: restaurant.foodIllustrationLicenseUrl || '',
    creator: restaurant.foodIllustrationCreator || '',
    creatorUrl: restaurant.foodIllustrationCreatorUrl || '',
    sourceUrl: restaurant.foodIllustrationSourceUrl || '',
    attribution: restaurant.foodIllustrationAttribution || '',
  }
}

/** Detail: oficiální foto → ilustrace jídla → null (SVG kuchyně). */
export function resolveDetailHero(restaurant) {
  return officialHero(restaurant) || foodIllustration(restaurant) || null
}

export function licenseLabel(license) {
  const key = String(license || '').toLowerCase()
  if (key === 'cc0') return 'CC0'
  if (key === 'pdm') return 'Public Domain'
  if (key === 'by') return 'CC BY'
  if (key === 'by-sa') return 'CC BY-SA'
  return license || ''
}

export function needsAttribution(license) {
  const key = String(license || '').toLowerCase()
  return key === 'by' || key === 'by-sa'
}
