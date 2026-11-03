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

export function illustrationFromPhoto(photo) {
  if (!photo || !Number.isInteger(photo.id) || photo.id <= 0) return null
  if (!photo.cardUrl || !photo.detailUrl || !photo.theme || !photo.dish) return null
  if (!String(photo.cardUrl).startsWith('/food-illustrations/pixabay/')) return null
  return {
    foodIllustrationKind: 'pixabay',
    foodIllustrationUrl: photo.cardUrl,
    foodIllustrationDetailUrl: photo.detailUrl,
    foodIllustrationSrcSet: '',
    foodIllustrationDish: photo.dish,
    foodIllustrationTheme: photo.theme,
    foodIllustrationLicense: 'pixabay',
    foodIllustrationLicenseUrl: 'https://pixabay.com/service/license-summary/',
    foodIllustrationCreator: photo.user || '',
    foodIllustrationCreatorUrl: photo.profileUrl || '',
    foodIllustrationSourceUrl: photo.pageUrl || 'https://pixabay.com/',
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
