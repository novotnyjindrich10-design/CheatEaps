/** Hotlink z webu podniku není sám o sobě licence k dalšímu užití. */

export function officialRights(record) {
  if (!record?.heroImageUrl || record.heroImageKind !== 'official') return 'none'
  if (record.heroImageRights === 'documented') return 'documented'
  return 'undocumented'
}

export function officialPhotoConcern(url) {
  const value = String(url || '').toLowerCase()
  if (/placeholder|logo|favicon|sprite|fb\.png|og_default|share-pic|facebookshare|facebook\.jpg/.test(value)) {
    return 'weak-or-placeholder'
  }
  if (/\.svg(\?|$)/.test(value)) return 'svg'
  return null
}
