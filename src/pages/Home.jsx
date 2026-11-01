import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { QUICK_BUDGETS } from '../constants/filters'
import CategoryStrip from '../components/CategoryStrip'
import LocationBar from '../components/LocationBar'
import RestaurantCard from '../components/RestaurantCard'
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { compareByRecordQuality } from '../utils/recordQuality'

const RECOMMENDED_COUNT = 20

/** Různé kategorie. V každé je první nejlíp zdokumentovaný podnik. */
function pickRecommended(places, limit = RECOMMENDED_COUNT) {
  const byCategory = new Map()
  for (const place of places) {
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

export default function Home() {
  const { restaurants } = useCatalog()
  const { attachDistances } = useLocationState()
  const recommended = useMemo(() => pickRecommended(restaurants), [restaurants])
  const featured = attachDistances(recommended)

  return (
    <main className="page home-page">
      <section className="home-hero">
        <p className="home-hero-kicker">Jídlo za jakoukoliv cenu</p>
        <h1 className="home-hero-title">
          <span className="home-hero-line">Na co máš</span>{' '}
          <span className="home-hero-line home-hero-accent">chuť?</span>
        </h1>
        <span className="home-hero-mark" aria-hidden="true" />
        <LocationBar places={restaurants} variant="hero" />
        <CategoryStrip asLinks />
      </section>

      <section className="home-listings" aria-labelledby="recommended-title">
        <div className="section-heading">
          <h2 id="recommended-title" className="section-title">
            Doporučené podniky
          </h2>
          <p className="section-desc">
            Nejlíp zdokumentované podniky z různých kuchyní.{' '}
            <Link to="/results">Zobrazit celý seznam</Link>
          </p>
        </div>

        <ul className="restaurant-list">
          {featured.map((restaurant, index) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant} index={index} />
            </li>
          ))}
        </ul>
      </section>

      <section className="budget-quick" aria-labelledby="budget-quick-title">
        <h2 id="budget-quick-title" className="section-title">
          Nebo podle rozpočtu
        </h2>
        <p className="section-desc">
          Klikni a uvidíš podniky, jejichž ověřená cena (u rozpětí i horní mez) se vejde do limitu.
        </p>
        <div className="budget-chips">
          {QUICK_BUDGETS.map((amount) => (
            <Link key={amount} to={`/results?budget=${amount}`} className="budget-chip">
              Do {amount} Kč
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
