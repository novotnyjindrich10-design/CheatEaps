import { formatRatingNumber, formatReviewCount } from './googleRating.js'

const RESTAURANT_ID = /^[a-z0-9][a-z0-9-]{0,79}$/

function withoutControls(value) {
  let text = ''
  for (const char of value) {
    const code = char.codePointAt(0)
    if (code === 9 || code === 10 || code === 13) {
      text += char
      continue
    }
    if (code < 32 || code === 127) continue
    text += char
  }
  return text
}

export function cleanText(value) {
  return withoutControls(String(value ?? ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function publicName(value) {
  const text = cleanText(value).replace(/\s+/g, ' ')
  if (text.length < 2 || text.length > 32) return ''
  if (text.includes('@') || text.includes('://')) return ''
  return text
}

export function authorLabel(displayName, userId) {
  const name = publicName(displayName)
  if (name) return name
  const code = String(userId ?? '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toLowerCase()
  return code ? `Host ${code}` : 'Host'
}

export function reviewBody(value) {
  const text = cleanText(value)
  if (!text) return { ok: false, error: 'empty-review', message: 'Recenze potřebuje text.' }
  if (text.length > 1000) {
    return { ok: false, error: 'review-too-long', message: 'Recenze může mít nejvýš 1000 znaků.' }
  }
  return { ok: true, text }
}

export function reviewRating(value) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'rating-invalid', message: 'Vyber hodnocení od 1 do 5 hvězdiček.' }
  }
  return { ok: true, rating }
}

export function reportReason(value) {
  const text = cleanText(value).replace(/\s+/g, ' ')
  if (!text) return { ok: false, error: 'empty-report', message: 'Napiš, co je na recenzi nevhodné.' }
  if (text.length > 280) {
    return { ok: false, error: 'report-too-long', message: 'Nahlášení může mít nejvýš 280 znaků.' }
  }
  return { ok: true, text }
}

export function parseRestaurantId(value) {
  const id = String(value ?? '')
  if (!RESTAURANT_ID.test(id)) {
    return { ok: false, error: 'restaurant-unknown', message: 'Tahle restaurace v CheapEats není.' }
  }
  return { ok: true, id }
}

export function cheapEatsSummary(reviews) {
  const ratings = []
  for (const review of reviews ?? []) {
    const rating = review?.rating
    if (Number.isInteger(rating) && rating >= 1 && rating <= 5) ratings.push(rating)
  }
  if (ratings.length === 0) {
    return { count: 0, average: null, label: 'Zatím bez hodnocení' }
  }
  const average = Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
  return {
    count: ratings.length,
    average,
    label: `${formatRatingNumber(average)} z 5 · ${formatReviewCount(ratings.length)}`,
  }
}

export function sortReviews(reviews) {
  return [...reviews].sort((left, right) => {
    const byDate = String(right.createdAt).localeCompare(String(left.createdAt))
    if (byDate !== 0) return byDate
    return String(left.id).localeCompare(String(right.id))
  })
}

export function formatReviewDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
