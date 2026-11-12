import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RestaurantCard from '../components/RestaurantCard'
import { BUDGET_OPTIONS, FOOD_CATEGORIES, normalizeCategoryParam } from '../constants/filters'
import { SPONSORED_LABEL } from '../constants/monetization'
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { pickSurpriseRestaurant } from '../utils/surprisePick'
import { varyPixabayOnPage } from '../utils/pageIllustrations'

export default function SurpriseMe() {
  const { restaurants } = useCatalog()
  const { attachDistances, origin, locate, status, errorMessage } = useLocationState()
  const [maxBudget, setMaxBudget] = useState('')
  const [cuisineType, setCuisineType] = useState('')
  const [useDistance, setUseDistance] = useState(false)
  const [maxDistance, setMaxDistance] = useState('2')
  const [pick, setPick] = useState(null)
  const [spinning, setSpinning] = useState(false)

  const located = useMemo(() => attachDistances(restaurants), [attachDistances, restaurants])

  const filters = useMemo(
    () => ({
      maxBudget,
      cuisineType: normalizeCategoryParam(cuisineType) || '',
      maxDistance: useDistance && origin ? maxDistance : '',
      hasOrigin: Boolean(origin),
      sortBy: 'name',
    }),
    [maxBudget, cuisineType, useDistance, maxDistance, origin],
  )

  const runPick = () => {
    const reduced =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPick(pickSurpriseRestaurant(located, filters))
      return
    }
    setSpinning(true)
    window.setTimeout(() => {
      setPick(pickSurpriseRestaurant(located, filters))
      setSpinning(false)
    }, 420)
  }

  const restaurant = pick?.restaurant
  const card = restaurant ? varyPixabayOnPage([restaurant])[0] : null

  return (
    <main className="page surprise-page">
      <div className="page-head">
        <Link to="/" className="back-link">
          ← Domů
        </Link>
        <h1>Nevím, co jíst</h1>
        <p className="page-subtitle">
          Nastav limity a nech FoodGo vybrat náhodný podnik z odpovídajících výsledků. Žádné falešné
          údaje.
        </p>
      </div>

      <form
        className="surprise-form"
        onSubmit={(event) => {
          event.preventDefault()
          runPick()
        }}
      >
        <label className="field">
          <span className="field-label">Maximální cena</span>
          <select value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)}>
            <option value="">Bez limitu</option>
            {BUDGET_OPTIONS.filter((opt) => opt.value).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Kategorie</span>
          <select value={cuisineType} onChange={(e) => setCuisineType(e.target.value)}>
            <option value="">Jakákoliv</option>
            {FOOD_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="surprise-distance">
          <legend>Vzdálenost</legend>
          <label className="check-row">
            <input
              type="checkbox"
              checked={useDistance}
              onChange={(e) => setUseDistance(e.target.checked)}
            />
            Jen v okolí (vyžaduje polohu)
          </label>
          {useDistance ? (
            <>
              <label className="field">
                <span className="field-label">Do vzdálenosti</span>
                <select value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)}>
                  <option value="1">1 km</option>
                  <option value="2">2 km</option>
                  <option value="5">5 km</option>
                </select>
              </label>
              {!origin ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => locate()}
                  disabled={status === 'locating'}
                >
                  {status === 'locating' ? 'Zjišťuji polohu…' : 'Použít moji polohu'}
                </button>
              ) : (
                <p className="location-bar-caption">Poloha je aktivní. Vzdálenost bereme z dostupných údajů.</p>
              )}
              {errorMessage ? (
                <p className="deal-warning" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </>
          ) : null}
        </fieldset>

        <div className="surprise-actions">
          <button type="submit" className="btn btn-primary" disabled={spinning}>
            {spinning ? 'Hledám…' : restaurant ? 'Vybrat znovu' : 'Překvap mě'}
          </button>
          {restaurant ? (
            <Link className="btn btn-secondary" to={`/restaurant/${restaurant.id}`}>
              Otevřít detail
            </Link>
          ) : null}
        </div>
      </form>

      <div className={`surprise-result${spinning ? ' is-spinning' : ''}`} aria-live="polite">
        {pick && !restaurant ? (
          <p className="empty-state">Žádný podnik neodpovídá nastavení. Uvolni cenu, kategorii nebo vzdálenost.</p>
        ) : null}
        {card ? (
          <>
            {card.sponsored || card.placement === 'sponsored' ? (
              <p className="sponsored-badge" role="status">
                {SPONSORED_LABEL} — náhodný výběr ho nijak nepreferuje, ale může padnout stejně jako ostatní.
              </p>
            ) : null}
            <p className="location-bar-caption">
              Náhodný výběr z {pick.poolSize} {pick.poolSize === 1 ? 'podniku' : 'podniků'}.
            </p>
            <RestaurantCard restaurant={card} />
          </>
        ) : null}
      </div>
    </main>
  )
}
