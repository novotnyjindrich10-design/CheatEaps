import { Link } from 'react-router-dom'
import { QUICK_BUDGETS } from '../constants/filters'
import { restaurants } from '../data/restaurants'
import CategoryStrip from '../components/CategoryStrip'
import LocationBar from '../components/LocationBar'
import RestaurantCard from '../components/RestaurantCard'
import { useLocationState } from '../context/LocationContext'

export default function Home() {
  const { attachDistances } = useLocationState()
  const featured = attachDistances(restaurants.filter((r) => r.curated))

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

      <section className="budget-quick" aria-labelledby="budget-quick-title">
        <h2 id="budget-quick-title" className="section-title">
          Nebo podle rozpočtu
        </h2>
        <p className="section-desc">Klikni a rovnou uvidíš podniky ve tvé cenové relaci.</p>
        <div className="budget-chips">
          {QUICK_BUDGETS.map((amount) => (
            <Link key={amount} to={`/results?budget=${amount}`} className="budget-chip">
              Do {amount} Kč
            </Link>
          ))}
        </div>
      </section>

      <section className="home-listings" aria-labelledby="listings-title">
        <div className="section-heading">
          <h2 id="listings-title" className="section-title">
            Kam vyrazit
          </h2>
          <p className="section-desc">
            {restaurants.length} míst v Brně s ověřitelným názvem a adresou. Níže je výběr
            doplněný z oficiálních webů.{' '}
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
    </main>
  )
}
