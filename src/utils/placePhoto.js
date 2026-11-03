export function officialHero(restaurant) {
  if (restaurant?.heroImageKind !== 'official') return null
  if (!restaurant.heroImageUrl) return null
  return {
    kind: 'official',
    rights: restaurant.heroImageRights === 'documented' ? 'documented' : 'undocumented',
    url: restaurant.heroImageUrl,
    alt: restaurant.heroImageAlt || `Jídlo z oficiálního webu – ${restaurant.name}`,
    source: restaurant.heroImageSource || restaurant.officialWebsite,
    transparent: Boolean(restaurant.heroImageTransparent),
  }
}

export function foodIllustration(restaurant) {
  const kind = restaurant?.foodIllustrationKind
  if (kind !== 'openverse' && kind !== 'pixabay') return null
  if (!restaurant.foodIllustrationUrl) return null
  const dish = restaurant.foodIllustrationDish || 'jídlo'
  return {
    kind: 'illustration',
    provider: kind,
    url: restaurant.foodIllustrationUrl,
    detailUrl: restaurant.foodIllustrationDetailUrl || restaurant.foodIllustrationUrl,
    srcSet: restaurant.foodIllustrationSrcSet || '',
    width: restaurant.foodIllustrationWidth || undefined,
    height: restaurant.foodIllustrationHeight || undefined,
    color: restaurant.foodIllustrationColor || '',
    alt:
      restaurant.foodIllustrationAlt ||
      `Ilustrační fotografie: ${dish} (ne jídlo z podniku ${restaurant.name || ''})`,
    dish,
    theme: restaurant.foodIllustrationTheme || '',
    pixabayId: restaurant.foodIllustrationPixabayId,
    license: restaurant.foodIllustrationLicense || '',
    licenseUrl: restaurant.foodIllustrationLicenseUrl || '',
    creator: restaurant.foodIllustrationCreator || '',
    creatorUrl: restaurant.foodIllustrationCreatorUrl || '',
    sourceUrl: restaurant.foodIllustrationSourceUrl || '',
    attribution: restaurant.foodIllustrationAttribution || '',
  }
}

/**
 * Doložená oficiální fotka má přednost.
 * Ilustrace z Pixabay nahradí hotlink z webu podniku, u kterého není doložená licence.
 * Jinak zůstane oficiální snímek a až po něm starší ilustrace.
 */
export function resolveDetailHero(restaurant) {
  const official = officialHero(restaurant)
  const illustration = foodIllustration(restaurant)
  if (official?.rights === 'documented') return official
  if (illustration?.provider === 'pixabay') return illustration
  return official || illustration || null
}

export function licenseLabel(license) {
  const key = String(license || '').toLowerCase()
  if (key === 'cc0') return 'CC0'
  if (key === 'pdm') return 'Public Domain'
  if (key === 'by') return 'CC BY'
  if (key === 'by-sa') return 'CC BY-SA'
  if (key === 'pixabay') return 'Pixabay'
  return license || ''
}

export function needsAttribution(license) {
  const key = String(license || '').toLowerCase()
  return key === 'by' || key === 'by-sa'
}
