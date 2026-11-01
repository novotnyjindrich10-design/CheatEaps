const BLOCKED_HOST_PARTS = [
  'facebook.com',
  'fb.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'youtube.com',
  'youtu.be',
  'wolt.com',
  'foodora.com',
  'foodora.cz',
  'takeaway.com',
  'damejidlo.cz',
  'tripadvisor.com',
  'tripadvisor.cz',
  'google.com',
  'goo.gl',
  'maps.app.goo.gl',
  'linktr.ee',
  'linktree',
  'yelp.com',
  'foursquare.com',
  'firmy.cz',
  'zlatestranky.cz',
  'mapy.cz',
  'booking.com',
]

export function isOfficialWebsite(raw) {
  if (!raw || typeof raw !== 'string') return false
  let url
  try {
    url = new URL(raw.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()
  return !BLOCKED_HOST_PARTS.some((part) => host === part || host.endsWith(`.${part}`))
}

/** Jen http(s) adresa. Jinak prázdný řetězec, aby odkaz nešel na relativní nebo skriptovou adresu. */
export function httpUrl(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let url
  try {
    url = new URL(raw.trim())
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  if (url.username || url.password) return ''
  return url.toString()
}

export function officialWebsiteOf(restaurant) {
  if (isOfficialWebsite(restaurant?.officialWebsite)) return restaurant.officialWebsite
  if (isOfficialWebsite(restaurant?.website)) return restaurant.website
  return ''
}
