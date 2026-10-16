import { demoFoodImage } from './demoImages'
import { curatedPlaces } from './curatedPlaces'
import { osmPlaces } from './osmPlaces'
import { verifiedPrices } from './verifiedPrices'
import { estimatedPrices } from './estimatedPrices'
import { googleRatings } from './googleRatings'
import { officialWebsites } from './officialWebsites'
import { osmFacts } from './osmFacts'
import { placeCoordinates } from './placeCoordinates'
import { placePhotos } from './placePhotos'
import { getPlaceFoodIllustration } from './placeFoodIllustrations'
import { hasVerifiedCoordinates } from '../utils/geo'

/** Poznámky o zdrojích. Odpovídají tomu, co aplikace skutečně ukazuje. */
export const DATA_SOURCE_NOTES = [
  'Názvy a adresy pocházejí z oficiálních webů podniků a z OpenStreetMap (licence ODbL).',
  'Na detailu podniku je fotografie z oficiálního webu, pokud ji máme. Jinak může být ilustrační fotografie typického jídla (Openverse, CC0/PDM/CC BY/CC BY-SA) nebo SVG ilustrace typu kuchyně — ani jedno není snímek konkrétního podniku.',
  'Ověřenou cenu uvádíme jen s odkazem na menu. Cenový filtr bere ověřenou cenu; u rozpětí musí do limitu vejít i horní mez.',
  'Vzdálenost je délka pěší trasy z OpenStreetMap. Podnik bez ověřené polohy ji nemá a bez polohy uživatele se číslo nezobrazí.',
  'Oficiální weby pocházejí z OpenStreetMap nebo z ručně ověřených záznamů, ne z katalogů.',
  'Google hodnocení zobrazujeme jako ověřené pouze po ověření přes Places API. Bez tohoto ověření je u podniku jen odkaz na vyhledání v Mapách.',
]

export const DEMO_DATA_NOTICE = DATA_SOURCE_NOTES.join(' ')

function place(entry) {
  const category = entry.category || ''
  const estimate = estimatedPrices[entry.id] || {}
  const verified = verifiedPrices[entry.id] || {}
  const google = googleRatings[entry.id] || {}
  const facts = osmFacts[entry.id] || {}
  const site = officialWebsites[entry.id] || {}
  const coords = placeCoordinates[entry.id] || {}
  const photo = placePhotos[entry.id] || {}
  const foodIllustration = getPlaceFoodIllustration(entry.id) || {}
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
    cuisineType: category,
    imageUrl: demoFoodImage(category || 'ceske', entry.id),
    imageAlt: `Ilustrační fotografie – ${entry.name}`,
  }
  restaurant.locationVerified = hasVerifiedCoordinates(restaurant)
  return restaurant
}

const byId = new Map()
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (!byId.has(entry.id)) byId.set(entry.id, entry)
}

export const demoRestaurants = [...byId.values()].map(place)
