/**
 * Kompaktní zápis ilustrací: sdílené assety jednou + mapa placeId → key,
 * plus place-specific záznamy (pilot). Spouští se na konci bulk skriptu.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { placeFoodIllustrationsPilot } from '../src/data/placeFoodIllustrations.pilot.js'

const DATA_PATH = new URL('../src/data/placeFoodIllustrations.js', import.meta.url)
const STATE_PATH = new URL('../reports/openverse-food-bulk-state.json', import.meta.url)

if (!existsSync(STATE_PATH)) {
  console.error('Chybí bulk state – nejdřív spusť assign-openverse-food-bulk.mjs')
  process.exit(1)
}

const state = JSON.parse(readFileSync(STATE_PATH, 'utf8'))
const sharedAssets = {}
for (const [key, asset] of Object.entries(state.dishAssets || {})) {
  if (!asset?.publicUrl || asset.status === 'not_found' || asset.status === 'download_failed') continue
  sharedAssets[key] = {
    foodIllustrationKind: 'openverse',
    foodIllustrationUrl: asset.publicUrl,
    foodIllustrationDish: asset.dish || key,
    foodIllustrationLicense: asset.license || '',
    foodIllustrationLicenseUrl: asset.licenseUrl || '',
    foodIllustrationCreator: asset.creator || '',
    foodIllustrationCreatorUrl: asset.creatorUrl || '',
    foodIllustrationSourceUrl: asset.sourceUrl || '',
    foodIllustrationOpenverseId: asset.openverseId || '',
    foodIllustrationAttribution: asset.attribution || '',
    foodIllustrationOriginalUrl: asset.originalUrl || '',
    foodIllustrationSharedKey: key,
  }
}

const placeSpecific = {}
for (const [id, rec] of Object.entries(placeFoodIllustrationsPilot)) {
  placeSpecific[id] = { ...rec }
}

const placeDishKey = {}
for (const [id, row] of Object.entries(state.placeRows || {})) {
  if (row.status === 'kept_official') continue
  if (placeSpecific[id]) continue
  if (row.status === 'assigned_shared' && row.dishKey && sharedAssets[row.dishKey]) {
    placeDishKey[id] = row.dishKey
  }
}

const body = `/** Ilustrace jídel z Openverse (kompaktní). Regeneruj: npm run data:openverse-food-bulk */
export const placeFoodIllustrationShared = ${JSON.stringify(sharedAssets, null, 2)}

/** placeId → dish key ze shared mapy */
export const placeFoodIllustrationDishKey = ${JSON.stringify(placeDishKey, null, 2)}

/** Place-specific ilustrace (pilot / výjimky) */
export const placeFoodIllustrationsPlaceSpecific = ${JSON.stringify(placeSpecific, null, 2)}

/** Rozbalený záznam pro jeden podnik (nebo null). */
export function getPlaceFoodIllustration(placeId) {
  if (placeFoodIllustrationsPlaceSpecific[placeId]) {
    return placeFoodIllustrationsPlaceSpecific[placeId]
  }
  const key = placeFoodIllustrationDishKey[placeId]
  if (!key) return null
  const shared = placeFoodIllustrationShared[key]
  if (!shared) return null
  return shared
}

/** Zpětná kompatibilita: lazy proxy objekt placeId → metadata. */
export const placeFoodIllustrations = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined
      if (prop === '__esModule') return false
      return getPlaceFoodIllustration(prop) || undefined
    },
    has(_t, prop) {
      return Boolean(getPlaceFoodIllustration(prop))
    },
    ownKeys() {
      return [
        ...Object.keys(placeFoodIllustrationsPlaceSpecific),
        ...Object.keys(placeFoodIllustrationDishKey),
      ]
    },
    getOwnPropertyDescriptor(_t, prop) {
      const value = getPlaceFoodIllustration(prop)
      if (!value) return undefined
      return { configurable: true, enumerable: true, value }
    },
  },
)
`

writeFileSync(DATA_PATH, body, 'utf8')
console.log({
  shared: Object.keys(sharedAssets).length,
  placeSpecific: Object.keys(placeSpecific).length,
  mapped: Object.keys(placeDishKey).length,
})
