import { useEffect, useMemo, useRef } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import RestaurantCard from '../components/RestaurantCard'
import SearchBar from '../components/SearchBar'
import ResultsFilters from '../components/ResultsFilters'
import ResultsPager from '../components/ResultsPager'
import CategoryStrip from '../components/CategoryStrip'
import CategoryDecorations from '../components/CategoryDecorations'
import {
  BUDGET_OPTIONS,
  DISTANCE_OPTIONS,
  SORT_OPTIONS,
  applyCategorySelection,
  getActiveCategoryKey,
  getCategoryMeta,
  isLoyaltyCategory,
  normalizeCategoryParam,
} from '../constants/filters'
import {
  filterAndSortRestaurants,
  parseResultsSearchParams,
  buildResultsSearchParams,
} from '../utils/filterRestaurants'
import { describeSearchIntent, searchWithoutIntent } from '../utils/smartSearch'
import { useCatalog } from '../context/CatalogContext'
import { varyPixabayOnPage } from '../utils/pageIllustrations'
import { useLocationState } from '../context/LocationContext'
import LocationBar from '../components/LocationBar'
import { parsePageParam, slicePage } from '../utils/pagination'

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
  const filters = parseResultsSearchParams(searchParams)
  const activeType = getActiveCategoryKey(filters)
  const categoryMeta = getCategoryMeta(activeType)
  const theme = activeType || 'default'
  const goToRewards = isLoyaltyCategory(activeType) || isLoyaltyCategory(searchParams.get('type') || '')
  const listTopRef = useRef(null)

  const updateFilters = (next, { resetPage = true, history = 'push' } = {}) => {
    const params = buildResultsSearchParams(next)
    if (!resetPage) {
      const page = parsePageParam(searchParams.get('page'))
      if (page > 1) params.set('page', String(page))
    }
    setSearchParams(params, { replace: history === 'replace' })
  }

  useEffect(() => {
    const raw = searchParams.get('type') || ''
    if (!raw || isLoyaltyCategory(raw)) return
    const normalized = normalizeCategoryParam(raw)
    if (normalized === raw) return
    const params = buildResultsSearchParams({ ...filters, cuisineType: normalized })
    const page = parsePageParam(searchParams.get('page'))
    if (page > 1) params.set('page', String(page))
    setSearchParams(params, { replace: true })
  }, [filters, searchParams, setSearchParams])

  const { attachDistances, origin, routeStatus } = useLocationState()
  const located = useMemo(() => attachDistances(restaurants), [attachDistances, restaurants])
  const filtered = useMemo(
    () =>
      filterAndSortRestaurants(located, {
        ...parseResultsSearchParams(searchParams),
        hasOrigin: Boolean(origin),
      }),
    [located, searchParams, origin],
  )

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

  let emptyMessage = 'Žádný podnik neodpovídá filtrům. Zkus uvolnit rozpočet, vzdálenost nebo hledání.'
  if (waitingForDistance) {
    emptyMessage = 'Počítám pěší vzdálenost. Filtr vzdálenosti se použije, až budou čísla známá.'
  } else if (distanceUnavailable) {
    emptyMessage =
      'Pěší vzdálenost se teď nepodařilo zjistit. Zkus polohu aktualizovat, nebo filtr vzdálenosti vypni.'
  }

  if (goToRewards) return <Navigate to="/odmeny" replace />

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
  if (filters.dealsOnly) chips.push({ key: 'deals', label: 'Sleva nebo výhoda', clear: { dealsOnly: false } })
  if (filters.hoursOnly) chips.push({ key: 'hours', label: 'S otevírací dobou', clear: { hoursOnly: false } })
  if (filters.sortBy && filters.sortBy !== 'quality') {
    chips.push({
      key: 'sort',
      label: optionLabel(SORT_OPTIONS, filters.sortBy),
      clear: { sortBy: 'quality' },
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
        <h1>{categoryMeta ? categoryMeta.label : 'Najít jídlo v Brně'}</h1>
        <p className="page-subtitle">
          {waitingForDistance
            ? 'Počítám pěší vzdálenost.'
            : `Filtruj podle peněz, chuti a vzdálenosti — ${formatPlaceCount(filtered.length)}`}
        </p>
      </div>

      <div className="results-layout">
        <aside className="results-controls" aria-label="Hledání a filtry">
          <CategoryStrip
            activeType={activeType}
            onSelect={(type) => updateFilters(applyCategorySelection(filters, type))}
          />

          <SearchBar
            value={filters.search}
            restaurants={restaurants}
            onChange={(search) => {
              const next = { ...filters, search }
              if (search.trim() && filters.sortBy === 'quality') next.sortBy = 'relevance'
              if (!search.trim() && filters.sortBy === 'relevance') next.sortBy = 'quality'
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
            onChange={(next) => updateFilters(next)}
            hasOrigin={Boolean(origin)}
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
          {filtered.length === 0 ? (
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
              <ul className="restaurant-list">
                {varyPixabayOnPage(paged.items).map((restaurant, index) => (
                  <li key={restaurant.id}>
                    <RestaurantCard restaurant={restaurant} index={index} />
                  </li>
                ))}
              </ul>
              <ResultsPager page={paged.page} totalPages={paged.totalPages} onChange={setPage} />
            </>
          )}
        </section>
      </div>
    </main>
  )
}
