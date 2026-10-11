import {
  BUDGET_OPTIONS,
  CUISINE_OPTIONS,
  DISTANCE_OPTIONS,
  SORT_OPTIONS,
  applyCategorySelection,
  getActiveCategoryKey,
} from '../constants/filters'

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <label className="filter-field">
      <span className="filter-label">{label}</span>
      <select id={id} className="filter-select" value={value} onChange={onChange}>
        {options.map((opt) => (
          <option key={opt.value || 'all'} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function FilterToggle({ id, label, checked, onChange }) {
  return (
    <label className="filter-toggle" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <span className="filter-toggle-ui" aria-hidden="true" />
      <span>{label}</span>
    </label>
  )
}

export default function ResultsFilters({ filters, onChange, hasOrigin = false }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value })

  return (
    <section className="results-filters" aria-label="Filtry výsledků">
      <div className="filters-grid">
        <FilterSelect
          id="filter-budget"
          label="Max. cena"
          value={filters.maxBudget}
          onChange={set('maxBudget')}
          options={BUDGET_OPTIONS}
        />
        <FilterSelect
          id="filter-type"
          label="Typ jídla"
          value={getActiveCategoryKey(filters)}
          onChange={(e) => onChange(applyCategorySelection(filters, e.target.value))}
          options={CUISINE_OPTIONS}
        />
        <FilterSelect
          id="filter-distance"
          label="Max. vzdálenost"
          value={filters.maxDistance}
          onChange={set('maxDistance')}
          options={DISTANCE_OPTIONS}
        />
        <FilterSelect
          id="filter-sort"
          label="Řazení"
          value={filters.sortBy}
          onChange={set('sortBy')}
          options={SORT_OPTIONS}
        />
      </div>
      {!hasOrigin && (filters.sortBy === 'distance' || filters.maxDistance) ? (
        <p className="location-bar-caption">
          Řazení a filtr vzdálenosti potřebují zapnutou polohu nebo zadané místo. Do té doby se seznam neomezuje.
        </p>
      ) : null}

      <div className="filters-toggles">
        <FilterToggle
          id="filter-vegetarian"
          label="Pouze vegetariánsky vhodné"
          checked={filters.vegetarianOnly}
          onChange={(e) =>
            onChange({
              ...filters,
              vegetarianOnly: e.target.checked,
              veganOnly: e.target.checked ? false : filters.veganOnly,
            })
          }
        />
        <FilterToggle
          id="filter-vegan"
          label="Pouze veganské"
          checked={filters.veganOnly}
          onChange={(e) =>
            onChange({
              ...filters,
              veganOnly: e.target.checked,
              // Vegan je podmnožina vegetariánského filtru – v URL držíme jen přísnější vegan.
              vegetarianOnly: e.target.checked ? false : filters.vegetarianOnly,
            })
          }
        />
        <FilterToggle
          id="filter-verified-price"
          label="Jen ověřené ceny"
          checked={filters.verifiedPricesOnly}
          onChange={(e) => onChange({ ...filters, verifiedPricesOnly: e.target.checked })}
        />
      </div>
    </section>
  )
}
