import {
  BUDGET_OPTIONS,
  CUISINE_OPTIONS,
  DISTANCE_OPTIONS,
  SORT_OPTIONS,
  applyCategorySelection,
  getActiveCategoryKey,
} from '../constants/filters'

function optionsIncluding(options, value, label) {
  if (!value || options.some((opt) => opt.value === value)) return options
  return [...options, { value, label }]
}

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
          label="Max. ověřená cena"
          value={filters.maxBudget}
          onChange={set('maxBudget')}
          options={optionsIncluding(BUDGET_OPTIONS, filters.maxBudget, `Do ${filters.maxBudget} Kč`)}
        />
        <FilterSelect
          id="filter-type"
          label="Typ jídla"
          value={getActiveCategoryKey(filters)}
          onChange={(e) => onChange(applyCategorySelection(filters, e.target.value))}
          options={optionsIncluding(CUISINE_OPTIONS, getActiveCategoryKey(filters), 'Neznámá kategorie')}
        />
        <FilterSelect
          id="filter-distance"
          label="Max. vzdálenost"
          value={filters.maxDistance}
          onChange={set('maxDistance')}
          options={optionsIncluding(DISTANCE_OPTIONS, filters.maxDistance, `Do ${filters.maxDistance} km`)}
        />
        <FilterSelect
          id="filter-sort"
          label="Řazení"
          value={filters.sortBy}
          onChange={set('sortBy')}
          options={SORT_OPTIONS}
        />
      </div>
      {filters.maxBudget ? (
        <p className="location-bar-caption">
          Do limitu se počítá ověřená cena z menu. U rozpětí musí být do limitu i horní mez. Odhad se do rozpočtu nepočítá.
        </p>
      ) : null}
      {filters.vegetarianOnly || filters.veganOnly ? (
        <p className="location-bar-caption">
          Filtr hledá podniky, které takové jídlo nabízejí. Kategorie Bez masa a Vegan jsou ty, které se na tu kuchyni zaměřují.
        </p>
      ) : null}
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
          label="Pouze s veganskými jídly"
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
        <FilterToggle
          id="filter-deals"
          label="Jen se slevou nebo výhodou"
          checked={filters.dealsOnly}
          onChange={(e) => onChange({ ...filters, dealsOnly: e.target.checked })}
        />
      </div>
      {filters.dealsOnly ? (
        <p className="location-bar-caption">
          Berou se jen nabídky, které zdroj k datu kontroly uváděl. Běžné menu ani odhad ceny sleva nejsou.
        </p>
      ) : null}
    </section>
  )
}
