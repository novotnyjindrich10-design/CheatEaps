import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import HomeSearch from '../components/HomeSearch'
import { IconMagnet } from '../components/navIcons'

const CategoryStrip = lazy(() => import('../components/CategoryStrip'))
const RestaurantCard = lazy(() => import('../components/RestaurantCard'))
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { partitionPlacements } from '../constants/monetization'
import { compareByRecordQuality } from '../utils/recordQuality'
import { suppressCatalogDuplicates } from '../utils/catalogDuplicates'
import { filterAndSortRestaurants } from '../utils/filterRestaurants'
import { presentOsmContact } from '../utils/osmContact'
import { isOpenNowReliable } from '../utils/openingStatus'
import {
  prefersReducedMotion,
  readMagnetPreference,
  writeMagnetPreference,
} from '../utils/magnetScroll'
import { TAB_RESELECT_EVENT } from '../utils/navReselect'
import { clearScrollPosition, readScrollPosition } from '../utils/scrollRestore'

const INITIAL_BATCH = 12
const LOAD_BATCH = 12

function isWeakRecommendation(place) {
  const name = String(place?.name || '')
  if (/barber|holič|kadern|kadeřnict/i.test(name)) return true
  if (!place?.category || place.category === 'neuvedeno') {
    if (!presentOsmContact(place).hasHours && !place.officialWebsite && !place.website) return true
  }
  return false
}

/** Bez polohy: různé kategorie, v každé nejlíp zdokumentovaný podnik, pak zbytek katalogu. */
function orderWithoutGps(places) {
  const clean = suppressCatalogDuplicates(places)
  const byCategory = new Map()
  for (const place of clean) {
    const key = place.category || 'neuvedeno'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key).push(place)
  }
  for (const list of byCategory.values()) {
    list.sort(compareByRecordQuality)
  }

  const categories = [...byCategory.keys()]
  const picked = []
  const seen = new Set()

  while (categories.length > 0) {
    for (let i = 0; i < categories.length; ) {
      const key = categories[i]
      const list = byCategory.get(key)
      const next = list.shift()
      if (!next) {
        categories.splice(i, 1)
        continue
      }
      if (!seen.has(next.id)) {
        seen.add(next.id)
        picked.push(next)
      }
      if (list.length === 0) categories.splice(i, 1)
      else i += 1
    }
  }

  const open = []
  const rest = []
  for (const place of picked) {
    const hoursRaw = presentOsmContact(place).hoursRaw
    if (hoursRaw && isOpenNowReliable(hoursRaw)) open.push(place)
    else rest.push(place)
  }
  return [...open, ...rest]
}

function orderNearest(places) {
  return filterAndSortRestaurants(suppressCatalogDuplicates(places), {
    hasOrigin: true,
    sortBy: 'distance',
  })
}

export default function Home() {
  const { restaurants, catalogReady } = useCatalog()
  const { attachDistances, origin, needsLocateGesture, locate, status: locationStatus } = useLocationState()
  const hasOrigin = Boolean(origin)
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH)
  const [magnetOn, setMagnetOn] = useState(() => readMagnetPreference())
  const [listVaried, setListVaried] = useState(null)
  const sentinelRef = useRef(null)
  const restoreDoneRef = useRef(false)
  const orderKeyRef = useRef('')

  const organic = useMemo(() => partitionPlacements(restaurants).organic, [restaurants])
  const located = useMemo(() => attachDistances(organic), [attachDistances, organic])

  const ordered = useMemo(() => {
    if (!located.length) return []
    const usable = located.filter((place) => !isWeakRecommendation(place))
    const source = usable.length >= 6 ? usable : located
    return hasOrigin ? orderNearest(source) : orderWithoutGps(source)
  }, [hasOrigin, located])

  const orderKey = `${hasOrigin ? 'gps' : 'rank'}:${ordered.length}`
  if (orderKeyRef.current !== orderKey) {
    orderKeyRef.current = orderKey
    if (visibleCount !== INITIAL_BATCH) setVisibleCount(INITIAL_BATCH)
    if (listVaried !== null) setListVaried(null)
    restoreDoneRef.current = false
  }

  useEffect(() => {
    const onReselect = (event) => {
      if (event.detail?.tab !== 'home') return
      setVisibleCount(INITIAL_BATCH)
      clearScrollPosition('/')
      restoreDoneRef.current = true
    }
    window.addEventListener(TAB_RESELECT_EVENT, onReselect)
    return () => window.removeEventListener(TAB_RESELECT_EVENT, onReselect)
  }, [])

  useLayoutEffect(() => {
    if (restoreDoneRef.current || !catalogReady || ordered.length === 0) return
    const y = readScrollPosition('/')
    if (y == null) {
      restoreDoneRef.current = true
      return
    }
    const needed = Math.min(ordered.length, Math.max(INITIAL_BATCH, Math.ceil(y / 280) + 4))
    if (visibleCount < needed) {
      setVisibleCount(needed)
      return
    }
    clearScrollPosition('/')
    window.scrollTo(0, y)
    restoreDoneRef.current = true
  }, [catalogReady, ordered.length, visibleCount])

  const visibleBase = useMemo(() => ordered.slice(0, visibleCount), [ordered, visibleCount])

  useEffect(() => {
    if (visibleBase.length < 1) {
      setListVaried(null)
      return undefined
    }
    let cancelled = false
    import('../utils/pageIllustrations')
      .then(({ varyPixabayOnPage: vary }) => {
        if (!cancelled) setListVaried(vary(visibleBase))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [visibleBase])

  const visible = listVaried ?? visibleBase
  const hasMore = visibleCount < ordered.length
  const listTitle = hasOrigin ? 'Nejbližší podniky' : 'Objev podniky v Brně'
  const magnetActive = magnetOn && !prefersReducedMotion()

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return undefined
    const node = sentinelRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setVisibleCount((count) => Math.min(ordered.length, count + LOAD_BATCH))
      },
      { root: null, rootMargin: '480px 0px', threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore, ordered.length, visibleCount])

  const toggleMagnet = () => {
    if (prefersReducedMotion()) {
      setMagnetOn(false)
      writeMagnetPreference(false)
      return
    }
    setMagnetOn((prev) => {
      const next = !prev
      writeMagnetPreference(next)
      return next
    })
  }

  return (
    <main className="page home-page home-page--compact">
      <section className="home-hero home-hero--compact">
        <div className="home-hero-panel">
          <h1 className="visually-hidden">Najdi jídlo v Brně</h1>
          <HomeSearch />
          {needsLocateGesture ? (
            <button
              type="button"
              className="home-locate-fallback"
              onClick={() => locate({ forceRefresh: false })}
              disabled={locationStatus === 'locating'}
            >
              {locationStatus === 'locating' ? 'Zjišťuji polohu…' : 'Použít moji polohu'}
            </button>
          ) : null}
        </div>
      </section>

      <section className="home-discover home-discover--compact" aria-label="Kategorie">
        <Suspense fallback={<div className="category-grid-wrap" style={{ minHeight: 120 }} aria-hidden="true" />}>
          <CategoryStrip asLinks variant="grid" />
        </Suspense>
        <div className="home-explore-row">
          <Link to="/results" className="btn btn-primary home-all-places-btn">
            Prozkoumat nabídku
            <span className="home-explore-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <button
            type="button"
            className={`home-magnet-toggle${magnetActive ? ' is-on' : ''}`}
            aria-pressed={magnetActive}
            onClick={toggleMagnet}
            title={magnetActive ? 'Vypnout magnetické scrollování' : 'Zapnout magnetické scrollování'}
          >
            <IconMagnet />
            <span>Magnet</span>
          </button>
        </div>
      </section>

      <section className="home-listings home-listings--compact" aria-labelledby="featured-title">
        <h2 id="featured-title" className="section-title">
          {listTitle}
        </h2>
        {!hasOrigin ? (
          <p className="section-desc home-sort-note">
            Bez polohy řadíme podle kategorií a úplnosti údajů — ne podle skutečné vzdálenosti.
          </p>
        ) : null}
        {!catalogReady ? (
          <p className="section-desc" role="status">
            Načítám tipy z katalogu…
          </p>
        ) : (
          <Suspense fallback={<p className="section-desc">Načítám karty…</p>}>
            <ul className={`restaurant-list home-restaurant-list${magnetActive ? ' restaurant-list--magnet' : ''}`}>
              {visible.map((restaurant, index) => (
                <li key={restaurant.id} className={magnetActive ? 'restaurant-list-snap' : undefined}>
                  <RestaurantCard restaurant={restaurant} index={index} />
                </li>
              ))}
            </ul>
            {hasMore ? (
              <div ref={sentinelRef} className="home-list-sentinel" aria-hidden="true">
                <p className="section-desc home-list-loading" role="status">
                  Načítám další podniky…
                </p>
              </div>
            ) : ordered.length > 0 ? (
              <p className="section-desc home-list-end" role="status">
                To je celý katalog ({ordered.length} podniků).
              </p>
            ) : null}
          </Suspense>
        )}
      </section>
    </main>
  )
}
