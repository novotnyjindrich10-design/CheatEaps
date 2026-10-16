import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { restaurants } from '../data/restaurants'
import { geolocationErrorMessage, hasFiniteLatLon, hasVerifiedCoordinates } from '../utils/geo'
import { applyRouteDistances, collectRouteDistances } from '../utils/routeDistance'

const STORAGE_ORIGIN = 'cheapeats.geo.origin'
const EMPTY_DISTANCES = new Map()
const routeMemory = new Map()

const LocationContext = createContext(null)

export function useLocationState() {
  const ctx = useContext(LocationContext)
  if (!ctx) throw new Error('useLocationState musí být uvnitř LocationProvider')
  return ctx
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
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

function originKey(origin) {
  return `${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}`
}

export function LocationProvider({ children }) {
  const [origin, setOrigin] = useState(readStoredOrigin)
  const [status, setStatus] = useState(() => (readStoredOrigin() ? 'ready' : 'idle'))
  const [errorMessage, setErrorMessage] = useState('')
  const [routeState, setRouteState] = useState({
    key: '',
    distances: new Map(),
    status: 'idle',
    message: '',
  })
  const persistOrigin = useCallback((next) => {
    setOrigin(next)
    writeJson(STORAGE_ORIGIN, next)
  }, [])

  const locate = useCallback(() => {
    setErrorMessage('')
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setStatus('insecure')
      setErrorMessage(geolocationErrorMessage('insecure'))
      return
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unsupported')
      setErrorMessage(geolocationErrorMessage('unsupported'))
      return
    }

    setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude
        const lon = pos?.coords?.longitude
        if (!hasFiniteLatLon(lat, lon)) {
          setStatus('invalid')
          setErrorMessage(geolocationErrorMessage('invalid'))
          return
        }
        persistOrigin({
          lat,
          lon,
          label: 'Moje poloha',
          type: 'gps',
          updatedAt: new Date().toISOString(),
        })
        setStatus('ready')
        setErrorMessage('')
      },
      (err) => {
        const code = err?.code
        const reason = code === 1 ? 'denied' : code === 2 ? 'unavailable' : code === 3 ? 'timeout' : 'error'
        setStatus(reason)
        setErrorMessage(geolocationErrorMessage(reason))
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 },
    )
  }, [persistOrigin])

  const clearOrigin = useCallback(() => {
    persistOrigin(null)
    setStatus('idle')
    setErrorMessage('')
    setRouteState({ key: '', distances: new Map(), status: 'idle', message: '' })
  }, [persistOrigin])

  const setManualOrigin = useCallback(
    (place) => {
      if (!hasVerifiedCoordinates(place)) return
      persistOrigin({
        lat: place.lat,
        lon: place.lon,
        label: place.name,
        type: 'manual',
        placeId: place.id,
        updatedAt: new Date().toISOString(),
      })
      setStatus('ready')
      setErrorMessage('')
    },
    [persistOrigin],
  )

  const originCacheKey = origin && hasFiniteLatLon(origin.lat, origin.lon) ? originKey(origin) : ''
  const cachedRoute = originCacheKey ? routeMemory.get(originCacheKey) : null
  let routeDistances = EMPTY_DISTANCES
  let routeStatus = 'idle'
  let routeMessage = ''
  if (cachedRoute) {
    routeDistances = cachedRoute.distances
    routeStatus = cachedRoute.status
    routeMessage = cachedRoute.message
  } else if (originCacheKey && routeState.key === originCacheKey) {
    routeDistances = routeState.distances
    routeStatus = routeState.status
    routeMessage = routeState.message
  } else if (originCacheKey) {
    routeStatus = 'loading'
  }

  useEffect(() => {
    if (!originCacheKey) return undefined
    if (routeMemory.has(originCacheKey)) return undefined

    const controller = new AbortController()
    let cancelled = false
    const targets = restaurants.filter((place) => hasVerifiedCoordinates(place))

    collectRouteDistances(origin, targets, {
      signal: controller.signal,
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
            ? 'Pěší vzdálenost se teď nepodařilo zjistit.'
            : result.failedChunks > 0
              ? 'U části podniků se pěší vzdálenost nepodařilo zjistit.'
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
          message: 'Pěší vzdálenost se teď nepodařilo zjistit.',
        })
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [origin, originCacheKey])

  const attachDistances = useCallback(
    (places) =>
      applyRouteDistances(places, routeDistances, {
        hasOrigin: Boolean(origin) && hasFiniteLatLon(origin.lat, origin.lon),
        pending: routeStatus === 'loading',
        originStatus: status,
      }),
    [origin, routeDistances, routeStatus, status],
  )

  const value = useMemo(
    () => ({
      origin,
      status,
      errorMessage,
      locate,
      clearOrigin,
      setManualOrigin,
      attachDistances,
      routeStatus,
      routeMessage,
    }),
    [origin, status, errorMessage, locate, clearOrigin, setManualOrigin, attachDistances, routeStatus, routeMessage],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}
