import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import RestaurantCard from '../components/RestaurantCard'
import SearchBar from '../components/SearchBar'
import ResultsFilters from '../components/ResultsFilters'
import ResultsPager from '../components/ResultsPager'
import CategoryStrip from '../components/CategoryStrip'
import CategoryDecorations from '../components/CategoryDecorations'

const RestaurantMap = lazy(() => import('../components/RestaurantMap'))
import {
  BUDGET_OPTIONS,
  DISTANCE_OPTIONS,
  applyCategorySelection,
  getActiveCategoryKey,
  getCategoryMeta,
  isDealsCategory,
  normalizeCategoryParam,
  sortOptionsForOrigin,
} from '../constants/filters'
import { DEALS_EMPTY_MESSAGE } from '../data/restaurantDeals'
import {
  filterAndSortRestaurants,
  parseResultsSearchParams,
  buildResultsSearchParams,
} from '../utils/filterRestaurants'
import { describeSearchIntent, searchWithoutIntent } from '../utils/smartSearch'
import { useCatalog } from '../context/CatalogContext'
import { useAuth } from '../context/authSession'
import { partitionPlacements, SPONSORED_LABEL } from '../constants/monetization'
import { varyPixabayOnPage } from '../utils/pageIllustrations'
import { useLocationState } from '../context/LocationContext'
import LocationBar from '../components/LocationBar'
import LocationPrompt from '../components/LocationPrompt'
import { parsePageParam, slicePage } from '../utils/pagination'
import { DEALS_RESULTS_PATH, loginPath } from '../utils/authReturn'
import { PUBLIC_V1 } from '../constants/publicV1'
import { smoothScrollTo } from '../utils/smoothScroll'
import { clearScrollPosition, readScrollPosition } from '../utils/scrollRestore'
import { currentInternalPath } from '../utils/internalPath'
import { readFilterPrefs, writeFilterPrefs } from '../utils/filterPrefs'
import { rememberRecentSearch } from '../utils/recentSearches'
import { applyPageMeta } from '../utils/pageMeta'

function formatPlaceCount(n) {
  if (n === 1) return '1 místo'
  if (n >= 2 && n <= 4) return `${n} místa`
  return `${n} míst`
}

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value
}

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { restaurants, catalogReady } = useCatalog()
  const { session } = useAuth()
  const filters = parseResultsSearchParams(searchParams)
  const activeType = getActiveCategoryKey(filters)
  const categoryMeta = getCategoryMeta(activeType)
  const theme = activeType || 'default'
  const rawType = searchParams.get('type') || ''
  const listTopRef = useRef(null)
  const mapSectionRef = useRef(null)
  const mapVisitRef = useRef(0)
  const scrolledMapVisitRef = useRef(0)
  const prefsRestoredRef = useRef(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapSelectedId, setMapSelectedId] = useState('')
  const [mapBounds, setMapBounds] = useState(null)
  const dealsGate = filters.dealsOnly
  const dealsLogin = loginPath(DEALS_RESULTS_PATH)

  const updateFilters = (next, { resetPage = true, history = 'push' } = {}) => {
    writeFilterPrefs(next)
    const params = buildResultsSearchParams(next)
    if (!resetPage) {
      const page = parsePageParam(searchParams.get('page'))
      if (page > 1) params.set('page', String(page))
    }
    setSearchParams(params, { replace: history === 'replace' })
  }

  const clearAllFilters = () => {
    writeFilterPrefs({})
    setMapBounds(null)
    setSearchParams({})
  }

  useEffect(() => {
    if (prefsRestoredRef.current) return
    prefsRestoredRef.current = true
    if ([...searchParams.keys()].length > 0) return
    const prefs = readFilterPrefs()
    if (!prefs) return
    setSearchParams(buildResultsSearchParams(prefs), { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!rawType || isDealsCategory(rawType)) return
    const normalized = normalizeCategoryParam(rawType)
    if (normalized === rawType) return
    const params = buildResultsSearchParams({ ...filters, cuisineType: normalized })
    const page = parsePageParam(searchParams.get('page'))
    if (page > 1) params.set('page', String(page))
    setSearchParams(params, { replace: true })
  }, [filters, rawType, searchParams, setSearchParams])

  const {
    attachDistances,
    origin,
    routeStatus,
    locate,
    status: locationStatus,
    errorMessage: locationError,
    forgetOrigin,
  } = useLocationState()
  const [mapFocusToken, setMapFocusToken] = useState(0)
  const viewMode = filters.view === 'map' ? 'map' : 'list'
  const located = useMemo(() => attachDistances(restaurants), [attachDistances, restaurants])
  const matched = useMemo(
    () =>
      filterAndSortRestaurants(located, {
        ...parseResultsSearchParams(searchParams),
        hasOrigin: Boolean(origin),
        mapBounds: viewMode === 'map' ? mapBounds : null,
      }),
    [located, searchParams, origin, mapBounds, viewMode],
  )
  const placement = useMemo(() => partitionPlacements(matched), [matched])
  const filtered = placement.organic
  const sponsored = placement.sponsored

  const requestedPage = parsePageParam(searchParams.get('page'))
  const paged = useMemo(() => slicePage(filtered, requestedPage), [filtered, requestedPage])

  useEffect(() => {
    if (requestedPage === paged.page) return
    const params = new URLSearchParams(searchParams)
    if (paged.page <= 1) params.delete('page')
    else params.set('page', String(paged.page))
    setSearchParams(params, { replace: true })
  }, [paged.page, requestedPage, searchParams, setSearchParams])

  const waitingForDistance =
    Boolean(origin) && filters.maxDistance !== '' && routeStatus === 'loading' && filtered.length === 0
  const distanceUnavailable =
    Boolean(origin) && filters.maxDistance !== '' && routeStatus === 'error' && filtered.length === 0
  const mapPlaces = useMemo(() => [...sponsored, ...filtered], [sponsored, filtered])

  const handleMapReady = useCallback(() => {
    setMapReady(true)
  }, [])

  useEffect(() => {
    if (viewMode !== 'map') {
      setMapReady(false)
      setMapSelectedId('')
      setMapBounds(null)
      return
    }
    mapVisitRef.current += 1
  }, [viewMode])

  useEffect(() => {
    if (viewMode !== 'map' || !mapReady || !mapSectionRef.current) return undefined
    if (scrolledMapVisitRef.current === mapVisitRef.current) return undefined
    scrolledMapVisitRef.current = mapVisitRef.current
    return smoothScrollTo(mapSectionRef.current, { offset: 96, duration: 620 })
  }, [viewMode, mapReady])

  useLayoutEffect(() => {
    if (viewMode === 'map') return
    const key = currentInternalPath({ pathname: '/results', search: `?${searchParams.toString()}` })
    const y = readScrollPosition(key)
    if (y == null) return
    clearScrollPosition(key)
    window.scrollTo(0, y)
  }, [searchParams, viewMode])

  useEffect(() => {
    const label = categoryMeta?.label
    const title = label
      ? `${label} v Brně | FoodGo Brno`
      : filters.openNowOnly
        ? 'Právě otevřené podniky v Brně | FoodGo Brno'
        : filters.maxBudget
          ? `Jídlo do ${filters.maxBudget} Kč v Brně | FoodGo Brno`
          : viewMode === 'map'
            ? 'Mapa restaurací v Brně | FoodGo Brno'
            : 'Restaurace a kavárny v Brně | FoodGo Brno'
    const description = label
      ? `${label} v Brně: podniky z katalogu FoodGo. Filtruj podle ověřené ceny a vzdálenosti.`
      : 'Najdi restauraci, kavárnu nebo bistro v Brně. FoodGo odděluje ověřené ceny od odhadů.'
    applyPageMeta({
      title,
      description: description.slice(0, 180),
      path: `/results${searchParams.toString() ? `?${searchParams.toString()}` : ''}`,
    })
  }, [categoryMeta, filters.maxBudget, filters.openNowOnly, searchParams, viewMode])

  let emptyMessage = 'Žádný podnik neodpovídá filtrům. Zkus uvolnit rozpočet, vzdálenost nebo hledání.'
  if (!catalogReady) {
    emptyMessage = 'Načítám katalog podniků…'
  } else if (waitingForDistance) {
    emptyMessage = 'Počítám pěší vzdálenost. Filtr vzdálenosti se použije, až budou čísla známá.'
  } else if (distanceUnavailable) {
    emptyMessage =
      'Pěší vzdálenost se teď nepodařilo zjistit. Zkus polohu aktualizovat, nebo filtr vzdálenosti vypni.'
  } else if (filters.dealsOnly && filtered.length === 0) {
    emptyMessage = DEALS_EMPTY_MESSAGE
  } else if ((filters.maxBudget || filters.verifiedPricesOnly) && filtered.length === 0) {
    emptyMessage =
      'Do limitu se počítá jen ověřená cena z menu (ne odhad). Aktuálně máme ověřenou cenu u části katalogu — zkus vyšší rozpočet, vypni „Jen ověřené ceny“, nebo prohlížej bez cenového filtru.'
  }

  if (isDealsCategory(rawType)) {
    const params = buildResultsSearchParams({ ...filters, cuisineType: '', dealsOnly: true })
    const qs = params.toString()
    return <Navigate to={qs ? `/results?${qs}` : DEALS_RESULTS_PATH} replace />
  }

  if (dealsGate && !PUBLIC_V1.memberDealsUi) {
    return (
      <main className="page results-page">
        <div className="page-head results-head">
          <Link to="/" className="back-link">
            ← Domů
          </Link>
          <h1>Slevy zatím nejsou ve veřejné verzi</h1>
          <p className="page-subtitle">
            FoodGo teď spouštíme jako bezplatný katalog. Ověřené členské slevy doplníme později —
            zatím hledej podle kuchyně, rozpočtu a vzdálenosti.
          </p>
          <Link to="/results" className="btn btn-primary">
            Najít podnik
          </Link>
        </div>
      </main>
    )
  }

  // UI brána: katalog slev je ve veřejném JS — přihlášení jen omezuje zobrazení, data nešifruje.
  if (dealsGate && session.ready && !session.authenticated) {
    return <Navigate to={dealsLogin} replace />
  }

  const setPage = (nextPage) => {
    const params = buildResultsSearchParams(filters)
    if (nextPage > 1) params.set('page', String(nextPage))
    setSearchParams(params)
    if (listTopRef.current) smoothScrollTo(listTopRef.current, { offset: 96, duration: 420 })
  }

  const intentNotes = describeSearchIntent(filters.search)
  const chips = []
  if (filters.search.trim()) chips.push({ key: 'search', label: `Hledání: ${filters.search.trim()}`, clear: { search: '' } })
  if (filters.maxBudget) {
    chips.push({
      key: 'budget',
      label: optionLabel(BUDGET_OPTIONS, filters.maxBudget),
      clear: { maxBudget: '' },
    })
  }
  if (filters.cuisineType) {
    chips.push({
      key: 'type',
      label: getCategoryMeta(filters.cuisineType)?.label || 'Kategorie',
      clear: { cuisineType: '' },
    })
  }
  if (filters.maxDistance) {
    chips.push({
      key: 'distance',
      label: optionLabel(DISTANCE_OPTIONS, filters.maxDistance),
      clear: { maxDistance: '' },
    })
  }
  if (filters.veganOnly) chips.push({ key: 'vegan', label: 'Veganské možnosti', clear: { veganOnly: false } })
  if (filters.vegetarianOnly) chips.push({ key: 'veg', label: 'Vegetariánské možnosti', clear: { vegetarianOnly: false } })
  if (filters.verifiedPricesOnly) chips.push({ key: 'verified', label: 'Jen ověřené ceny', clear: { verifiedPricesOnly: false } })
  if (filters.dealsOnly) chips.push({ key: 'deals', label: 'Ověřená sleva', clear: { dealsOnly: false } })
  if (filters.hoursOnly) chips.push({ key: 'hours', label: 'S otevírací dobou', clear: { hoursOnly: false } })
  if (filters.openNowOnly) chips.push({ key: 'open', label: 'Právě otevřeno', clear: { openNowOnly: false } })
  if (filters.sortBy) {
    chips.push({
      key: 'sort',
      label: optionLabel(sortOptionsForOrigin(Boolean(origin)), filters.sortBy),
      clear: { sortBy: '' },
    })
  }
  const filtersActive = chips.length > 0

  return (
    <main className={`page results-page theme-${theme}`}>
      <CategoryDecorations theme={theme} />

      <div className="page-head results-head">
        <Link to="/" className="back-link">
          ← Domů
        </Link>
        <h1>
          {categoryMeta
            ? categoryMeta.label
            : filters.dealsOnly
              ? 'Slevy'
              : 'Najít podnik v Brně'}
        </h1>
        <p className="page-subtitle">
          {waitingForDistance
            ? 'Počítám pěší vzdálenost.'
            : dealsGate && !session.ready
              ? 'Ověřuji přihlášení…'
              : dealsGate
                ? `Ověřené ISIC nabídky zdarma po přihlášení — ${formatPlaceCount(filtered.length)}`
                : `Filtruj podle peněz, chuti a vzdálenosti — ${formatPlaceCount(filtered.length)}`}
        </p>
        {dealsGate && session.authenticated ? (
          <p className="location-bar-caption">
            Prohlížení je zdarma, body se neodečítají. Přihlášení do FoodGo nenahrazuje platný průkaz
            ISIC.
          </p>
        ) : null}
      </div>

      {dealsGate && !session.ready ? (
        <p className="page-subtitle" role="status">
          Načítám účet… Slevy zatím nezobrazujeme.
        </p>
      ) : null}

      {dealsGate && session.ready && session.unreachable ? (
        <p className="deal-warning" role="status">
          Přihlášení teď neodpovídá. Slevy zatím nelze otevřít. Zkus to za chvíli.
        </p>
      ) : null}

      {dealsGate && session.ready && !session.configured && !session.unreachable ? (
        <p className="deal-warning" role="status">
          Přihlášení teď není k dispozici. Slevy zatím nelze otevřít.
        </p>
      ) : null}

      {!dealsGate || (session.ready && session.authenticated) ? (
        <div className="results-layout">
          <aside className="results-controls" aria-label="Hledání a filtry">
            <CategoryStrip
              variant="grid"
              autoScroll={false}
              activeType={activeType}
              dealsActive={filters.dealsOnly}
              onSelect={(type) => {
                if (isDealsCategory(type)) {
                  if (!filters.dealsOnly && session.ready && !session.authenticated) {
                    navigate(dealsLogin)
                    return
                  }
                  updateFilters({ ...filters, dealsOnly: !filters.dealsOnly })
                  return
                }
                updateFilters(applyCategorySelection(filters, activeType === type ? '' : type))
              }}
            />

            <SearchBar
              value={filters.search}
              restaurants={restaurants}
              onChange={(search) => {
                const next = { ...filters, search }
                if (search.trim() && (filters.sortBy === '' || filters.sortBy === 'quality')) {
                  next.sortBy = 'relevance'
                }
                if (!search.trim() && filters.sortBy === 'relevance') next.sortBy = ''
                updateFilters(next, { history: 'replace' })
              }}
              onPick={(suggestion) => {
                if (suggestion.kind === 'restaurant') {
                  rememberRecentSearch(suggestion.label || suggestion.name || '')
                  navigate(`/restaurant/${suggestion.id}`)
                  return
                }
                if (suggestion.kind === 'category') {
                  rememberRecentSearch(suggestion.label || suggestion.id)
                  updateFilters({ ...filters, cuisineType: suggestion.id, search: '' })
                  return
                }
                const query = suggestion.query || suggestion.label
                rememberRecentSearch(query)
                updateFilters({
                  ...filters,
                  search: query,
                  sortBy: 'relevance',
                })
              }}
            />

            {intentNotes.length > 0 ? (
              <p className="location-bar-caption">
                Z hledání: {intentNotes.join(', ')}. Neznámá a odhadovaná cena se do limitu nepočítá.
              </p>
            ) : null}

            <LocationBar places={located} />
            {viewMode === 'map' && !origin ? <LocationPrompt /> : null}

            <ResultsFilters
              filters={filters}
              onChange={(next) => {
                if (next.dealsOnly && !filters.dealsOnly && session.ready && !session.authenticated) {
                  navigate(dealsLogin)
                  return
                }
                updateFilters(next)
              }}
              hasOrigin={Boolean(origin)}
              expanded={filtersExpanded}
              onExpandedChange={setFiltersExpanded}
            />

            {filtersActive ? (
              <div className="filter-chip-row">
                <ul className="filter-chips" aria-label="Aktivní filtry">
                  {chips.map((chip) => (
                    <li key={chip.key}>
                      <button
                        type="button"
                        className="filter-chip"
                        onClick={() => updateFilters({ ...filters, ...chip.clear })}
                      >
                        {chip.label}
                        <span aria-hidden="true">×</span>
                        <span className="visually-hidden">Zrušit</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn-secondary" onClick={clearAllFilters}>
                  Resetovat vše
                </button>
                {intentNotes.some((note) => note.includes('Kč')) ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      updateFilters({
                        ...filters,
                        search: searchWithoutIntent(filters.search, 'budget'),
                      })
                    }
                  >
                    Zrušit cenový limit z hledání
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>

          <section className="results-main" aria-label="Seznam podniků" ref={listTopRef}>
            <div className="results-view-toggle" role="group" aria-label="Zobrazení výsledků">
              <button
                type="button"
                className={`results-view-btn${viewMode === 'list' ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'list'}
                onClick={() => updateFilters({ ...filters, view: 'list' }, { resetPage: false })}
              >
                Seznam
              </button>
              <button
                type="button"
                className={`results-view-btn${viewMode === 'map' ? ' is-active' : ''}`}
                aria-pressed={viewMode === 'map'}
                onClick={() => updateFilters({ ...filters, view: 'map' }, { resetPage: false })}
              >
                Mapa
              </button>
            </div>

            {viewMode === 'map' ? (
              <div ref={mapSectionRef} className="results-map-anchor">
                <Suspense
                  fallback={
                    <div className="map-skeleton" aria-busy="true" aria-label="Načítám mapu">
                      <div className="map-skeleton-canvas" />
                      <p className="section-desc">Načítám mapu…</p>
                    </div>
                  }
                >
                  <RestaurantMap
                    restaurants={mapPlaces}
                    selectedId={mapSelectedId}
                    onSelect={setMapSelectedId}
                    userOrigin={origin}
                    locating={locationStatus === 'locating'}
                    locationError={locationError}
                    focusToken={mapFocusToken}
                    onReady={handleMapReady}
                    areaFilterActive={Boolean(mapBounds)}
                    onAreaSearch={setMapBounds}
                    onLocate={() => {
                      setMapFocusToken((token) => token + 1)
                      locate({ forceRefresh: Boolean(origin), highAccuracy: Boolean(origin) })
                    }}
                    onForget={forgetOrigin}
                  />
                </Suspense>
              </div>
            ) : (
              <>
                {sponsored.length > 0 ? (
                  <section aria-labelledby="sponsored-results-title">
                    <h2 id="sponsored-results-title" className="section-title">
                      {SPONSORED_LABEL}
                    </h2>
                    <p className="section-desc">
                      Placené umístění s označením Sponzorováno. Není to organické doporučení ani hodnocení
                      návštěvníků.
                    </p>
                    <ul className="restaurant-list">
                      {sponsored.map((restaurant, index) => (
                        <li key={restaurant.id}>
                          <RestaurantCard restaurant={restaurant} index={index} />
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {filtered.length === 0 && sponsored.length === 0 ? (
                  <div className="empty-state">
                    <p role={!catalogReady ? 'status' : undefined}>{emptyMessage}</p>
                    {catalogReady ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={clearAllFilters}
                      >
                        Resetovat filtry
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="results-summary">
                      <p>
                        Zobrazuji {paged.startIndex}–{paged.endIndex} z {paged.total}
                      </p>
                    </div>
                    <ul className={`restaurant-list${filters.dealsOnly ? ' restaurant-list--deals' : ''}`}>
                      {varyPixabayOnPage(paged.items).map((restaurant, index) => (
                        <li key={restaurant.id}>
                          <RestaurantCard
                            restaurant={restaurant}
                            index={index}
                            variant={filters.dealsOnly ? 'deal' : 'default'}
                          />
                        </li>
                      ))}
                    </ul>
                    <ResultsPager page={paged.page} totalPages={paged.totalPages} onChange={setPage} />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}
    </main>
  )
}
