/**
 * Známé páry curated + OSM kopie stejného místa (stejné souřadnice / adresa).
 * ID nemažeme — jen skrýváme slabší kopii ve výsledcích.
 */
export const KNOWN_DUPLICATE_PAIRS = [
  ['bistro-franz', 'bistro-franz-veveri-461-14'],
  ['lokal-u-caipla', 'lokal-u-caipla-kozi-3'],
  ['stopkova-plzenska-pivnice', 'stopkova-plzenska-pivnice-ceska-5'],
  ['statl-brno', 'statl-namesti-svobody-3'],
  ['uvozna-burger', 'uvozna-uvoz-39'],
  ['kurdsky-kebab-cejl', 'kurdsky-kebab-cejl-93'],
  ['annapurna-brno', 'annapurna-josefska-14'],
  ['roburrito-pekarska', 'roburrito-pekarska-20'],
  ['skog-urban-hub', 'sk-g-urban-hub-dominikanske-namesti-5'],
  ['monogram-espresso-bar', 'monogram-espresso-bar-kapucinske-namesti-12'],
  ['yakitori-netroufalky-770', 'yakitori-sushi-poke-bar-netroufalky-770'],
]

/**
 * Blízké páry se stejným brandem, ale odlišným amenity / číslem popisným.
 * Neskrýváme automaticky — jen evidence pro ruční kontrolu.
 */
export const UNCERTAIN_NEAR_DUPLICATES = [
  {
    ids: ['point-burger-namesti-svobody-8', 'point-cafe-namesti-svobody-8'],
    note: 'Stejná adresa (~13 m). Burger a kavárna mohou být dva provozy.',
  },
  {
    ids: ['svedska-kavarna-skandinavska-4', 'svedska-restaurace-skandinavska-4'],
    note: 'Stejná adresa (~12 m). OSM cafe vs fast_food — ověřit, jestli jde o jeden podnik.',
  },
  {
    ids: ['trinity-trnita-7', 'trinity-ristorante-trnita-9'],
    note: 'Trnitá 7 (cafe) vs Trnitá 9 (ristorante, ~19 m). Pravděpodobně sousední provozy.',
  },
]

function preferId(a, b, byId) {
  const left = byId.get(a)
  const right = byId.get(b)
  if (left?.curated && !right?.curated) return a
  if (right?.curated && !left?.curated) return b
  const leftLen = String(left?.name || '').length + String(left?.description || '').length
  const rightLen = String(right?.name || '').length + String(right?.description || '').length
  if (leftLen !== rightLen) return leftLen >= rightLen ? a : b
  return a < b ? a : b
}

/** ID, která mají ve výpisu ustoupit bohatšímu / curated záznamu. */
export function duplicateIdsToSuppress(places) {
  const byId = new Map()
  for (const place of places || []) {
    if (place?.id && !byId.has(place.id)) byId.set(place.id, place)
  }
  const hide = new Set()
  for (const [a, b] of KNOWN_DUPLICATE_PAIRS) {
    if (!byId.has(a) || !byId.has(b)) continue
    const keep = preferId(a, b, byId)
    hide.add(keep === a ? b : a)
  }
  return hide
}

/** Odstraní slabší OSM kopie; detail přes přímé ID zůstane dostupný. */
export function suppressCatalogDuplicates(places) {
  const hide = duplicateIdsToSuppress(places)
  if (hide.size === 0) return places
  return places.filter((place) => !hide.has(place.id))
}
