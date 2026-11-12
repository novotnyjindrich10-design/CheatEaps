/**
 * Jednotný mediální záznam pro karty, detail i SEO.
 * imageUrl / imageSource / attribution / license / verified / updatedAt
 * mapují existující heroImage* a foodIllustration* pole.
 */
export function toMediaRecord(photo) {
  if (!photo?.url && !photo?.detailUrl) return null
  return {
    imageUrl: photo.detailUrl || photo.url,
    imageSource: photo.source || photo.sourceUrl || photo.provider || photo.kind || '',
    attribution: photo.attribution || photo.creator || '',
    license: photo.license || '',
    verified: photo.kind === 'official'
      ? photo.rights === 'documented'
      : photo.kind === 'google_places'
        ? Boolean(photo.verified)
        : Boolean(photo.license),
    updatedAt: photo.updatedAt || '',
    kind: photo.kind,
  }
}

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
    updatedAt: restaurant.heroImageUpdatedAt || '',
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
    updatedAt: restaurant.foodIllustrationUpdatedAt || '',
  }
}

/**
 * Google Places Photo — připravené na pozdější zapnutí.
 * Nikdy nevrátí URL bez explicitního googlePhotoEnabled=true na záznamu
 * a bez lokálně připravené (ne scrapované) imageUrl.
 * Živé placené Places Photo volání se tady neprovádí.
 */
export function googlePlacesPhoto(restaurant) {
  if (restaurant?.googlePhotoEnabled !== true) return null
  if (!restaurant.googlePhotoUrl) return null
  if (!String(restaurant.googlePhotoUrl).startsWith('/')) return null
  return {
    kind: 'google_places',
    verified: true,
    url: restaurant.googlePhotoUrl,
    alt: restaurant.googlePhotoAlt || `Fotografie podniku ${restaurant.name || ''} (Google Places)`,
    attribution: restaurant.googlePhotoAttribution || 'Google',
    license: 'google-places',
    source: 'google_places',
    updatedAt: restaurant.googlePhotoUpdatedAt || '',
  }
}

/**
 * Doložená oficiální fotka má přednost.
 * Ilustrace z Pixabay nahradí hotlink z webu podniku, u kterého není doložená licence.
 * Google Places jen po explicitním zapnutí a lokálním uložení (bez živých API volání).
 */
export function resolveDetailHero(restaurant) {
  const official = officialHero(restaurant)
  const illustration = foodIllustration(restaurant)
  const google = googlePlacesPhoto(restaurant)
  if (official?.rights === 'documented') return official
  if (google) return google
  if (illustration?.provider === 'pixabay') return illustration
  return official || illustration || null
}

/** Absolutní URL pro OG/share jen ze same-origin cest; jinak logo. */
export function shareImageUrl(restaurant, origin) {
  const base = String(origin || '').replace(/\/$/, '')
  const fallback = `${base}/logo-mark.png`
  const photo = resolveDetailHero(restaurant)
  const path = photo?.detailUrl || photo?.url || ''
  if (!path || !base) return fallback
  if (path.startsWith('/')) return `${base}${path}`
  if (path.startsWith(`${base}/`)) return path
  return fallback
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
