import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { restaurants } from '../data/restaurants'
import RestaurantCard from '../components/RestaurantCard'
import SearchBar from '../components/SearchBar'
import ResultsFilters from '../components/ResultsFilters'
import CategoryStrip from '../components/CategoryStrip'
import CategoryDecorations from '../components/CategoryDecorations'
import {
  applyCategorySelection,
  getActiveCategoryKey,
  getCategoryMeta,
} from '../constants/filters'
import {
  filterAndSortRestaurants,
  parseResultsSearchParams,
  buildResultsSearchParams,
} from '../utils/filterRestaurants'
import { useLocationState } from '../context/LocationContext'
import LocationBar from '../components/LocationBar'

function formatPlaceCount(n) {
  if (n === 1) return '1 místo'
  if (n >= 2 && n <= 4) return `${n} místa`
  return `${n} míst`
}

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseResultsSearchParams(searchParams)
  const activeType = getActiveCategoryKey(filters)
  const categoryMeta = getCategoryMeta(activeType)
  const theme = activeType || 'default'

  const updateFilters = (next) => {
    const params = buildResultsSearchParams(next)
    setSearchParams(params, { replace: true })
  }

  const { attachDistances, origin } = useLocationState()
  const located = useMemo(() => attachDistances(restaurants), [attachDistances])
  const filtered = useMemo(
    () =>
      filterAndSortRestaurants(located, {
        ...parseResultsSearchParams(searchParams),
        hasOrigin: Boolean(origin),
      }),
    [located, searchParams, origin],
  )

  return (
    <main className={`page results-page theme-${theme}`}>
      <CategoryDecorations theme={theme} />

      <div className="page-head">
        <Link to="/" className="back-link">
          ← Domů
        </Link>
        <h1>{categoryMeta ? categoryMeta.label : 'Na co máš chuť?'}</h1>
        <p className="page-subtitle">
          Filtruj podle peněz, chuti a vzdálenosti – {formatPlaceCount(filtered.length)}
        </p>
      </div>

      <CategoryStrip
        activeType={activeType}
        onSelect={(type) => updateFilters(applyCategorySelection(filters, type))}
      />

      <SearchBar
        value={filters.search}
        onChange={(search) => updateFilters({ ...filters, search })}
      />

      <LocationBar places={located} />

      <ResultsFilters filters={filters} onChange={updateFilters} hasOrigin={Boolean(origin)} />

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Žádný podnik neodpovídá filtrům. Zkus uvolnit rozpočet nebo vzdálenost.</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSearchParams({}, { replace: true })}
          >
            Resetovat filtry
          </button>
        </div>
      ) : (
        <ul className="restaurant-list">
          {filtered.map((restaurant, index) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant} index={index} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
