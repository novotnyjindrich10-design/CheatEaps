/**
 * Potvrzené nekulinární záznamy — zůstanou v surových OSM datech,
 * ale veřejný katalog (výpisy, mapa, sitemap, prerender) je skryje.
 * Nejisté položky sem nepatří.
 */
export const CATALOG_EXCLUSIONS = {
  'local-barber-shop-smetanova-5': {
    reason: 'Holičství / barber shop. OSM amenity=cafe je chybné; web localbarber-shop.cz.',
    confidence: 'high',
    evidenceUrl: 'http://www.localbarber-shop.cz/',
  },
}

export function isCatalogExcluded(id) {
  return Boolean(CATALOG_EXCLUSIONS[String(id || '')])
}

export function catalogExclusionIds() {
  return Object.keys(CATALOG_EXCLUSIONS)
}
