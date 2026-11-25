import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { applySponsorships } from '../constants/monetization'
import {
  ensureRestaurantsLoaded,
  listRestaurants,
  subscribePublished,
} from '../data/restaurants'
import { setPublishedExtras } from '../data/publishedCatalog'
import { applyPlaceOverrides } from '../utils/placeOverrides'

const CatalogContext = createContext(null)

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog musí být uvnitř CatalogProvider')
  return ctx
}

export function CatalogProvider({ children }) {
  const [tick, setTick] = useState(0)
  const [catalogReady, setCatalogReady] = useState(false)
  const [loadState, setLoadState] = useState('loading')
  const [sponsorships, setSponsorships] = useState([])
  const [overrides, setOverrides] = useState([])

  useEffect(() => subscribePublished(() => setTick((n) => n + 1)), [])

  useEffect(() => {
    let cancelled = false
    let idleId = 0
    let timerId = 0
    const finish = () => {
      if (cancelled) return
      setCatalogReady(true)
      setTick((n) => n + 1)
    }
    const load = () => {
      ensureRestaurantsLoaded()
        .then(finish)
        .catch(finish)
    }
    // Až po prvním painte — LCP hero nesmí čekat na parse ~1 MB katalogu.
    const kick = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(load, { timeout: 900 })
      } else {
        timerId = window.setTimeout(load, 0)
      }
    }
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(kick)
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      if (idleId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId)
      }
      if (timerId) window.clearTimeout(timerId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/published-places', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return
        if (body?.ok && Array.isArray(body.places)) {
          setPublishedExtras(body.places)
          setLoadState('ready')
          setTick((n) => n + 1)
        } else {
          setLoadState('empty')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/sponsorships', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.ok && Array.isArray(body.sponsorships)) setSponsorships(body.sponsorships)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tick])

  useEffect(() => {
    let cancelled = false
    fetch('/api/place-overrides', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.ok && Array.isArray(body.overrides)) setOverrides(body.overrides)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tick])

  const restaurants = useMemo(() => {
    void tick
    if (!catalogReady) return []
    const merged = applyPlaceOverrides(listRestaurants(), overrides)
    return applySponsorships(merged, sponsorships)
  }, [sponsorships, overrides, tick, catalogReady])

  const value = useMemo(
    () => ({
      restaurants,
      catalogReady,
      loadState,
      refreshPublished: async () => {
        const res = await fetch('/api/published-places', { credentials: 'same-origin' })
        const body = await res.json().catch(() => ({}))
        if (body?.ok && Array.isArray(body.places)) setPublishedExtras(body.places)
        setTick((n) => n + 1)
        return body
      },
      refreshOverrides: async () => {
        const res = await fetch('/api/place-overrides', { credentials: 'same-origin' })
        const body = await res.json().catch(() => ({}))
        if (body?.ok && Array.isArray(body.overrides)) setOverrides(body.overrides)
        setTick((n) => n + 1)
        return body
      },
    }),
    [restaurants, catalogReady, loadState],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
