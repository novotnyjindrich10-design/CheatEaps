/** Spodní navigace: opětovný klik na aktivní záložku (bez reloadu). */
export const TAB_RESELECT_EVENT = 'foodgo:tab-reselect'

export function emitTabReselect(tab) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(TAB_RESELECT_EVENT, { detail: { tab } }))
}

export function scrollViewportToTop({ behavior = 'smooth' } = {}) {
  if (typeof window === 'undefined') return
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, left: 0, behavior: reduced ? 'auto' : behavior })
}
