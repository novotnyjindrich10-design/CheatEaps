/** Cache ID zveřejněných podniků pro community (oblíbené/recenze). */

const ids = new Set()

export function rememberPublishedId(id) {
  if (id) ids.add(String(id))
}

export function isPublishedPlaceId(id) {
  return ids.has(String(id ?? ''))
}

export function resetPublishedPlaceIds() {
  ids.clear()
}
