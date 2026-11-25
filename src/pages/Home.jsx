import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import HomeSearch from '../components/HomeSearch'
import ResultsFilters from '../components/ResultsFilters'
import ResultsPager from '../components/ResultsPager'
import LocationBar from '../components/LocationBar'

const CategoryStrip = lazy(() => import('../components/CategoryStrip'))
const RestaurantCard = lazy(() => import('../components/RestaurantCard'))
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { partitionPlacements } from '../constants/monetization'
import { applyCategorySelection } from '../constants/filters'
import { filterAndSortRestaurants } from '../utils/filterRestaurants'
import { varyPixabayOnPage } from '../utils/pageIllustrations'
import { slicePage } from '../utils/pagination'
import { smoothScrollTo } from '../utils/smoothScroll'

const EMPTY_FILTERS = {
  search: '',
  cuisineType: '',
  maxBudget: '',
  maxDistance: '',
  sortBy: '',
  vegetarianOnly: false,
  veganOnly: false,
  verifiedPricesOnly: false,
  dealsOnly: false,
  hoursOnly: false,
  openNowOnly: false,
  view: 'list',
}

export default function Home() {
  const { restaurants, catalogReady } = useCatalog()
  const { attachDistances, origin, needsLocateGesture, locate, status: locationStatus } = useLocationState()
  const hasOrigin = Boolean(origin)
  const browseRef = useRef(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(true)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)

  const organic = useMemo(() => partitionPlacements(restaurants).organic, [restaurants])
  const located = useMemo(() => attachDistances(organic), [attachDistances, organic])
  const filtered = useMemo(
    () =>
      filterAndSortRestaurants(located, {
        ...filters,
        hasOrigin,
      }),
    [located, filters, hasOrigin],
  )
  const paged = useMemo(() => slicePage(filtered, page), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    if (paged.page === page) return
    setPage(paged.page)
  }, [paged.page, page])

  const scrollToBrowse = () => {
    window.requestAnimationFrame(() => {
      if (browseRef.current) smoothScrollTo(browseRef.current, { offset: 72, duration: 480 })
    })
  }

  const openAllPlaces = () => {
    setFilters((prev) => ({ ...prev, cuisineType: '' }))
    setBrowseOpen(true)
    setFiltersExpanded(true)
    scrollToBrowse()
  }

  const onCategorySelect = (type) => {
    setFilters((prev) => applyCategorySelection(prev, type === prev.cuisineType ? '' : type))
    setBrowseOpen(true)
    setFiltersExpanded(true)
    scrollToBrowse()
  }

  const cards = useMemo(
    () => (browseOpen && catalogReady ? varyPixabayOnPage(paged.items) : []),
    [browseOpen, catalogReady, paged.items],
  )

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
          <CategoryStrip
            asLinks={false}
            variant="grid"
            activeType={filters.cuisineType}
            onSelect={onCategorySelect}
          />
        </Suspense>
        <div className="home-all-places">
          <button type="button" className="btn btn-secondary home-all-places-btn" onClick={openAllPlaces}>
            Všechny podniky
          </button>
        </div>
      </section>

      {browseOpen ? (
        <section className="home-browse" ref={browseRef} aria-label="Podniky a filtry">
          <LocationBar places={restaurants} />
          <ResultsFilters
            filters={filters}
            onChange={setFilters}
            hasOrigin={hasOrigin}
            expanded={filtersExpanded}
            onExpandedChange={setFiltersExpanded}
          />
          {!catalogReady ? (
            <p className="section-desc" role="status">
              Načítám katalog…
            </p>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <p>Žádný podnik neodpovídá filtrům.</p>
              <button type="button" className="btn btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                Resetovat filtry
              </button>
            </div>
          ) : (
            <>
              <div className="results-summary">
                <p>
                  Zobrazuji {paged.startIndex}–{paged.endIndex} z {paged.total}
                </p>
              </div>
              <Suspense fallback={<p className="section-desc">Načítám karty…</p>}>
                <ul className="restaurant-list">
                  {cards.map((restaurant, index) => (
                    <li key={restaurant.id}>
                      <RestaurantCard restaurant={restaurant} index={index} />
                    </li>
                  ))}
                </ul>
              </Suspense>
              <ResultsPager page={paged.page} totalPages={paged.totalPages} onChange={setPage} />
            </>
          )}
        </section>
      ) : null}
    </main>
  )
}
