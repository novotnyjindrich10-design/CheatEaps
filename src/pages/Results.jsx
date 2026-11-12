import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
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
import { parsePageParam, slicePage } from '../utils/pagination'
import { DEALS_RESULTS_PATH, loginPath } from '../utils/authReturn'
import { PUBLIC_V1 } from '../constants/publicV1'

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
  const { restaurants } = useCatalog()
  const { session } = useAuth()
  const filters = parseResultsSearchParams(searchParams)
  const activeType = getActiveCategoryKey(filters)
  const categoryMeta = getCategoryMeta(activeType)
  const theme = activeType || 'default'
  const rawType = searchParams.get('type') || ''
  const listTopRef = useRef(null)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const dealsGate = filters.dealsOnly
  const dealsLogin = loginPath(DEALS_RESULTS_PATH)

  const updateFilters = (next, { resetPage = true, history = 'push' } = {}) => {
    const params = buildResultsSearchParams(next)
    if (!resetPage) {
      const page = parsePageParam(searchParams.get('page'))
      if (page > 1) params.set('page', String(page))
    }
    setSearchParams(params, { replace: history === 'replace' })
  }

  useEffect(() => {
    if (!rawType || isDealsCategory(rawType)) return
    const normalized = normalizeCategoryParam(rawType)
    if (normalized === rawType) return
    const params = buildResultsSearchParams({ ...filters, cuisineType: normalized })
    const page = parsePageParam(searchParams.get('page'))
    if (page > 1) params.set('page', String(page))
    setSearchParams(params, { replace: true })
  }, [filters, rawType, searchParams, setSearchParams])

  const { attachDistances, origin, routeStatus } = useLocationState()
  const located = useMemo(() => attachDistances(restaurants), [attachDistances, restaurants])
  const matched = useMemo(
    () =>
      filterAndSortRestaurants(located, {
        ...parseResultsSearchParams(searchParams),
        hasOrigin: Boolean(origin),
      }),
    [located, searchParams, origin],
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

  let emptyMessage = 'Žádný podnik neodpovídá filtrům. Zkus uvolnit rozpočet, vzdálenost nebo hledání.'
  if (waitingForDistance) {
    emptyMessage = 'Počítám pěší vzdálenost. Filtr vzdálenosti se použije, až budou čísla známá.'
  } else if (distanceUnavailable) {
    emptyMessage =
      'Pěší vzdálenost se teď nepodařilo zjistit. Zkus polohu aktualizovat, nebo filtr vzdálenosti vypni.'
  } else if (filters.dealsOnly && filtered.length === 0) {
    emptyMessage = DEALS_EMPTY_MESSAGE
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
    listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  if (filters.sortBy) {
    chips.push({
      key: 'sort',
      label: optionLabel(sortOptionsForOrigin(Boolean(origin)), filters.sortBy),
      clear: { sortBy: '' },
    })
  }
  const filtersActive = chips.length > 0
  const viewMode = filters.view === 'map' ? 'map' : 'list'

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
                  navigate(`/restaurant/${suggestion.id}`)
                  return
                }
                if (suggestion.kind === 'category') {
                  updateFilters({ ...filters, cuisineType: suggestion.id, search: '' })
                  return
                }
                updateFilters({
                  ...filters,
                  search: suggestion.query || suggestion.label,
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
                <button type="button" className="btn btn-secondary" onClick={() => setSearchParams({})}>
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
              <Suspense fallback={<p className="section-desc">Načítám mapu…</p>}>
                <RestaurantMap restaurants={mapPlaces} />
              </Suspense>
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
                    <p>{emptyMessage}</p>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSearchParams({})}
                    >
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
