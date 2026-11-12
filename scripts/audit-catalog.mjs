/**
 * Opakovatelný audit kategorií, popisů a Pixabay fotek před vydáním.
 *
 *   node scripts/audit-catalog.mjs
 *   npm run audit:catalog
 *
 * Výstup: reports/catalog-audit.md (+ katalog-audit.json)
 * Exit code 1 při potvrzené chybě (steak→kava, neplatná kategorie, chybějící fotka…).
 */
import { existsSync, writeFileSync } from 'node:fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { categoryOverrides, getCategoryOverride } from '../src/data/categoryOverrides.js'
import { osmFacts } from '../src/data/osmFacts.js'
import { placePixabayPhotoId, pixabayPhotosById } from '../src/data/pixabayLibrary.data.js'
import { ALLOWED_PLACE_CATEGORIES } from '../src/constants/filters.js'
import {
  classifyFromCuisine,
  legacyTeaMatchesSteakHouse,
  safeTeaMatchesSteakHouse,
} from '../src/utils/cuisineClassify.js'
import { foldSearchText } from '../src/utils/smartSearch.js'
import { isReadableOpeningHours } from '../src/utils/osmContact.js'
import { KNOWN_DUPLICATE_PAIRS } from '../src/utils/catalogDuplicates.js'

const REPORT_MD = new URL('../reports/catalog-audit.md', import.meta.url)
const REPORT_JSON = new URL('../reports/catalog-audit.json', import.meta.url)

const EXPECTED_PLACE_COUNT = 775

const STEAK_PHOTO_HINT = /steak|rumpsteak|beef|grill|bbq|meat/
const COFFEE_PHOTO_HINT = /coffee|cappuccino|latte|espresso|mocha|cafe-cup|tea-cup/

function mergePlaces() {
  const byId = new Map()
  for (const entry of [...curatedPlaces, ...osmPlaces]) {
    if (byId.has(entry.id)) continue
    const override = getCategoryOverride(entry.id)
    byId.set(entry.id, {
      ...entry,
      category: override?.category || entry.category,
      type: override?.type || entry.type,
      description: override?.description || entry.description,
      override,
      facts: osmFacts[entry.id] || {},
    })
  }
  return [...byId.values()]
}

function isCoffeePhoto(photo) {
  if (!photo) return false
  if (photo.theme === 'kava') return true
  const dish = String(photo.dish || '').toLowerCase()
  if (dish === 'káva' || dish === 'kava' || dish.includes('čaj')) return true
  return COFFEE_PHOTO_HINT.test(String(photo.pageUrl || '').toLowerCase())
}

function isSteakishPlace(place) {
  const cuisine = String(place.facts.osmCuisine || '').toLowerCase()
  const name = String(place.name || '').toLowerCase()
  return /steak/.test(cuisine) || /steak/.test(name)
}

function runAudit() {
  const places = mergePlaces()
  const confirmed = []
  const suspected = []
  const fixedAlready = []

  // --- klasifikační pravidla ---
  const ruleBugs = []
  if (legacyTeaMatchesSteakHouse('steak_house') && !safeTeaMatchesSteakHouse('steak_house')) {
    // očekávaný stav po opravě
  } else if (safeTeaMatchesSteakHouse('steak_house')) {
    ruleBugs.push({
      id: 'rule:steak_house→kava',
      severity: 'confirmed',
      detail: 'classifyFromCuisine(steak_house) stále vrací kava',
    })
  }
  if (!legacyTeaMatchesSteakHouse('steak_house')) {
    ruleBugs.push({
      id: 'rule:legacy-tea-probe',
      severity: 'suspected',
      detail: 'Legacy regex už na steak_house nesedí — sonda zastaralá',
    })
  }
  const steakClass = classifyFromCuisine('steak_house')
  if (steakClass?.category !== 'neuvedeno') {
    ruleBugs.push({
      id: 'rule:steak_house-expected-neuvedeno',
      severity: 'confirmed',
      detail: `Očekáváno neuvedeno, dostáno ${steakClass?.category}`,
    })
  }
  if (classifyFromCuisine('tea')?.category !== 'kava') {
    ruleBugs.push({
      id: 'rule:tea→kava',
      severity: 'confirmed',
      detail: 'Token tea musí zůstat kavárna',
    })
  }
  if (classifyFromCuisine('coffee_shop')?.category !== 'kava') {
    ruleBugs.push({
      id: 'rule:coffee_shop→kava',
      severity: 'confirmed',
      detail: 'Token coffee_shop musí zůstat kavárna',
    })
  }

  const ids = new Set()
  for (const place of places) {
    if (ids.has(place.id)) {
      confirmed.push({ id: place.id, kind: 'duplicate-id', detail: 'Duplicitní ID v merge' })
    }
    ids.add(place.id)

    if (!ALLOWED_PLACE_CATEGORIES.includes(place.category)) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'invalid-category',
        detail: place.category,
      })
    }


    if (!String(place.name || '').trim()) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'empty-name',
        detail: 'Prázdný název',
      })
    }

    if (!String(place.address || '').trim()) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'empty-address',
        detail: 'Prázdná adresa',
      })
    }

    const website = String(place.website || place.officialWebsite || '').trim()
    if (website) {
      if (!/^https?:\/\//i.test(website) || /\s/.test(website)) {
        confirmed.push({
          id: place.id,
          name: place.name,
          kind: 'invalid-website',
          detail: website.slice(0, 120),
        })
      }
    }

    const hoursRaw = String(place.osmOpeningHours || place.facts?.opening_hours || '').trim()
    if (hoursRaw && !isReadableOpeningHours(hoursRaw) && place.osmOpeningHoursDisplay) {
      suspected.push({
        id: place.id,
        name: place.name,
        kind: 'hours-display-without-readable-raw',
        detail: hoursRaw.slice(0, 80),
      })
    }

    if (placePixabayPhotoId[place.id] == null) {
      suspected.push({
        id: place.id,
        name: place.name,
        kind: 'missing-photo-assignment',
        detail: 'Žádné Pixabay ID',
      })
    }

    const lat = Number(place.lat)
    const lon = Number(place.lon)
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      // Brno bounding box (approx) — mimo je podezření, ne potvrzená chyba
      if (lat < 48.95 || lat > 49.35 || lon < 16.35 || lon > 16.85) {
        suspected.push({
          id: place.id,
          name: place.name,
          kind: 'coords-outside-brno',
          detail: `${lat},${lon}`,
        })
      }
    } else if (place.lat != null || place.lon != null) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'invalid-coords',
        detail: `lat=${place.lat}; lon=${place.lon}`,
      })
    }

    const price = Number(place.price)
    const priceMax = Number(place.priceMax)
    if (Number.isFinite(price) && (price < 0 || price > 5000)) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'nonsense-price',
        detail: `price=${place.price}`,
      })
    }
    if (Number.isFinite(price) && Number.isFinite(priceMax) && priceMax < price) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'price-range-inverted',
        detail: `${place.price}-${place.priceMax}`,
      })
    }
    const cuisine = String(place.facts.osmCuisine || '')
    const classified = classifyFromCuisine(cuisine)
    const photoId = placePixabayPhotoId[place.id]
    const photo = pixabayPhotosById[photoId]

    if (photoId != null && !photo) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'missing-photo-asset',
        detail: `placePixabayPhotoId=${photoId}`,
      })
    } else if (photo?.cardUrl) {
      const localPath = new URL(`../public${photo.cardUrl}`, import.meta.url)
      if (!existsSync(localPath)) {
        confirmed.push({
          id: place.id,
          name: place.name,
          kind: 'missing-photo-file',
          detail: photo.cardUrl,
        })
      }
    }

    // Potvrzená chyba: steak + kategorie kava
    if (isSteakishPlace(place) && place.category === 'kava') {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'steak-as-cafe',
        detail: `cuisine=${cuisine || '—'}; foto theme=${photo?.theme || '—'}`,
      })
    }

    // Potvrzená: steak s kávovou fotkou (i po opravě kategorie)
    if (isSteakishPlace(place) && isCoffeePhoto(photo)) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'steak-coffee-photo',
        detail: `pixabay ${photoId} ${photo?.pageUrl || ''}`,
      })
    }

    // Podezření: kategorie vs téma fotky
    if (photo && place.category === 'pizza' && photo.theme === 'kava') {
      suspected.push({
        id: place.id,
        name: place.name,
        kind: 'pizza-coffee-theme',
        detail: `foto ${photoId}`,
      })
    }
    if (photo && place.category === 'burger' && photo.theme === 'kava') {
      suspected.push({
        id: place.id,
        name: place.name,
        kind: 'burger-coffee-theme',
        detail: `foto ${photoId}`,
      })
    }
    if (photo && place.category === 'kava' && ['burger', 'pizza', 'kebab'].includes(photo.theme)) {
      suspected.push({
        id: place.id,
        name: place.name,
        kind: 'cafe-savory-theme',
        detail: `theme=${photo.theme}`,
      })
    }

    // Popis říká kavárna, kategorie je pizza/burger/steak
    const desc = String(place.description || '')
    if (
      /\(kavárna\)/i.test(desc) &&
      (place.category === 'pizza' || place.category === 'burger' || isSteakishPlace(place))
    ) {
      confirmed.push({
        id: place.id,
        name: place.name,
        kind: 'desc-cafe-mismatch',
        detail: desc.slice(0, 120),
      })
    }

    // Override vs OSM klasifikace — jen info
    if (
      place.override &&
      classified &&
      place.override.category !== classified.category &&
      place.override.confidence === 'high'
    ) {
      // záměrné overrides jsou OK
    }

    // Steak už opravené (neuvedeno + steak foto)
    if (
      isSteakishPlace(place) &&
      place.category === 'neuvedeno' &&
      photo &&
      STEAK_PHOTO_HINT.test(String(photo.pageUrl || '').toLowerCase())
    ) {
      fixedAlready.push(place.id)
    }
  }

  if (places.length !== EXPECTED_PLACE_COUNT) {
    confirmed.push({
      id: 'catalog-count',
      kind: 'place-count-drift',
      detail: `Očekáváno ${EXPECTED_PLACE_COUNT}, je ${places.length}`,
    })
  }

  // Duplicitní název + adresa (mimo známé curated/OSM páry)
  const knownDupIds = new Set(KNOWN_DUPLICATE_PAIRS.flat())
  const byNameAddress = new Map()
  for (const place of places) {
    const key = `${foldSearchText(place.name)}|${foldSearchText(place.address)}`
    if (!key || key === '|') continue
    if (!byNameAddress.has(key)) byNameAddress.set(key, [])
    byNameAddress.get(key).push(place)
  }
  for (const group of byNameAddress.values()) {
    if (group.length < 2) continue
    const idsGroup = group.map((row) => row.id)
    const onlyKnownPair =
      idsGroup.length === 2 && idsGroup.every((id) => knownDupIds.has(id))
    if (onlyKnownPair) continue
    suspected.push({
      id: idsGroup.join(' + '),
      name: group[0].name,
      kind: 'duplicate-name-address',
      detail: idsGroup.join(', '),
    })
  }

  const byCategory = {}
  for (const place of places) {
    byCategory[place.category] = (byCategory[place.category] || 0) + 1
  }

  const manualReview = [
    {
      id: 'cha-do-zelny-trh-10',
      reason: 'OSM tea;chinese;japanese;asian;korean — teď kava; ověřit zda čajovna nebo asijská restaurace',
    },
    {
      id: 'fenix-lounge-restaurace-masarykova-32',
      reason: 'OSM teahouse;pizza;middle_eastern — kategorie pizza; ověřit zaměření lounge',
    },
    {
      id: 'coffee4all-chironova-8',
      reason: 'Override kava, OSM má i pizza — záměrná kavárna, držet',
    },
    {
      id: 'bar-caffe-elephant-lidicka-43',
      reason: 'Amenity cafe + cuisine local;regional → ceske; popis stále „kavárna“',
    },
    {
      id: 'park-lane-luzanecka-4a',
      reason: 'Amenity cafe + regional → ceske; ověřit zda kavárna nebo restaurace',
    },
    {
      id: 'kimono-bayerova-572-2',
      reason: 'Amenity cafe + japanese → asijske; ověřit koncept',
    },
    {
      id: 'plzensky-dvur-sumavska-29a',
      reason: 'Po opravě neuvedeno (steak+regional); případně ručně ceske podle webu',
    },
  ]

  const report = {
    generatedAt: new Date().toISOString(),
    placeCount: places.length,
    expectedPlaceCount: EXPECTED_PLACE_COUNT,
    overrideCount: Object.keys(categoryOverrides).length,
    byCategory,
    ruleBugs,
    confirmed,
    suspected,
    steakPlacesWithSafeCategory: fixedAlready,
    manualReview,
    summary: {
      confirmedErrors: confirmed.length + ruleBugs.filter((r) => r.severity === 'confirmed').length,
      suspectedCount: suspected.length + manualReview.length,
      steakCoffeeFixedProbe: fixedAlready.length,
    },
  }

  const md = buildMarkdown(report)
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))
  writeFileSync(REPORT_MD, md)
  console.log(md)

  const failed =
    confirmed.length > 0 || ruleBugs.some((r) => r.severity === 'confirmed')
  process.exitCode = failed ? 1 : 0
  return report
}

function buildMarkdown(report) {
  const lines = []
  lines.push('# FoodGo – audit katalogu (kategorie, popisy, fotografie)')
  lines.push('')
  lines.push(`Vygenerováno: ${report.generatedAt}`)
  lines.push('')
  lines.push('## Souhrn')
  lines.push('')
  lines.push(`1. **Zkontrolováno podniků:** ${report.placeCount} (očekáváno ${report.expectedPlaceCount})`)
  lines.push(`2. **Podezřelé záznamy:** ${report.summary.suspectedCount} (suspected + ruční kontrola)`)
  lines.push(`3. **Potvrzené chyby teď v datech:** ${report.confirmed.length}`)
  lines.push(`4. **Chyby klasifikačních pravidel:** ${report.ruleBugs.filter((r) => r.severity === 'confirmed').length}`)
  lines.push(`5. **Steakhousy s bezpečnou kategorií + steak fotkou:** ${report.steakPlacesWithSafeCategory.length}`)
  lines.push(`6. **Overrides:** ${report.overrideCount}`)
  lines.push('')
  lines.push('## Kategorie (počty)')
  lines.push('')
  lines.push('| Kategorie | Počet |')
  lines.push('| --- | ---: |')
  for (const [cat, n] of Object.entries(report.byCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${n} |`)
  }
  lines.push('')
  lines.push('## Zjištěné chyby klasifikačních pravidel')
  lines.push('')
  if (report.ruleBugs.length === 0) {
    lines.push('- Žádné.')
  } else {
    for (const bug of report.ruleBugs) {
      lines.push(`- **${bug.severity}** \`${bug.id}\`: ${bug.detail}`)
    }
  }
  lines.push('')
  lines.push('## Potvrzené chyby v datech')
  lines.push('')
  if (report.confirmed.length === 0) {
    lines.push('Žádné potvrzené chyby — audit prošel.')
  } else {
    for (const row of report.confirmed) {
      lines.push(`- \`${row.id}\` ${row.name || ''} — **${row.kind}**: ${row.detail}`)
    }
  }
  lines.push('')
  lines.push('## Opravené steakhousy (probe)')
  lines.push('')
  for (const id of report.steakPlacesWithSafeCategory) {
    lines.push(`- \`${id}\``)
  }
  lines.push('')
  lines.push('## Seznam oprav v této vlně (katalog 2026-11-04)')
  lines.push('')
  lines.push('Potvrzené chyby způsobené regexem `/tea/` ⊆ `steak_house` + kávové Pixabay ilustrace:')
  lines.push('')
  lines.push('| ID | Změna |')
  lines.push('| --- | --- |')
  lines.push('| `prime-steak-palackeho-trida-162` | kava→neuvedeno/Restaurace; popis; foto 1869598→617430 |')
  lines.push('| `buffalo-american-steakhouse-krizkovskeho-416-22` | kava→neuvedeno; popis; foto 1983334→2430575 |')
  lines.push('| `butcher-s-dobrovskeho-96-29` | kava→neuvedeno; popis; foto 2178268→3640560 |')
  lines.push('| `monte-bu-udolni-76` | kava→neuvedeno; popis; foto 7963438→2484999 |')
  lines.push('| `plzensky-dvur-sumavska-29a` | kava→neuvedeno; foto 1572741→3676796 |')
  lines.push('| `steak-house-k1-bubenickova-11` | kava→neuvedeno; popis; foto 2590789→3676808 |')
  lines.push('| `amici-pizza-burgers-palackeho-trida-82` | popis (kavárna)→(pizzerie) |')
  lines.push('| `tri-kocketyri-nadrazni-22` | popis (kavárna)→(burger restaurace) |')
  lines.push('')
  lines.push('**Pravidla:** sdílený `src/utils/cuisineClassify.js` (tokenová klasifikace); generátor OSM bere popisek podle kategorie, ne jen amenity.')
  lines.push('')
  lines.push(`**Počet skutečně opravených chyb v této vlně:** 8 podniků (+ 1 sdílený klasifikátor).`)
  lines.push('')
  lines.push('## Podezření (automatická)')
  lines.push('')
  if (report.suspected.length === 0) {
    lines.push('- Žádná silná automatická podezření.')
  } else {
    for (const row of report.suspected) {
      lines.push(`- \`${row.id}\` ${row.name} — ${row.kind}: ${row.detail}`)
    }
  }
  lines.push('')
  lines.push('## Ruční kontrola')
  lines.push('')
  for (const row of report.manualReview) {
    lines.push(`- \`${row.id}\` — ${row.reason}`)
  }
  lines.push('')
  lines.push('## Poznámky')
  lines.push('')
  lines.push('- Potvrzené vs podezření: potvrzené = jednoznačný rozpor (např. `steak_house` + kategorie `kava`).')
  lines.push('- Fotografie: hodnotíme URL/téma Pixabay, ne pixelový obsah — nejisté případy patří do ruční kontroly.')
  lines.push('- Spuštění: `npm run audit:catalog`')
  lines.push('')
  return lines.join('\n')
}

runAudit()
