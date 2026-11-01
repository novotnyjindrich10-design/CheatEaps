/**
 * Zapíše ověřené categoryOverrides do osmPlaces.js (hlavní data)
 * a vytvoří reports/restaurant-category-audit.md|.json
 *
 * node scripts/apply-category-overrides.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { categoryOverrides, illustrationRemovals } from '../src/data/categoryOverrides.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmFacts } from '../src/data/osmFacts.js'
import { ALLOWED_PLACE_CATEGORIES } from '../src/constants/filters.js'

const OSM_PATH = new URL('../src/data/osmPlaces.js', import.meta.url)
const AUDIT_MD = new URL('../reports/restaurant-category-audit.md', import.meta.url)
const AUDIT_JSON = new URL('../reports/restaurant-category-audit.json', import.meta.url)

const TYPE_BY_CATEGORY = {
  pizza: 'Pizza',
  burger: 'Burger',
  asijske: 'Asijské',
  ceske: 'České',
  vegetarianske: 'Bez masa',
  veganske: 'Vegan',
  kebab: 'Kebab',
  cina: 'Čína',
  mexiko: 'Mexiko',
  kava: 'Kavárna',
  fastfood: 'Fast food',
  sladke: 'Sladké',
  zdrave: 'Zdravé',
  neuvedeno: 'Restaurace',
}

function classifyFromOsmCuisine(cuisine) {
  const c = String(cuisine || '').toLowerCase()
  if (!c.trim()) return null
  if (/pizza/.test(c)) return 'pizza'
  if (/burger/.test(c)) return 'burger'
  if (/kebab|doner|döner|gyros/.test(c)) return 'kebab'
  if (/chinese|szechuan|sichuan/.test(c)) return 'cina'
  if (/vietnamese|thai|japanese|sushi|asian|indian|korean|nepalese|noodle|ramen/.test(c)) {
    return 'asijske'
  }
  if (/mexican|taco|burrito/.test(c)) return 'mexiko'
  if (/ice_cream|dessert|pastry|cake|pancake|waffle|crepe/.test(c)) return 'sladke'
  if (/healthy|salad/.test(c)) return 'zdrave'
  if (/coffee|cafe|tea|teahouse|bubble_tea/.test(c)) return 'kava'
  if (/czech|regional|local/.test(c)) return 'ceske'
  if (/sandwich|chicken|fried/.test(c)) return 'fastfood'
  return null
}

function beforeCounts(places) {
  const counts = {}
  for (const p of places) {
    const c = p.category || 'neuvedeno'
    counts[c] = (counts[c] || 0) + 1
  }
  return counts
}

const ORIGINAL_NEUVEDENO = 209 // stav před první opravou kategorií v této vlně
const before = beforeCounts([...curatedPlaces, ...osmPlaces])
const beforeNeuvedeno = before.neuvedeno || 0

const changes = []
const unresolved = []
const nextOsm = osmPlaces.map((place) => {
  const override = categoryOverrides[place.id]
  if (override) {
    if (!ALLOWED_PLACE_CATEGORIES.includes(override.category)) {
      throw new Error(`Neplatná kategorie u ${place.id}: ${override.category}`)
    }
    if (place.category !== override.category || (override.type && place.type !== override.type)) {
      changes.push({
        id: place.id,
        name: place.name,
        from: place.category,
        to: override.category,
        confidence: override.confidence,
        evidence: override.evidence,
        sourceUrl: override.sourceUrl || '',
        method: 'manual_override',
      })
    }
    return {
      ...place,
      category: override.category,
      type: override.type || TYPE_BY_CATEGORY[override.category] || place.type,
    }
  }

  // Bezpečné OSM mapování jen pro neuvedeno
  if (place.category === 'neuvedeno') {
    const facts = osmFacts[place.id] || {}
    const fromCuisine = classifyFromOsmCuisine(facts.osmCuisine)
    if (fromCuisine && fromCuisine !== 'neuvedeno') {
      // italian / international / greek / … záměrně ne – nemáme kategorii
      changes.push({
        id: place.id,
        name: place.name,
        from: 'neuvedeno',
        to: fromCuisine,
        confidence: 'medium',
        evidence: `OSM cuisine: ${facts.osmCuisine}`,
        sourceUrl: '',
        method: 'osm_cuisine',
      })
      return {
        ...place,
        category: fromCuisine,
        type: TYPE_BY_CATEGORY[fromCuisine] || place.type,
      }
    }
    if (facts.osmAmenity === 'cafe') {
      changes.push({
        id: place.id,
        name: place.name,
        from: 'neuvedeno',
        to: 'kava',
        confidence: 'medium',
        evidence: 'OSM amenity=cafe',
        sourceUrl: '',
        method: 'osm_amenity',
      })
      return { ...place, category: 'kava', type: 'Kavárna' }
    }
    if (facts.osmAmenity === 'ice_cream') {
      changes.push({
        id: place.id,
        name: place.name,
        from: 'neuvedeno',
        to: 'sladke',
        confidence: 'medium',
        evidence: 'OSM amenity=ice_cream',
        sourceUrl: '',
        method: 'osm_amenity',
      })
      return { ...place, category: 'sladke', type: 'Sladké' }
    }
    unresolved.push({
      id: place.id,
      name: place.name,
      reason: facts.osmCuisine
        ? `OSM cuisine „${facts.osmCuisine}“ nelze spolehlivě mapovat na kategorii aplikace`
        : 'Chybí ověřené menu/web; kategorie zůstává Neuvedeno',
      website: place.website || '',
      osmCuisine: facts.osmCuisine || '',
    })
  }
  return place
})

// curated overrides (pokud by někdy přibyly)
for (const place of curatedPlaces) {
  const override = categoryOverrides[place.id]
  if (override && place.category !== override.category) {
    changes.push({
      id: place.id,
      name: place.name,
      from: place.category,
      to: override.category,
      confidence: override.confidence,
      evidence: override.evidence + ' (curatedPlaces – nutné upravit ručně)',
      sourceUrl: override.sourceUrl || '',
      method: 'curated_needs_manual',
    })
  }
}

const header = `/** Auto-generated from OpenStreetMap Overpass. Regeneruj: node scripts/generate-osm-places.mjs */
/** Kategorie opravené ověřenými overrides: node scripts/apply-category-overrides.mjs */
export const osmPlaces = `

writeFileSync(OSM_PATH, `${header}${JSON.stringify(nextOsm, null, 2)}\n`, 'utf8')

const after = beforeCounts([...curatedPlaces, ...nextOsm])
const afterNeuvedeno = after.neuvedeno || 0
const generatedAt = new Date().toISOString()

const report = {
  generatedAt,
  originalNeuvedeno: ORIGINAL_NEUVEDENO,
  beforeNeuvedeno,
  afterNeuvedeno,
  fixedFromOriginal: ORIGINAL_NEUVEDENO - afterNeuvedeno,
  fixedCount: changes.filter((c) => c.from === 'neuvedeno' || c.from !== c.to).length,
  changes,
  unresolved,
  illustrationRemovals,
  categoryCountsBefore: before,
  categoryCountsAfter: after,
  notes: [
    'Override se zapisuje do osmPlaces.js, aby ho používala aplikace i po načtení dat.',
    'demoRestaurants.js zároveň bere categoryOverrides (včetně removeIllustration).',
    'italian / international / greek / georgian bez jednoznačné app kategorie zůstávají neuvedeno.',
    'Školní jídelna Brno: kategorie ceske, ilustrace odstraněna.',
  ],
}

writeFileSync(AUDIT_JSON, JSON.stringify(report, null, 2), 'utf8')
writeFileSync(
  AUDIT_MD,
  [
    '# Audit kategorií podniků',
    '',
    `Vygenerováno: ${generatedAt}`,
    '',
    '## Souhrn',
    '',
    '| Metrika | Počet |',
    '| --- | ---: |',
    `| Neuvedeno na začátku vlny | ${ORIGINAL_NEUVEDENO} |`,
    `| Neuvedeno před tímto během | ${beforeNeuvedeno} |`,
    `| Neuvedeno po opravě | ${afterNeuvedeno} |`,
    `| Opraveno od začátku vlny | ${ORIGINAL_NEUVEDENO - afterNeuvedeno} |`,
    `| Změn v tomto běhu | ${changes.length} |`,
    `| Nevyřešených (stále neuvedeno) | ${unresolved.length} |`,
    `| Bez ilustrace (školní jídelna) | ${illustrationRemovals.length} |`,
    '',
    '## Počty kategorií po opravě',
    '',
    '| Kategorie | Před | Po |',
    '| --- | ---: | ---: |',
    ...ALLOWED_PLACE_CATEGORIES.map(
      (key) => `| ${key} | ${before[key] || 0} | ${after[key] || 0} |`,
    ),
    '',
    '## Opravené podniky',
    '',
    ...changes
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
      .map(
        (c) =>
          `- **${c.name}** (\`${c.id}\`): \`${c.from}\` → \`${c.to}\` (${c.confidence}, ${c.method}) — ${c.evidence}${c.sourceUrl ? ` ([zdroj](${c.sourceUrl}))` : ''}`,
      ),
    '',
    '## Nevyřešené (zůstává Neuvedeno)',
    '',
    'Kategorii nelze spolehlivě ověřit z dostupných volných zdrojů, nebo typ kuchyně nemá odpovídající filtr v aplikaci (např. čistě italské těstoviny bez pizzy).',
    '',
    ...unresolved
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
      .slice(0, 200)
      .map(
        (u) =>
          `- **${u.name}** (\`${u.id}\`): ${u.reason}${u.osmCuisine ? ` · OSM: ${u.osmCuisine}` : ''}${u.website ? ` · ${u.website}` : ''}`,
      ),
    unresolved.length > 200 ? `\n… a dalších ${unresolved.length - 200}.` : '',
    '',
    '## Poznámky',
    '',
    ...report.notes.map((n) => `- ${n}`),
    '',
  ].join('\n'),
  'utf8',
)

console.log({
  written: fileURLToPath(OSM_PATH),
  beforeNeuvedeno,
  afterNeuvedeno,
  changes: changes.length,
  unresolved: unresolved.length,
  audit: fileURLToPath(AUDIT_MD),
})
