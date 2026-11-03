/**
 * Výběr fotek z odpovědi Pixabay API.
 * URL bere jen z vrácených polí. Nic neskládá z ID.
 */

const PAGE_HOSTS = new Set(['pixabay.com', 'www.pixabay.com'])
const IMAGE_HOSTS = new Set(['pixabay.com', 'www.pixabay.com', 'cdn.pixabay.com'])

const PERSON_RE =
  /\b(person|people|human|man|woman|men|women|girl|boy|portrait|selfie|crowd|waiter|waitress|barista|chef|customer|couple|friends|guy|lady|model|face)\b/i

const TEXT_RE = /\b(logo|watermark|typography|lettering|screenshot|poster|banner|signage|text)\b/i

function hostOf(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return ''
    return parsed.hostname
  } catch {
    return ''
  }
}

export function isPixabayPageUrl(url) {
  return PAGE_HOSTS.has(hostOf(url))
}

export function isPixabayImageUrl(url) {
  return IMAGE_HOSTS.has(hostOf(url))
}

/** Velikost souboru `largeImageURL`: dokumentované maximum 1280 px na delší straně. */
export function fitInside(width, height, max = 1280) {
  const longest = Math.max(width, height)
  const scale = longest > max ? max / longest : 1
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function normalizePixabayPhoto(raw) {
  const id = raw?.id
  if (!Number.isInteger(id) || id <= 0) return null
  if (raw.type && raw.type !== 'photo') return null
  if (!isPixabayImageUrl(raw.largeImageURL) || !isPixabayPageUrl(raw.pageURL)) return null
  const user = String(raw.user || '').trim()
  const userId = raw.user_id
  if (!user || !Number.isInteger(userId) || userId <= 0) return null
  const width = Number(raw.imageWidth)
  const height = Number(raw.imageHeight)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null
  const display = fitInside(width, height, 1280)
  return {
    id,
    width,
    height,
    displayWidth: display.width,
    displayHeight: display.height,
    tags: String(raw.tags || '').trim(),
    user,
    userId,
    pageUrl: raw.pageURL,
    profileUrl: `https://pixabay.com/users/${encodeURIComponent(user)}-${userId}/`,
    downloadUrl: raw.largeImageURL,
    likes: Number(raw.likes) || 0,
  }
}

export function scorePixabayPhoto(photo, spec) {
  if (!photo?.tags) return -1
  const tags = photo.tags.toLowerCase()
  if (PERSON_RE.test(tags) || TEXT_RE.test(tags)) return -1
  if (photo.width < 1600 || photo.height < 1000) return -1
  const ratio = photo.width / photo.height
  if (ratio < 1.05 || ratio > 2.15) return -1

  const keywords = (spec?.keywords || []).map((item) => String(item).toLowerCase())
  const hits = keywords.filter((keyword) => keyword && tags.includes(keyword)).length
  if (spec?.key === 'neuvedeno') {
    if (!/\b(food|plate|dish|meal|dinner|lunch|cuisine|restaurant|gourmet)\b/.test(tags)) return -1
  } else if (hits === 0) {
    return -1
  }

  let score = (spec?.key === 'neuvedeno' ? 12 : hits * 24) + Math.min(photo.width, 5000) / 100
  score += Math.min(photo.likes, 400) / 80
  if (/\b(wooden|ceramic|close-up|close up)\b/.test(tags)) score += 6
  return score
}

export function selectPixabayPhotos(rawPhotos, spec, { limit = 8, perUser = 3 } = {}) {
  const ranked = []
  const seen = new Set()
  for (const raw of rawPhotos || []) {
    const photo = raw?.downloadUrl ? raw : normalizePixabayPhoto(raw)
    if (!photo || seen.has(photo.id)) continue
    const score = scorePixabayPhoto(photo, spec)
    if (score < 0) continue
    seen.add(photo.id)
    ranked.push({ photo, score })
  }
  ranked.sort((a, b) => b.score - a.score || a.photo.id - b.photo.id)

  const kept = []
  const byUser = new Map()
  for (const row of ranked) {
    const used = byUser.get(row.photo.userId) || 0
    if (used >= perUser) continue
    byUser.set(row.photo.userId, used + 1)
    kept.push(row.photo)
    if (kept.length >= limit) break
  }
  return kept
}

/** Sousedi v poli dostanou různé fotky, dokud na to fond stačí. */
export function assignPhotoIds(placeIdsByTheme, idsByTheme) {
  const assignment = {}
  for (const [theme, placeIds] of Object.entries(placeIdsByTheme || {})) {
    const pool = idsByTheme?.[theme] || []
    if (!pool.length) continue
    placeIds.forEach((placeId, index) => {
      assignment[placeId] = pool[index % pool.length]
    })
  }
  return assignment
}
