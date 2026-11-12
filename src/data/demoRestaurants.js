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
import { getPlacePixabayIllustration, pixabayLibraryReady } from './pixabayLibrary'
import { getCategoryOverride } from './categoryOverrides'
import { hasVerifiedCoordinates } from '../utils/geo'

/** Poznámky o zdrojích. Odpovídají tomu, co aplikace skutečně ukazuje. */
export const DATA_SOURCE_NOTES = [
  'Názvy a adresy pocházejí z oficiálních webů podniků a z OpenStreetMap (licence ODbL).',
  pixabayLibraryReady
    ? 'Ilustrační fotografie pocházejí z Pixabay, jsou uložené u nás a nejsou snímkem konkrétního podniku. U každé je autor a odkaz na Pixabay. Fotografii z webu podniku ukazujeme jen tam, kde je její použití doložené.'
    : 'Na detailu podniku je fotografie z webu podniku, pokud ji máme. Samotná adresa na webu není doložená licence k dalšímu užití. Jinak může být ilustrační fotografie typického jídla (Openverse, CC0/PDM/CC BY/CC BY-SA) nebo kresba typu kuchyně — ani jedno není snímek konkrétního podniku.',
  'Ověřenou cenu uvádíme jen s odkazem na menu. Cenový filtr bere ověřenou cenu; u rozpětí musí do limitu vejít i horní mez.',
  'Přesná poloha se na náš server neposílá. Vzdálenost je délka pěší trasy z OpenStreetMap. Podnik bez ověřené polohy ji nemá a bez polohy uživatele se číslo nezobrazí.',
  'Oficiální weby pocházejí z OpenStreetMap nebo z ručně ověřených záznamů, ne z katalogů.',
  'Otevírací dobu a telefon bereme z OpenStreetMap, pokud je zápis čitelný. Neověřujeme je nezávisle. Stav Otevřeno/Zavřeno ukazujeme jen u jednoduchých a spolehlivých zápisů (Europe/Prague); složité pravidla necháváme jako neznámá.',
  'Google hodnocení zobrazujeme jako ověřené pouze po ověření přes Places API. Bez tohoto ověření je u podniku jen odkaz na vyhledání v Mapách.',
  'Ověřené slevy jsou jen v kategorii Slevy po přihlášení. Podmínky a odkaz Ověřit nabídku jsou u konkrétní nabídky; kód uplatnění je až po přihlášení. Běžné výsledky ani detail podniku slevu nezobrazují.',
]

export const DEMO_DATA_NOTICE = DATA_SOURCE_NOTES.join(' ')

function place(entry) {
  const override = getCategoryOverride(entry.id)
  const category = override?.category || entry.category || ''
  const estimate = estimatedPrices[entry.id] || {}
  const verified = verifiedPrices[entry.id] || {}
  const google = googleRatings[entry.id] || {}
  const facts = osmFacts[entry.id] || {}
  const site = officialWebsites[entry.id] || {}
  const coords = placeCoordinates[entry.id] || {}
  const photo = placePhotos[entry.id] || {}
  const openverseIllustration = override?.removeIllustration
    ? null
    : getPlaceFoodIllustration(entry.id)
  const foodIllustration = getPlacePixabayIllustration(entry.id) || openverseIllustration || {}
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
  }
  restaurant.locationVerified = hasVerifiedCoordinates(restaurant)
  return restaurant
}

const byId = new Map()
for (const entry of [...curatedPlaces, ...osmPlaces]) {
  if (!byId.has(entry.id)) byId.set(entry.id, entry)
}

export const demoRestaurants = [...byId.values()].map(place)
