/**
 * Dohledání Google hodnocení přes Places API (New).
 *
 * Bez klíče v .env a bez výslovného potvrzení NIC nevolá.
 *
 * Test (max. 10 podniků):
 *   npm run data:google-ratings -- --confirm-test --limit 10
 *
 * Hromadný běh všech 775 (nespouštět bez dalšího potvrzení):
 *   npm run data:google-ratings -- --confirm-paid --all
 *
 * Text Search s poli rating + userRatingCount = SKU Enterprise
 * (~35 USD / 1000 po 1000 voláních zdarma / měsíc).
 *
 * Klíč jen z lokálního .env (gitignore). Nikdy do logů, reportů ani Gitu.
 * Nepřepisuje verifiedPrices / estimatedPrices / OSM / ID.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { curatedPlaces } from '../src/data/curatedPlaces.js'
import { osmPlaces } from '../src/data/osmPlaces.js'
import { googleRatings as existingRatings } from '../src/data/googleRatings.js'
import { buildMapsSearchUrl } from '../src/utils/googleRating.js'

const EXPECTED_TOTAL = 775
const TEST_LIMIT_MAX = 10
const TODAY = new Date().toISOString().slice(0, 10)
/** Stejná množina pro opakovatelný test: dvě pobočky Rebio + řetězec v mallu. */
const TEST_PLACE_IDS = [
  'dhaba-beas-panska',
  'forkys-vankovka',
  'rebio-velky-spalicek',
  'rebio-orli',
  'bistro-franz',
  'lokal-u-caipla',
  'stopkova-plzenska-pivnice',
  'mamas-burger',
  'bageterie-boulevard-vankovka',
  'chicken-inn-svobody',
]
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
].join(',')

function loadDotEnv() {
  const envPath = new URL('../.env', import.meta.url)
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    const key = trimmed.slice(0, i).trim()
    let value = trimmed.slice(i + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null || process.env[key] === '') process.env[key] = value
  }
}

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  if (i < 0) return null
  return process.argv[i + 1] ?? null
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function houseNumber(address) {
  const m = String(address || '').match(/(\d+[a-zA-Z]?)/)
  return m ? fold(m[1]) : ''
}

function streetKey(address) {
  const before = String(address || '').split(',')[0] || ''
  return fold(before.replace(/\d+[a-zA-Z]?.*/, ''))
}

function nameTokens(name) {
  const stop = new Set([
    'restaurace',
    'restaurant',
    'cafe',
    'kavarna',
    'bistro',
    'bar',
    'pub',
    'pizzerie',
    'brno',
    'the',
    'a',
  ])
  return fold(name)
    .split(' ')
    .filter((t) => t.length > 1 && !stop.has(t))
}

function nameScore(ours, theirs) {
  const a = fold(ours)
  const b = fold(theirs)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.9
  const ta = new Set(nameTokens(ours))
  const tb = new Set(nameTokens(theirs))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter += 1
  return inter / Math.max(ta.size, tb.size)
}

function addressScore(ours, theirs) {
  const h1 = houseNumber(ours)
  const h2 = houseNumber(theirs)
  const s1 = streetKey(ours)
  const s2 = streetKey(theirs)
  let score = 0
  if (h1 && h2 && h1 === h2) score += 0.6
  if (s1 && s2 && (s1.includes(s2) || s2.includes(s1))) score += 0.4
  if (fold(theirs).includes('brno')) score += 0.05
  return Math.min(1, score)
}

function classifyMatch(place, candidates) {
  const scored = candidates
    .map((c) => {
      const n = nameScore(place.name, c.displayName?.text)
      const a = addressScore(place.address, c.formattedAddress)
      return { candidate: c, name: n, address: a, total: n * 0.6 + a * 0.4 }
    })
    .filter((row) => row.name >= 0.45 && row.address >= 0.35)
    .sort((x, y) => y.total - x.total)

  if (!scored.length) return { status: 'not_found' }
  if (scored.length === 1 || scored[0].total >= (scored[1]?.total ?? 0) + 0.18) {
    return { status: 'matched', candidate: scored[0].candidate }
  }
  return {
    status: 'needs_review',
    note: scored
      .slice(0, 3)
      .map((r) => r.candidate.displayName?.text)
      .filter(Boolean)
      .join(' | '),
  }
}

function overlayFromResult(result) {
  const checkedAt = TODAY
  if (result.status === 'not_found') {
    return { googleRatingStatus: 'not_found', googleRatingCheckedAt: checkedAt }
  }
  if (result.status === 'needs_review') {
    return {
      googleRatingStatus: 'needs_review',
      googleRatingCheckedAt: checkedAt,
      googleMatchNote: result.note || 'Nejednoznačná pobočka',
    }
  }
  const c = result.candidate
  const rating = typeof c.rating === 'number' ? c.rating : null
  const count = typeof c.userRatingCount === 'number' ? c.userRatingCount : null
  const placeId = typeof c.id === 'string' ? c.id.replace(/^places\//, '') : undefined
  const mapsUrl = c.googleMapsUri || undefined
  const matchedName = c.displayName?.text
  const matchedAddress = c.formattedAddress
  if (rating == null) {
    return {
      googleRatingStatus: 'not_found',
      googleRatingCheckedAt: checkedAt,
      googlePlaceId: placeId,
      googleMapsUrl: mapsUrl,
      googleMatchedName: matchedName,
      googleMatchedAddress: matchedAddress,
    }
  }
  const entry = {
    googleRatingStatus: 'verified',
    googleRating: rating,
    googleRatingCheckedAt: checkedAt,
    googlePlaceId: placeId,
    googleMapsUrl: mapsUrl,
    googleMatchedName: matchedName,
    googleMatchedAddress: matchedAddress,
  }
  if (count != null) entry.googleReviewCount = count
  return entry
}

function redactSecrets(text, apiKey) {
  let out = String(text ?? '')
  if (apiKey) out = out.split(apiKey).join('[redacted]')
  return out.replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
}

function collectPlaces() {
  const seen = new Set()
  const places = []
  for (const r of [...curatedPlaces, ...osmPlaces]) {
    if (seen.has(r.id)) continue
    seen.add(r.id)
    places.push(r)
  }
  return places
}

function writeOverlay(overlay) {
  const header = `/** Google hodnocení z Places API. Test: npm run data:google-ratings -- --confirm-test --limit 10 */
/** Nepřepisuje ceny. Neověřené záznamy nesmí obsahovat hvězdy ani počet recenzí. */
export const googleRatings = `
  writeFileSync(
    new URL('../src/data/googleRatings.js', import.meta.url),
    `${header}${JSON.stringify(overlay, null, 2)}\n`,
    'utf8',
  )
}

function summarize(overlay, extra) {
  const values = Object.values(overlay)
  return {
    totalPlaces: extra.totalPlaces,
    verified: values.filter((v) => v.googleRatingStatus === 'verified').length,
    notFound: values.filter((v) => v.googleRatingStatus === 'not_found').length,
    needsReview: values.filter((v) => v.googleRatingStatus === 'needs_review').length,
    skippedNoLookup: extra.skippedNoLookup,
    fetchedThisRun: extra.fetchedThisRun,
    ...extra.meta,
  }
}

loadDotEnv()

const confirmTest = process.argv.includes('--confirm-test')
const confirmPaid = process.argv.includes('--confirm-paid')
const confirmAll = process.argv.includes('--all')
const apiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim()
const limitRaw = argValue('--limit')
const force = process.argv.includes('--force')

const places = collectPlaces()
const overlay = { ...existingRatings }
const progressPath = new URL('../reports/google-ratings-progress.json', import.meta.url)
const reportPath = new URL('../reports/google-ratings-report.json', import.meta.url)
let progress = { doneIds: [] }
if (existsSync(progressPath)) {
  try {
    progress = JSON.parse(readFileSync(progressPath, 'utf8'))
  } catch {
    progress = { doneIds: [] }
  }
}
const done = new Set(progress.doneIds || [])

if (places.length !== EXPECTED_TOTAL) {
  console.error(`Očekáváno ${EXPECTED_TOTAL} podniků, je ${places.length}`)
  process.exit(1)
}

function writeSkipReport(reason, extra = {}) {
  const report = {
    ...summarize(overlay, {
      totalPlaces: places.length,
      skippedNoLookup: places.length,
      fetchedThisRun: 0,
      meta: {
        ranApi: false,
        requestCount: 0,
        errors: [],
        actualCostUsd: null,
        costNote:
          'Skutečné náklady z tohoto běhu nelze určit. Places API je účtuje v Google Cloud Billing, ne v odpovědi Text Search.',
        ...extra,
      },
    }),
    reason,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(report)
  console.log('fetch-google-ratings: žádné API volání.')
}

if (confirmTest && (confirmPaid || confirmAll)) {
  writeSkipReport('test a hromadný běh nelze kombinovat')
  process.exit(1)
}

if (confirmPaid && !confirmAll) {
  writeSkipReport(
    'hromadné zpracování vyžaduje --confirm-paid --all; bez toho se 775 podniků nespouští',
  )
  process.exit(1)
}

const testMode = confirmTest
const wantsApi = testMode || (confirmPaid && confirmAll)

if (!wantsApi || !apiKey) {
  const reason = !apiKey
    ? 'chybí GOOGLE_PLACES_API_KEY v .env'
    : 'chybí potvrzení (--confirm-test --limit 10, nebo později --confirm-paid --all)'
  writeSkipReport(reason, { keyPresent: Boolean(apiKey) })
  process.exit(0)
}

const parsedLimit = limitRaw ? Number(limitRaw) : testMode ? TEST_LIMIT_MAX : places.length
if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
  writeSkipReport('neplatný --limit')
  process.exit(1)
}
if (testMode && parsedLimit > TEST_LIMIT_MAX) {
  writeSkipReport(`test povoluje nejvýše ${TEST_LIMIT_MAX} požadavků`)
  process.exit(1)
}

const limit = testMode ? Math.min(parsedLimit, TEST_LIMIT_MAX) : parsedLimit
const queue = testMode
  ? TEST_PLACE_IDS.map((id) => places.find((p) => p.id === id)).filter(Boolean)
  : places

if (testMode && queue.length !== TEST_PLACE_IDS.length) {
  console.error('Testovací ID chybí v databázi.')
  process.exit(1)
}

async function searchText(place) {
  const textQuery = [place.name, place.address, 'Brno'].filter(Boolean).join(', ')
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'cs',
      regionCode: 'CZ',
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: { latitude: 49.1951, longitude: 16.6068 },
          radius: 18000,
        },
      },
    }),
  })
  const body = await res.json()
  if (!res.ok) {
    const msg = redactSecrets(body?.error?.message || res.statusText, apiKey)
    throw new Error(`Places ${res.status}: ${msg}`)
  }
  return body.places || []
}

function matchRow(place, entry) {
  const row = {
    id: place.id,
    name: place.name,
    address: place.address,
    status: entry.googleRatingStatus,
    matchedName: entry.googleMatchedName || null,
    matchedAddress: entry.googleMatchedAddress || null,
  }
  if (entry.googleRatingStatus === 'verified') {
    row.googleRating = entry.googleRating
    row.googleReviewCount = entry.googleReviewCount ?? null
  }
  if (entry.googleMatchNote) row.note = entry.googleMatchNote
  return row
}

const processed = []
const errors = []
let fetchedThisRun = 0
try {
  for (const place of queue) {
    if (fetchedThisRun >= limit) break
    if (
      !testMode &&
      !force &&
      overlay[place.id] &&
      done.has(place.id)
    ) {
      continue
    }

    const candidates = await searchText(place)
    const classified = classifyMatch(place, candidates)
    const entry = {
      ...overlayFromResult(classified),
      googleMapsSearchUrl: buildMapsSearchUrl(place.name, place.address),
    }
    overlay[place.id] = entry
    done.add(place.id)
    fetchedThisRun += 1
    processed.push(matchRow(place, entry))
    console.log(`progress ${fetchedThisRun}/${Math.min(limit, queue.length)} ${place.id} ${entry.googleRatingStatus}`)

    writeFileSync(
      progressPath,
      JSON.stringify(
        { mode: testMode ? 'test' : 'bulk', doneIds: [...done], updatedAt: new Date().toISOString() },
        null,
        2,
      ),
      'utf8',
    )
    writeOverlay(overlay)

    await new Promise((resolve) => setTimeout(resolve, 120))
  }
} catch (err) {
  const safe = redactSecrets(err.message || err, apiKey)
  errors.push(safe)
  writeFileSync(
    progressPath,
    JSON.stringify(
      {
        mode: testMode ? 'test' : 'bulk',
        doneIds: [...done],
        updatedAt: new Date().toISOString(),
        error: safe,
      },
      null,
      2,
    ),
    'utf8',
  )
  writeOverlay(overlay)
  console.error('Přerušeno, progress uložen:', safe)
}

const runIds = new Set(processed.map((row) => row.id))
const runEntries = Object.entries(overlay).filter(([id]) => runIds.has(id))

const report = {
  mode: testMode ? 'test' : 'bulk',
  totalPlaces: places.length,
  maxRequests: limit,
  requestCount: fetchedThisRun,
  verified: runEntries.filter(([, v]) => v.googleRatingStatus === 'verified').length,
  notFound: runEntries.filter(([, v]) => v.googleRatingStatus === 'not_found').length,
  needsReview: runEntries.filter(([, v]) => v.googleRatingStatus === 'needs_review').length,
  overlaySize: Object.keys(overlay).length,
  errors,
  matches: processed,
  actualCostUsd: null,
  costNote:
    'Skutečné náklady z tohoto běhu nelze určit. Google je účtuje ve Cloud Billing; odhad viz sazba Enterprise Text Search.',
  estimatedCostUsdMax: Number(((fetchedThisRun * 35) / 1000).toFixed(4)),
}
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
console.log({
  ...report,
  matches: processed.map((row) => ({
    id: row.id,
    status: row.status,
    matchedName: row.matchedName,
  })),
})
if (errors.length) process.exit(1)
