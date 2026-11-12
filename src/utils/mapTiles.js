/**
 * Konfigurovatelné mapové dlaždice.
 * Výchozí: Carto Voyager (vyžaduje atribuci). Nevolá tile.openstreetmap.org.
 * Vlastní šablonu nastav přes VITE_MAP_TILE_URL (např. {z}/{x}/{y}).
 */

const CARTO_VOYAGER =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" rel="noreferrer">CARTO</a>'

export function resolveMapTileConfig(env = import.meta.env) {
  const custom = String(env?.VITE_MAP_TILE_URL || '').trim()
  const attribution = String(env?.VITE_MAP_TILE_ATTRIBUTION || '').trim() || CARTO_ATTRIBUTION
  if (custom.includes('{z}') && custom.includes('{x}') && custom.includes('{y}')) {
    return {
      url: custom,
      attribution,
      provider: 'custom',
      subdomains: String(env?.VITE_MAP_TILE_SUBDOMAINS || 'abcd'),
    }
  }
  return {
    url: CARTO_VOYAGER,
    attribution: CARTO_ATTRIBUTION,
    provider: 'carto-voyager',
    subdomains: 'abcd',
  }
}
