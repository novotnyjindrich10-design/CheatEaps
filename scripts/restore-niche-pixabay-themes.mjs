/**
 * Po regeneraci Pixabay knihovny obnoví niche témata, která SEARCHES nepokrývají
 * (bubble_tea, indian, poke, baguette, vegetarianske), ze snapshotu HEAD + lokálních souborů.
 * Pak znovu přiřadí podniky s odpovídajícím dishSpec.
 *
 *   node scripts/restore-niche-pixabay-themes.mjs
 */
import { execSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { getCategoryOverride } from '../src/data/categoryOverrides.js'
import { placePhotos } from '../src/data/placePhotos.js'
import { dishSpecForPlace } from './lib/openverseFoodShared.mjs'
import { assignPhotoIds } from './lib/pixabaySelect.mjs'
import {
  pixabayManualPhotoByPlaceId,
  pixabayManualPhotos,
} from '../src/data/pixabayManualPicks.js'
import {
  pixabayPhotosById as currentPhotos,
  pixabayIdsByTheme as currentThemes,
  placePixabayPhotoId as currentAssignment,
  pixabayGeneratedAt,
} from '../src/data/pixabayLibrary.data.js'

const NICHE = ['bubble_tea', 'indian', 'poke', 'baguette', 'vegetarianske']
const DATA_PATH = fileURLToPath(new URL('../src/data/pixabayLibrary.data.js', import.meta.url))

function localExists(photo) {
  const url = photo?.cardUrl || ''
  if (!url.startsWith('/food-illustrations/pixabay/')) return false
  return existsSync(fileURLToPath(new URL(`../public${url}`, import.meta.url)))
}

function loadPreviousLibrary() {
  const raw = execSync('git show HEAD:src/data/pixabayLibrary.data.js', { encoding: 'utf8' })
  const tmp = fileURLToPath(new URL('../reports/_pixabay_head_snapshot.mjs', import.meta.url))
  writeFileSync(tmp, raw)
  return import(`../reports/_pixabay_head_snapshot.mjs?t=${Date.now()}`)
}

function places() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (!byId.has(entry.id)) byId.set(entry.id, entry)
  }
  return [...byId.values()].map((entry) => {
    const override = getCategoryOverride(entry.id)
    return {
      ...entry,
      category: override?.category || entry.category || 'neuvedeno',
      type: override?.type || entry.type,
      description: override?.description || entry.description,
    }
  })
}

function writeLibrary({ photosById, idsByTheme, assignment, generatedAt }) {
  const body = `/**
 * Vygenerováno scripts/fetch-pixabay-illustrations.mjs z Pixabay API.
 * Niche témata doplněna scripts/restore-niche-pixabay-themes.mjs.
 * V souboru jsou jen lokální cesty stažených náhledů, ne cizí URL.
 * Ruční výjimky drží src/data/pixabayManualPicks.js.
 */
export const pixabayLibraryReady = ${Object.keys(assignment).length > 0}

export const pixabayGeneratedAt = ${JSON.stringify(generatedAt)}

export const pixabayPhotosById = ${JSON.stringify(photosById, null, 2)}

export const pixabayIdsByTheme = ${JSON.stringify(idsByTheme, null, 2)}

export const placePixabayPhotoId = ${JSON.stringify(assignment, null, 2)}
`
  writeFileSync(DATA_PATH, body)
}

async function main() {
  const prev = await loadPreviousLibrary()
  const photosById = { ...currentPhotos }
  const idsByTheme = { ...currentThemes }

  const claimedNiche = new Set()
  for (const theme of NICHE) {
    const prevIds = prev.pixabayIdsByTheme?.[theme] || []
    const kept = []
    for (const id of prevIds) {
      const numId = Number(id)
      if (claimedNiche.has(numId)) continue
      const photo = prev.pixabayPhotosById?.[id]
      if (!photo || !localExists(photo)) continue
      photosById[numId] = { ...photo, theme, dish: photo.dish }
      kept.push(numId)
      claimedNiche.add(numId)
    }
    if (kept.length) idsByTheme[theme] = kept
    console.log(`${theme}: restored ${kept.length}`)
  }

  // Niche ID nesmí zůstat v jiném tématu (jinak neuvedeno dostane poke snímek).
  for (const theme of Object.keys(idsByTheme)) {
    if (NICHE.includes(theme)) continue
    idsByTheme[theme] = (idsByTheme[theme] || []).filter((id) => !claimedNiche.has(Number(id)))
  }

  const placeIdsByTheme = {}
  for (const place of places()) {
    // Stejně jako fetch-pixabay: přiřazení i u oficiálních (UI bere official first).
    void placePhotos
    const spec = dishSpecForPlace(place)
    let theme = spec.key
    if (!idsByTheme[theme]?.length) theme = idsByTheme.neuvedeno?.length ? 'neuvedeno' : theme
    if (!idsByTheme[theme]?.length) continue
    if (!placeIdsByTheme[theme]) placeIdsByTheme[theme] = []
    placeIdsByTheme[theme].push(place.id)
  }
  for (const ids of Object.values(placeIdsByTheme)) ids.sort()

  const assignment = assignPhotoIds(placeIdsByTheme, idsByTheme)

  // Preserve manual picks
  for (const [placeId, photoId] of Object.entries(pixabayManualPhotoByPlaceId)) {
    const photo = pixabayManualPhotos[photoId] || photosById[photoId]
    if (!photo || !localExists(photo)) continue
    photosById[photoId] = { ...photo }
    assignment[placeId] = Number(photoId)
  }

  // Keep any previous assignment only if still valid? Full reassignment is intentional.
  writeLibrary({
    photosById,
    idsByTheme,
    assignment,
    generatedAt: pixabayGeneratedAt || new Date().toISOString(),
  })
  console.log(`Assignment: ${Object.keys(assignment).length} places, library ${Object.keys(photosById).length}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
