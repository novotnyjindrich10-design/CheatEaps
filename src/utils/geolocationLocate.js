/**
 * Rychlé první zjištění polohy: cache až 5 min, bez high-accuracy, krátký timeout.
 * Přesnější GPS jen na výslovnou žádost (highAccuracy).
 */
export const FAST_GEO_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 300_000,
})

export const PRECISE_GEO_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 0,
})

/** Obnova tlačítkem — vždy čerstvá poloha, bez cache prohlížeče. */
export const REFRESH_GEO_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 0,
})

/** Vlastní strop UI — Geolocation API může čekat na dialog oprávnění déle než `timeout`. */
export const UI_LOCATE_DEADLINE_MS = 15_000

export const STORED_ORIGIN_FRESH_MS = 300_000

export function geolocationOptions({ highAccuracy = false, forceRefresh = false } = {}) {
  if (forceRefresh) return { ...REFRESH_GEO_OPTIONS }
  return highAccuracy ? { ...PRECISE_GEO_OPTIONS } : { ...FAST_GEO_OPTIONS }
}

/** Stejné souřadnice (cca 1 m) — aktualizace „nic nezměnila“. */
export function sameCoordinates(a, b, epsilon = 0.00001) {
  if (!a || !b) return false
  return Math.abs(Number(a.lat) - Number(b.lat)) < epsilon && Math.abs(Number(a.lon) - Number(b.lon)) < epsilon
}

export function isStoredOriginFresh(origin, now = Date.now(), maxAgeMs = STORED_ORIGIN_FRESH_MS) {
  if (!origin?.updatedAt) return false
  const t = Date.parse(origin.updatedAt)
  if (!Number.isFinite(t)) return false
  return now - t <= maxAgeMs
}

export function classifyGeolocationError(err) {
  const code = err?.code
  if (code === 1) return 'denied'
  if (code === 2) return 'unavailable'
  if (code === 3) return 'timeout'
  if (typeof err === 'string') return err
  return 'error'
}

/**
 * Jednorázový požadavek s ochranou proti závodům a UI deadline.
 * `isCurrent()` musí vrátit false, když už běží novější požadavek nebo unmount.
 */
export function requestGeolocationPosition({
  geolocation,
  isSecureContext = true,
  options = FAST_GEO_OPTIONS,
  uiDeadlineMs = UI_LOCATE_DEADLINE_MS,
  isCurrent = () => true,
  onSuccess,
  onError,
  onUiTimeout,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  let settled = false
  let uiTimer = null

  const settle = (fn) => {
    if (settled) return false
    if (!isCurrent()) {
      settled = true
      if (uiTimer != null) clearTimeoutFn(uiTimer)
      return false
    }
    settled = true
    if (uiTimer != null) clearTimeoutFn(uiTimer)
    fn()
    return true
  }

  const cancel = () => {
    settled = true
    if (uiTimer != null) clearTimeoutFn(uiTimer)
  }

  if (isSecureContext === false) {
    settle(() => onError?.({ reason: 'insecure' }))
    return { cancel }
  }

  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    settle(() => onError?.({ reason: 'unsupported' }))
    return { cancel }
  }

  uiTimer = setTimeoutFn(() => {
    settle(() => {
      onUiTimeout?.()
      onError?.({ reason: 'timeout', source: 'ui' })
    })
  }, uiDeadlineMs)

  geolocation.getCurrentPosition(
    (pos) => {
      settle(() => onSuccess?.(pos))
    },
    (err) => {
      settle(() => onError?.({ reason: classifyGeolocationError(err), error: err }))
    },
    options,
  )

  return { cancel }
}
