import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { restaurants } from '../data/restaurants'
import { geolocationErrorMessage, hasFiniteLatLon, hasVerifiedCoordinates } from '../utils/geo'
import {
  geolocationOptions,
  isStoredOriginFresh,
  requestGeolocationPosition,
  sameCoordinates,
  UI_LOCATE_DEADLINE_MS,
} from '../utils/geolocationLocate'
import {
  applyRouteDistances,
  collectRouteDistances,
  isFootRoutingEnabled,
  resolveFootRouteTableUrl,
} from '../utils/routeDistance'

const STORAGE_ORIGIN = 'cheapeats.geo.origin'
const STORAGE_PROMPT = 'cheapeats.geo.prompt'
const EMPTY_DISTANCES = new Map()
const routeMemory = new Map()

const LocationContext = createContext(null)

export function useLocationState() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationState musí být uvnitř LocationProvider')
  return ctx
}

function readJson(key, storage = localStorage) {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value, storage = localStorage) {
  try {
    if (value == null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    /* soukromý režim / plné úložiště */
  }
}

function readStoredOrigin() {
  const saved = readJson(STORAGE_ORIGIN)
  if (!saved || (saved.type !== 'gps' && saved.type !== 'manual')) return null
  if (!hasFiniteLatLon(saved.lat, saved.lon)) return null
  return saved
}

/** dismissed | accepted | null (ještě nerozhodnuto) */
function readPromptChoice() {
  try {
    const raw = localStorage.getItem(STORAGE_PROMPT)
    if (raw === 'dismissed' || raw === 'accepted') return raw
    return null
  } catch {
    return null
  }
}

function writePromptChoice(choice) {
  try {
    if (!choice) localStorage.removeItem(STORAGE_PROMPT)
    else localStorage.setItem(STORAGE_PROMPT, choice)
  } catch {
    /* ignore */
  }
}

function originKey(origin) {
  return `${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}`
}

export function LocationProvider({ children }) {
  const [origin, setOrigin] = useState(readStoredOrigin)
  const [status, setStatus] = useState(() => (readStoredOrigin() ? 'ready' : 'idle'))
  const [errorMessage, setErrorMessage] = useState('')
  const [promptChoice, setPromptChoice] = useState(readPromptChoice)
  const [geoGateReady, setGeoGateReady] = useState(() => {
    if (readStoredOrigin() || readPromptChoice() != null) return true
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return true
    return false
  })
  const [routeState, setRouteState] = useState({
    key: '',
    distances: new Map(),
    status: 'idle',
    message: '',
  })
  const locateGeneration = useRef(0)
  const locateCancelRef = useRef(null)
  const updatedFlashTimer = useRef(null)
  const autoLocateAttempted = useRef(false)
  const originRef = useRef(origin)
  originRef.current = origin

  const persistOrigin = useCallback((next) => {
    setOrigin(next)
    writeJson(STORAGE_ORIGIN, next)
  }, [])

  const clearUpdatedFlash = useCallback(() => {
    if (updatedFlashTimer.current != null) {
      clearTimeout(updatedFlashTimer.current)
      updatedFlashTimer.current = null
    }
  }, [])

  const flashStatus = useCallback(
    (nextStatus, generation, ms = 2200) => {
      setStatus(nextStatus)
      clearUpdatedFlash()
      updatedFlashTimer.current = setTimeout(() => {
        if (generation !== locateGeneration.current) return
        setStatus('ready')
        updatedFlashTimer.current = null
      }, ms)
    },
    [clearUpdatedFlash],
  )

  const locate = useCallback(
    ({ highAccuracy = false, forceRefresh = false } = {}) => {
      clearUpdatedFlash()
      setErrorMessage('')

      if (locateCancelRef.current) {
        locateCancelRef.current()
        locateCancelRef.current = null
      }

      const generation = ++locateGeneration.current
      const isCurrent = () => generation === locateGeneration.current
      const previous = originRef.current

      setStatus('locating')

      const { cancel } = requestGeolocationPosition({
        geolocation: typeof navigator !== 'undefined' ? navigator.geolocation : null,
        isSecureContext: typeof window === 'undefined' ? true : window.isSecureContext !== false,
        options: geolocationOptions({ highAccuracy, forceRefresh }),
        uiDeadlineMs: UI_LOCATE_DEADLINE_MS,
        isCurrent,
        onSuccess(pos) {
          const lat = pos?.coords?.latitude
          const lon = pos?.coords?.longitude
          if (!hasFiniteLatLon(lat, lon)) {
            setStatus('invalid')
            setErrorMessage(geolocationErrorMessage('invalid'))
            return
          }
          const accuracyRaw = pos?.coords?.accuracy
          const accuracy =
            typeof accuracyRaw === 'number' && Number.isFinite(accuracyRaw) && accuracyRaw > 0
              ? accuracyRaw
              : undefined
          const next = {
            lat,
            lon,
            label: 'Moje poloha',
            type: 'gps',
            updatedAt: new Date().toISOString(),
            ...(accuracy != null ? { accuracy } : {}),
          }
          persistOrigin(next)
          writePromptChoice('accepted')
          setPromptChoice('accepted')
          setErrorMessage('')
          if (forceRefresh && sameCoordinates(previous, next)) {
            flashStatus('current', generation)
          } else {
            flashStatus('updated', generation)
          }
        },
        onError({ reason }) {
          setStatus(reason)
          setErrorMessage(geolocationErrorMessage(reason))
          if (reason === 'denied') {
            writePromptChoice('dismissed')
            setPromptChoice('dismissed')
            // Po odebrání oprávnění nesmí zůstat stará GPS poloha jako „aktuální“.
            if (originRef.current?.type === 'gps') {
              persistOrigin(null)
              setRouteState({ key: '', distances: new Map(), status: 'idle', message: '' })
            }
          }
        },
      })

      locateCancelRef.current = cancel
    },
    [clearUpdatedFlash, flashStatus, persistOrigin],
  )

  const dismissPrompt = useCallback(() => {
    writePromptChoice('dismissed')
    setPromptChoice('dismissed')
  }, [])

  const acceptPrompt = useCallback(() => {
    writePromptChoice('accepted')
    setPromptChoice('accepted')
    locate({ forceRefresh: false, highAccuracy: false })
  }, [locate])

  useEffect(() => {
    return () => {
      locateGeneration.current += 1
      locateCancelRef.current?.()
      locateCancelRef.current = null
      clearUpdatedFlash()
    }
  }, [clearUpdatedFlash])

  const clearOrigin = useCallback(() => {
    if (locateCancelRef.current) {
      locateCancelRef.current()
      locateCancelRef.current = null
    }
    locateGeneration.current += 1
    clearUpdatedFlash()
    persistOrigin(null)
    setStatus('idle')
    setErrorMessage('')
    setRouteState({ key: '', distances: new Map(), status: 'idle', message: '' })
  }, [clearUpdatedFlash, persistOrigin])

  /** Vymaže uložené souřadnice i volbu výzvy — bezpečné „zapomenout“. */
  const forgetOrigin = useCallback(() => {
    clearOrigin()
    writePromptChoice(null)
    setPromptChoice(null)
  }, [clearOrigin])

  // Automaticky: granted → načti GPS. Denied → smaž uloženou GPS (nesmí se tvářit jako aktuální).
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      autoLocateAttempted.current = true
      setGeoGateReady(true)
      return undefined
    }

    let cancelled = false
    let permissionStatus = null
    let onChange = null

    const dropDeniedGps = () => {
      if (originRef.current?.type !== 'gps') return
      clearOrigin()
      writePromptChoice('dismissed')
      setPromptChoice('dismissed')
      setStatus('denied')
      setErrorMessage(geolocationErrorMessage('denied'))
    }

    const refreshIfGranted = () => {
      writePromptChoice('accepted')
      setPromptChoice('accepted')
      locate({ forceRefresh: false })
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (cancelled) return
        permissionStatus = result

        if (result.state === 'denied') {
          dropDeniedGps()
        } else if (result.state === 'granted' && !autoLocateAttempted.current) {
          refreshIfGranted()
        }

        autoLocateAttempted.current = true
        setGeoGateReady(true)

        onChange = () => {
          if (cancelled) return
          if (result.state === 'denied') dropDeniedGps()
          else if (result.state === 'granted') refreshIfGranted()
        }
        result.addEventListener?.('change', onChange)
      })
      .catch(() => {
        autoLocateAttempted.current = true
        setGeoGateReady(true)
      })

    return () => {
      cancelled = true
      if (permissionStatus && onChange) {
        permissionStatus.removeEventListener?.('change', onChange)
      }
    }
  }, [clearOrigin, locate])

  const setManualOrigin = useCallback(
    (place) => {
      if (!hasVerifiedCoordinates(place)) return
      if (locateCancelRef.current) {
        locateCancelRef.current()
        locateCancelRef.current = null
      }
      locateGeneration.current += 1
      clearUpdatedFlash()
      persistOrigin({
        lat: place.lat,
        lon: place.lon,
        label: place.name,
        type: 'manual',
        placeId: place.id,
        updatedAt: new Date().toISOString(),
      })
      writePromptChoice('accepted')
      setPromptChoice('accepted')
      setStatus('ready')
      setErrorMessage('')
    },
    [clearUpdatedFlash, persistOrigin],
  )

  const originCacheKey = origin && hasFiniteLatLon(origin.lat, origin.lon) ? originKey(origin) : ''
  const footRoutingOn = isFootRoutingEnabled()
  const cachedRoute = originCacheKey ? routeMemory.get(originCacheKey) : null
  let routeDistances = EMPTY_DISTANCES
  let routeStatus = 'idle'
  let routeMessage = ''
  if (cachedRoute) {
    routeDistances = cachedRoute.distances
    routeStatus = cachedRoute.status
    routeMessage = cachedRoute.message
  } else if (originCacheKey && !footRoutingOn) {
    // Haversine jen lokálně — bez volání veřejného demo OSRM.
    routeDistances = EMPTY_DISTANCES
    routeStatus = 'ready'
    routeMessage = ''
  } else if (originCacheKey && routeState.key === originCacheKey) {
    routeDistances = routeState.distances
    routeStatus = routeState.status
    routeMessage = routeState.message
  } else if (originCacheKey) {
    routeStatus = 'loading'
  }

  useEffect(() => {
    if (!originCacheKey || !footRoutingOn) return undefined
    if (routeMemory.has(originCacheKey)) return undefined

    const controller = new AbortController()
    let cancelled = false
    const targets = restaurants.filter((place) => hasVerifiedCoordinates(place))

    collectRouteDistances(origin, targets, {
      signal: controller.signal,
      endpoint: resolveFootRouteTableUrl(),
      onChunk(distances) {
        if (!cancelled) {
          setRouteState({ key: originCacheKey, distances, status: 'loading', message: '' })
        }
      },
    })
      .then((result) => {
        if (cancelled) return
        const failedAll = result.chunkCount > 0 && result.failedChunks === result.chunkCount
        const next = {
          key: originCacheKey,
          distances: result.distances,
          status: failedAll ? 'error' : 'ready',
          message: failedAll
            ? 'Pěší trasu se teď nepodařilo zjistit — ukazujeme vzdušnou vzdálenost.'
            : result.failedChunks > 0
              ? 'U části podniků chybí pěší trasa — u nich je vzdušná vzdálenost.'
              : '',
        }
        if (!failedAll) routeMemory.set(originCacheKey, next)
        setRouteState(next)
      })
      .catch((error) => {
        if (cancelled || error?.name === 'AbortError') return
        setRouteState({
          key: originCacheKey,
          distances: new Map(),
          status: 'error',
          message: 'Pěší trasu se teď nepodařilo zjistit — ukazujeme vzdušnou vzdálenost.',
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [origin, originCacheKey, footRoutingOn])

  const attachDistances = useCallback(
    (places) =>
      applyRouteDistances(places, routeDistances, {
        hasOrigin: Boolean(origin) && hasFiniteLatLon(origin.lat, origin.lon),
        pending: routeStatus === 'loading',
        originStatus: status,
        origin,
      }),
    [origin, routeDistances, routeStatus, status],
  )

  const originFresh = Boolean(origin) && isStoredOriginFresh(origin)
  // Počkej na Permissions API, ať se při granted neblikne modal před auto-locate.
  const showLocationPrompt =
    geoGateReady &&
    !origin &&
    promptChoice == null &&
    status !== 'denied' &&
    status !== 'locating'

  const value = useMemo(
    () => ({
      origin,
      originFresh,
      status,
      errorMessage,
      locate,
      clearOrigin,
      forgetOrigin,
      setManualOrigin,
      attachDistances,
      routeStatus,
      routeMessage,
      promptChoice,
      showLocationPrompt,
      acceptPrompt,
      dismissPrompt,
    }),
    [
      origin,
      originFresh,
      status,
      errorMessage,
      locate,
      clearOrigin,
      forgetOrigin,
      setManualOrigin,
      attachDistances,
      routeStatus,
      routeMessage,
      promptChoice,
      showLocationPrompt,
      acceptPrompt,
      dismissPrompt,
    ],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
