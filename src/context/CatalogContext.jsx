import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { listRestaurants, subscribePublished } from '../data/restaurants'
import { setPublishedExtras } from '../data/publishedCatalog'

const CatalogContext = createContext(null)

export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog musí být uvnitř CatalogProvider')
  return ctx
}

export function CatalogProvider({ children }) {
  const [tick, setTick] = useState(0)
  const [loadState, setLoadState] = useState('loading')

  useEffect(() => subscribePublished(() => setTick((n) => n + 1)), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/published-places', { credentials: 'same-origin' })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return
        if (body?.ok && Array.isArray(body.places)) {
          setPublishedExtras(body.places)
          setLoadState('ready')
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

  const restaurants = listRestaurants()
  void tick

  const value = useMemo(
    () => ({
      restaurants,
      loadState,
      refreshPublished: async () => {
        const res = await fetch('/api/published-places', { credentials: 'same-origin' })
        const body = await res.json().catch(() => ({}))
        if (body?.ok && Array.isArray(body.places)) setPublishedExtras(body.places)
        return body
      },
    }),
    [restaurants, loadState],
  )

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
