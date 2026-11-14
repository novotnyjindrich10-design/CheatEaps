import {
  BUDGET_OPTIONS,
  DISTANCE_OPTIONS,
  FOOD_CATEGORIES,
  PRICE_SORT_NOTE,
  applyCategorySelection,
  sortOptionsForOrigin,
} from '../constants/filters'
import { wantsDistanceSort } from '../utils/filterRestaurants'

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

function hiddenActiveCount(filters) {
  return [
    filters.maxBudget,
    filters.maxDistance,
    filters.vegetarianOnly,
    filters.veganOnly,
    filters.verifiedPricesOnly,
    filters.dealsOnly,
    filters.hoursOnly,
  ].filter(Boolean).length
}

function hiddenActiveLabel(count) {
  if (count === 1) return '1 aktivní filtr'
  if (count >= 2 && count <= 4) return `${count} aktivní filtry`
  return `${count} aktivních filtrů`
}

function FilterIcon() {
  return (
    <svg className="filters-reveal-icon" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M3.2 4.5h13.6L11.2 10.8v4.1l-2.4 1.2v-5.3L3.2 4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronIcon({ className = 'filters-reveal-chevron' }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ResultsFilters({
  filters,
  onChange,
  hasOrigin = false,
  expanded = false,
  onExpandedChange,
}) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value })
  const activeHidden = hiddenActiveCount(filters)
  const activeCategory = filters.cuisineType || ''
  const toggle = () => onExpandedChange?.(!expanded)
  const sortOptions = sortOptionsForOrigin(hasOrigin)
  const needsLocationForDistance =
    !hasOrigin && (wantsDistanceSort(filters.sortBy) || Boolean(filters.maxDistance))

  return (
    <section className={`results-filters${expanded ? '' : ' is-collapsed'}`} aria-label="Filtry výsledků">
      <div className="filters-toolbar">
        <FilterSelect
          id="filter-sort"
          label="Řazení"
          value={filters.sortBy}
          onChange={set('sortBy')}
          options={optionsIncluding(sortOptions, filters.sortBy, 'Nejblíž ke mně')}
        />
        <button
          type="button"
          className="filters-reveal"
          aria-expanded={expanded}
          aria-controls="results-filters-extra"
          onClick={toggle}
        >
          <FilterIcon />
          <span className="filters-reveal-label">{expanded ? 'Skrýt filtry' : 'Zobrazit všechny filtry'}</span>
          {!expanded && activeHidden > 0 ? (
            <span className="filters-reveal-count">
              <span aria-hidden="true">{activeHidden}</span>
              <span className="visually-hidden">{hiddenActiveLabel(activeHidden)}</span>
            </span>
          ) : null}
          <ChevronIcon />
        </button>
      </div>

      {needsLocationForDistance ? (
        <p className="location-bar-caption filters-note">
          Výchozí řazení je podle vzdálenosti. Zapni polohu tlačítkem výše, nebo zadej místo — do té doby řadíme
          abecedně a vzdálenost nezobrazujeme.
        </p>
      ) : null}

      {filters.sortBy === 'price-asc' || filters.sortBy === 'price-desc' ? (
        <p className="location-bar-caption filters-note">{PRICE_SORT_NOTE}</p>
      ) : null}

      <div
        id="results-filters-extra"
        className={`filters-extra${expanded ? ' is-open' : ''}`}
        inert={expanded ? undefined : true}
      >
        <div className="filters-extra-inner">
          <div className="filters-extra-content">
            <div className="filters-category-picker" role="group" aria-label="Kategorie jídel">
              <p className="filter-label" id="filters-category-heading">
                Kategorie
              </p>
              <ul className="filters-category-list" aria-labelledby="filters-category-heading">
                <li>
                  <button
                    type="button"
                    className={`category-pill filters-category-pill${!activeCategory ? ' is-active' : ''}`}
                    aria-pressed={!activeCategory}
                    onClick={() => onChange(applyCategorySelection(filters, ''))}
                  >
                    Všechny podniky
                  </button>
                </li>
                {FOOD_CATEGORIES.map((category) => {
                  const active = activeCategory === category.value
                  return (
                    <li key={category.value}>
                      <button
                        type="button"
                        className={`category-pill filters-category-pill${active ? ' is-active' : ''}`}
                        aria-pressed={active}
                        onClick={() =>
                          onChange(applyCategorySelection(filters, active ? '' : category.value))
                        }
                      >
                        <span className="category-pill-emoji" aria-hidden="true">
                          {category.emoji}
                        </span>
                        {category.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="filters-grid">
              <FilterSelect
                id="filter-budget"
                label="Max. ověřená cena"
                value={filters.maxBudget}
                onChange={set('maxBudget')}
                options={optionsIncluding(BUDGET_OPTIONS, filters.maxBudget, `Do ${filters.maxBudget} Kč`)}
              />
              <FilterSelect
                id="filter-distance"
                label="Max. vzdálenost"
                value={filters.maxDistance}
                onChange={set('maxDistance')}
                options={optionsIncluding(DISTANCE_OPTIONS, filters.maxDistance, `Do ${filters.maxDistance} km`)}
              />
            </div>
            {filters.maxBudget ? (
              <p className="location-bar-caption filters-note">
                Do limitu se počítá ověřená cena z menu (ne odhad). U rozpětí musí být do limitu i horní mez. Ověřenou
                cenu má zatím jen část katalogu — bez limitu uvidíš i podniky s odhadem.
              </p>
            ) : null}
            {filters.vegetarianOnly || filters.veganOnly ? (
              <p className="location-bar-caption filters-note">
                Filtr hledá podniky, které takové jídlo nabízejí. Kategorie Bez masa a Vegan jsou ty, které se na tu
                kuchyni zaměřují.
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
                label="Jen ověřené slevy"
                checked={filters.dealsOnly}
                onChange={(e) => onChange({ ...filters, dealsOnly: e.target.checked })}
              />
              <FilterToggle
                id="filter-hours"
                label="Jen s uvedenou otevírací dobou"
                checked={Boolean(filters.hoursOnly)}
                onChange={(e) => onChange({ ...filters, hoursOnly: e.target.checked })}
              />
            </div>
            {filters.hoursOnly ? (
              <p className="location-bar-caption filters-note">
                Bereme jen čitelnou otevírací dobu z OpenStreetMap. Stav Otevřeno/Zavřeno ukazujeme jen u jednoduchých zápisů.
              </p>
            ) : null}
            {filters.dealsOnly ? (
              <p className="location-bar-caption filters-note">
                Jen ověřené akce s důvěryhodným zdrojem a platností. Běžné menu ani odhad ceny sleva nejsou.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

export function FiltersAllButton({ expanded = false, onExpandedChange }) {
  return (
    <button
      type="button"
      className="filters-all-btn"
      aria-expanded={expanded}
      aria-controls="results-filters-extra"
      onClick={() => onExpandedChange?.(!expanded)}
    >
      <svg className="filters-all-icon" width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="5.5" height="5.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11.5" y="3" width="5.5" height="5.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="11.5" width="5.5" height="5.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span>Vše</span>
      <ChevronIcon className="filters-all-chevron" />
    </button>
  )
}
