/**
 * Konfigurovatelné mapové podklady.
 *
 * Výchozí: OpenFreeMap Liberty (vektor přes MapLibre) — bez API klíče.
 * Carto Voyager raster od 2026-09-25 vyžaduje free klíč → jen s VITE_CARTO_API_KEY.
 * Vlastní raster: VITE_MAP_TILE_URL se šablonou {z}/{x}/{y}.
 *
 * Nevolá tile.openstreetmap.org (OSMF Tile Usage Policy zakazuje těžké použití v aplikacích).
 */

const CARTO_VOYAGER =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" rel="noreferrer">CARTO</a>'

/** Positron: světlý podklad s méně POI ikonami — naše značky podniků jsou pak čitelnější. */
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" rel="noreferrer">OpenFreeMap</a> <a href="https://www.openmaptiles.org" rel="noreferrer">&copy; OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap</a>'

function cartoKey(env) {
  return String(env?.VITE_CARTO_API_KEY || env?.VITE_MAP_TILE_KEY || '').trim()
}

export function resolveMapTileConfig(env = import.meta.env) {
  const custom = String(env?.VITE_MAP_TILE_URL || '').trim()
  const attributionOverride = String(env?.VITE_MAP_TILE_ATTRIBUTION || '').trim()

  if (custom.includes('{z}') && custom.includes('{x}') && custom.includes('{y}')) {
    return {
      mode: 'raster',
      url: custom,
      attribution: attributionOverride || CARTO_ATTRIBUTION,
      provider: 'custom',
      subdomains: String(env?.VITE_MAP_TILE_SUBDOMAINS || 'abcd'),
    }
  }

  const key = cartoKey(env)
  if (key) {
    const sep = CARTO_VOYAGER.includes('?') ? '&' : '?'
    return {
      mode: 'raster',
      url: `${CARTO_VOYAGER}${sep}key=${encodeURIComponent(key)}`,
      attribution: attributionOverride || CARTO_ATTRIBUTION,
      provider: 'carto-voyager',
      subdomains: 'abcd',
    }
  }

  return {
    mode: 'vector-style',
    styleUrl: OPENFREEMAP_STYLE,
    attribution: attributionOverride || OPENFREEMAP_ATTRIBUTION,
    provider: 'openfreemap-positron',
    subdomains: '',
  }
}
