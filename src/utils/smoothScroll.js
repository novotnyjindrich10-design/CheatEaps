/** @returns {boolean} */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2
}

/**
 * Plynulý scroll k prvku se započtením sticky hlavičky.
 * Uživatelský wheel / touch / klávesa scroll přeruší.
 * @returns {() => void} cancel
 */
export function smoothScrollTo(el, { offset = 96, duration = 600 } = {}) {
  if (!el || typeof window === 'undefined') return () => {}

  const targetY = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset)
  if (prefersReducedMotion() || duration <= 0) {
    window.scrollTo(0, targetY)
    return () => {}
  }

  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 2) return () => {}

  let cancelled = false
  let frame = 0
  const started = performance.now()

  const cancel = () => {
    cancelled = true
    if (frame) cancelAnimationFrame(frame)
    cleanup()
  }

  const onUserInterrupt = () => cancel()

  const cleanup = () => {
    window.removeEventListener('wheel', onUserInterrupt)
    window.removeEventListener('touchstart', onUserInterrupt)
    window.removeEventListener('keydown', onUserInterrupt)
  }

  window.addEventListener('wheel', onUserInterrupt, { passive: true })
  window.addEventListener('touchstart', onUserInterrupt, { passive: true })
  window.addEventListener('keydown', onUserInterrupt)

  const tick = (now) => {
    if (cancelled) return
    const t = Math.min(1, (now - started) / duration)
    window.scrollTo(0, startY + distance * easeInOut(t))
    if (t < 1) {
      frame = requestAnimationFrame(tick)
    } else {
      cleanup()
    }
  }

  frame = requestAnimationFrame(tick)
  return cancel
}
