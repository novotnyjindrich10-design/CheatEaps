/**
 * Schválené podniky z API se sloučí do katalogu za běhu.
 * Statický OSM/kurátorovaný seznam se nemění.
 */

let extras = []
const listeners = new Set()

export function getPublishedExtras() {
  return extras
}

export function setPublishedExtras(list) {
  extras = Array.isArray(list) ? list : []
  for (const listener of listeners) listener()
}

export function subscribePublished(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publishedIds() {
  return new Set(extras.map((place) => place.id))
}
