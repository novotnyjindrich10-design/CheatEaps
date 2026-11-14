import {
  pixabayGeneratedAt,
  pixabayIdsByTheme,
  pixabayLibraryReady,
  pixabayPhotosById,
  placePixabayPhotoId,
} from './pixabayLibrary.data.js'

export {
  pixabayGeneratedAt,
  pixabayIdsByTheme,
  pixabayLibraryReady,
  pixabayPhotosById,
  placePixabayPhotoId,
}

function illustrationLicense(photo) {
  const page = String(photo?.pageUrl || '')
  const explicit = String(photo?.license || '').trim().toLowerCase()
  if (explicit === 'unsplash' || page.includes('unsplash.com')) {
    return {
      kind: 'unsplash',
      license: 'unsplash',
      licenseUrl: photo.licenseUrl || 'https://unsplash.com/license',
      fallbackSource: 'https://unsplash.com/',
    }
  }
  if (explicit === 'pexels' || page.includes('pexels.com')) {
    return {
      kind: 'pexels',
      license: 'pexels',
      licenseUrl: photo.licenseUrl || 'https://www.pexels.com/license/',
      fallbackSource: 'https://www.pexels.com/',
    }
  }
  return {
    kind: 'pixabay',
    license: 'pixabay',
    licenseUrl: photo.licenseUrl || 'https://pixabay.com/service/license-summary/',
    fallbackSource: 'https://pixabay.com/',
  }
}

export function illustrationFromPhoto(photo) {
  if (!photo || !Number.isInteger(photo.id) || photo.id <= 0) return null
  if (!photo.cardUrl || !photo.detailUrl || !photo.theme || !photo.dish) return null
  const cardUrl = String(photo.cardUrl)
  if (
    !cardUrl.startsWith('/food-illustrations/pixabay/') &&
    !cardUrl.startsWith('/food-illustrations/unsplash/')
  ) {
    return null
  }
  const lic = illustrationLicense(photo)
  return {
    foodIllustrationKind: lic.kind === 'pixabay' ? 'pixabay' : lic.kind,
    foodIllustrationUrl: photo.cardUrl,
    foodIllustrationDetailUrl: photo.detailUrl,
    foodIllustrationSrcSet: '',
    foodIllustrationDish: photo.dish,
    foodIllustrationTheme: photo.theme,
    foodIllustrationLicense: lic.license,
    foodIllustrationLicenseUrl: lic.licenseUrl,
    foodIllustrationCreator: photo.user || '',
    foodIllustrationCreatorUrl: photo.profileUrl || '',
    foodIllustrationSourceUrl: photo.pageUrl || lic.fallbackSource,
    // Keep library key for all providers so page diversify + uniqueness stay stable.
    foodIllustrationPixabayId: photo.id,
    foodIllustrationWidth: photo.width || 1280,
    foodIllustrationHeight: photo.height || 720,
  }
}

export function getPlacePixabayIllustration(placeId) {
  const photoId = placePixabayPhotoId[placeId]
  if (!Number.isInteger(photoId)) return null
  return illustrationFromPhoto(pixabayPhotosById[photoId])
}
