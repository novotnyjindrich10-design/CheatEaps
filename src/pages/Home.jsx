import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import HomeSearch from '../components/HomeSearch'

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

const FEATURED_COUNT = 12

function isWeakRecommendation(place) {
  const name = String(place?.name || '')
  if (/barber|holič|kadern|kadeřnict/i.test(name)) return true
  if (!place?.category || place.category === 'neuvedeno') {
    if (!presentOsmContact(place).hasHours && !place.officialWebsite && !place.website) return true
  }
  return false
}

/** Bez polohy: různé kategorie, v každé nejlíp zdokumentovaný podnik. */
function pickRecommended(places, limit = FEATURED_COUNT) {
  const byCategory = new Map()
  for (const place of suppressCatalogDuplicates(places)) {
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

  while (picked.length < limit && categories.length > 0) {
    for (let i = 0; i < categories.length && picked.length < limit; ) {
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

  return picked.sort(compareByRecordQuality)
}

function pickNearest(places, limit = FEATURED_COUNT) {
  return filterAndSortRestaurants(places, {
    hasOrigin: true,
    sortBy: 'distance',
  }).slice(0, limit)
}

function preferOpenPlaces(places) {
  const open = []
  const rest = []
  for (const place of places) {
    const hoursRaw = presentOsmContact(place).hoursRaw
    if (hoursRaw && isOpenNowReliable(hoursRaw)) open.push(place)
    else rest.push(place)
  }
  return [...open, ...rest]
}

export default function Home() {
  const { restaurants, catalogReady } = useCatalog()
  const { attachDistances, origin, needsLocateGesture, locate, status: locationStatus } = useLocationState()
  const hasOrigin = Boolean(origin)
  const [featuredVaried, setFeaturedVaried] = useState(null)

  const organic = useMemo(() => partitionPlacements(restaurants).organic, [restaurants])
  const located = useMemo(() => attachDistances(organic), [attachDistances, organic])

  const featuredBase = useMemo(() => {
    if (!located.length) return []
    const usable = located.filter((place) => !isWeakRecommendation(place))
    const source = usable.length >= 6 ? usable : located
    let picked = hasOrigin ? pickNearest(source) : pickRecommended(source)
    if (!hasOrigin) picked = preferOpenPlaces(picked).slice(0, FEATURED_COUNT)
    return picked
  }, [hasOrigin, located])

  useEffect(() => {
    if (featuredBase.length < 2) {
      setFeaturedVaried(null)
      return undefined
    }
    let cancelled = false
    import('../utils/pageIllustrations')
      .then(({ varyPixabayOnPage: vary }) => {
        if (!cancelled) setFeaturedVaried(vary(featuredBase))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [featuredBase])

  const featured = featuredVaried ?? featuredBase
  const featuredTitle = hasOrigin ? 'Nejbližší podniky' : 'Objev podniky v Brně'

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
        <Suspense fallback={<div className="category-grid-wrap" style={{ minHeight: 140 }} aria-hidden="true" />}>
          <CategoryStrip asLinks variant="grid" />
        </Suspense>
        <div className="home-all-places">
          <Link to="/results" className="btn btn-secondary home-all-places-btn">
            Prozkoumat nabídku
          </Link>
        </div>
      </section>

      <section className="home-listings home-listings--compact" aria-labelledby="featured-title">
        <h2 id="featured-title" className="section-title">
          {featuredTitle}
        </h2>
        {!catalogReady ? (
          <p className="section-desc" role="status">
            Načítám tipy z katalogu…
          </p>
        ) : (
          <Suspense fallback={<p className="section-desc">Načítám karty…</p>}>
            <ul className="restaurant-list">
              {featured.map((restaurant, index) => (
                <li key={restaurant.id}>
                  <RestaurantCard restaurant={restaurant} index={index} />
                </li>
              ))}
            </ul>
          </Suspense>
        )}
      </section>
    </main>
  )
}
