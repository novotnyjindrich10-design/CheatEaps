import { curatedPlaces } from './curatedPlaces'
import { osmPlaces } from './osmPlaces'
import { verifiedPrices } from './verifiedPrices'
import { estimatedPrices } from './estimatedPrices'
import { googleRatings } from './googleRatings'
import { officialWebsites } from './officialWebsites'
import { osmFacts } from './osmFacts'
import { placeCoordinates } from './placeCoordinates'
import { coordinateOverrides } from './coordinateOverrides'
import { placePhotos } from './placePhotos'
import { getPlaceFoodIllustration } from './placeFoodIllustrations'
import { getPlacePixabayIllustration } from './pixabayLibrary'
import { getCategoryOverride } from './categoryOverrides'
import { getSecondaryCategoryInfo } from './secondaryCategories'
import { isCatalogExcluded } from './catalogExclusions'
import { hasVerifiedCoordinates } from '../utils/geo'
export { DATA_SOURCE_NOTES, DEMO_DATA_NOTICE } from './sourceNotes.js'

function place(entry) {
  const override = getCategoryOverride(entry.id)
  const secondaryInfo = getSecondaryCategoryInfo(entry.id)
  const category = override?.category || entry.category || ''
  const estimate = estimatedPrices[entry.id] || {}
  const verified = verifiedPrices[entry.id] || {}
  const google = googleRatings[entry.id] || {}
  const facts = osmFacts[entry.id] || {}
  const site = officialWebsites[entry.id] || {}
  const coords = {
    ...(placeCoordinates[entry.id] || {}),
    ...(coordinateOverrides[entry.id] || {}),
  }
  const photo = placePhotos[entry.id] || {}
  // removeIllustration platí pro celý stock (Pixabay i Openverse), ne jen Openverse.
  // Vedlejší kategorie NESMÍ přepisovat hlavní fotografii / dish theme.
  const foodIllustration = override?.removeIllustration
    ? {}
    : getPlacePixabayIllustration(entry.id) || getPlaceFoodIllustration(entry.id) || {}
  const secondaryCategories = Array.isArray(secondaryInfo?.secondary)
    ? secondaryInfo.secondary.filter((value) => value && value !== category)
    : []
  const verifiedProducts = Array.isArray(secondaryInfo?.products) ? secondaryInfo.products : []
  const restaurant = {
    isDemo: false,
    vegetarianFriendly: false,
    veganFriendly: false,
    ...entry,
    ...estimate,
    ...verified,
    ...google,
    ...facts,
    ...site,
    ...coords,
    ...photo,
    ...foodIllustration,
    category,
    type: override?.type || entry.type,
    description: override?.description || entry.description,
    cuisineType: category,
    secondaryCategories,
    verifiedProducts,
  }
  restaurant.locationVerified = hasVerifiedCoordinates(restaurant)
  return restaurant
}

const byId = new Map()
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (!entry?.id || isCatalogExcluded(entry.id)) continue
  if (!byId.has(entry.id)) byId.set(entry.id, entry)
}

export const demoRestaurants = [...byId.values()].map(place)
