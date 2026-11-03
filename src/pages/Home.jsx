import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { QUICK_BUDGETS } from '../constants/filters'
import CategoryStrip from '../components/CategoryStrip'
import HomeSearch from '../components/HomeSearch'
import LocationBar from '../components/LocationBar'
import RestaurantCard from '../components/RestaurantCard'
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { compareByRecordQuality } from '../utils/recordQuality'
import { suppressCatalogDuplicates } from '../utils/catalogDuplicates'
import { varyPixabayOnPage } from '../utils/pageIllustrations'

const RECOMMENDED_COUNT = 12

/** Různé kategorie. V každé je první nejlíp zdokumentovaný podnik. */
function pickRecommended(places, limit = RECOMMENDED_COUNT) {
  const byCategory = new Map()
  for (const place of suppressCatalogDuplicates(places)) {
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
  const featured = varyPixabayOnPage(attachDistances(recommended))

  return (
    <main className="page home-page">
      <section className="home-hero">
        <div className="home-hero-panel">
          <h1 className="home-hero-title">
            <span className="home-hero-line">Najdi jídlo</span>{' '}
            <span className="home-hero-line home-hero-accent">v Brně</span>
          </h1>
          <HomeSearch />
          <LocationBar places={restaurants} variant="hero" />
        </div>
      </section>

      <section className="home-discover" aria-labelledby="discover-title">
        <div className="section-heading">
          <h2 id="discover-title" className="section-title">
            Objevuj podle chuti
          </h2>
        </div>
        <CategoryStrip asLinks variant="grid" />
      </section>

      <section className="home-listings" aria-labelledby="recommended-title">
        <div className="section-heading section-heading--split">
          <div>
            <h2 id="recommended-title" className="section-title">
              Doporučené podniky
            </h2>
            <p className="section-desc">Nejlíp zdokumentované podniky z různých kuchyní.</p>
          </div>
          <Link to="/results" className="btn btn-secondary">
            Celý seznam
          </Link>
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
        <div className="budget-quick-panel">
          <h2 id="budget-quick-title" className="section-title">
            Podle rozpočtu
          </h2>
          <p className="section-desc">
            Filtr bere jen ověřenou cenu z menu. U rozpětí musí do limitu vejít i horní mez.
          </p>
          <div className="budget-chips">
            {QUICK_BUDGETS.map((amount) => (
              <Link key={amount} to={`/results?budget=${amount}`} className="budget-chip">
                Do {amount} Kč
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-paths" aria-labelledby="paths-title">
        <div className="section-heading">
          <h2 id="paths-title" className="section-title">
            Kam dál
          </h2>
          <p className="section-desc">Rychlé cesty k tomu, co CheapEats umí hned teď.</p>
        </div>
        <div className="home-path-grid">
          <Link to="/results?verified=1" className="home-path-card">
            <h3>Ověřené ceny</h3>
            <p>Jen podniky s doloženou cenou z menu.</p>
          </Link>
          <Link to="/results?deals=1" className="home-path-card">
            <h3>Slevy a výhody</h3>
            <p>Nabídky, které jsme našli u oficiálních zdrojů.</p>
          </Link>
          <Link to="/oblibene" className="home-path-card">
            <h3>Oblíbené</h3>
            <p>Ulož si podniky po přihlášení a vrať se k nim později.</p>
          </Link>
          <Link to="/pro-podniky" className="home-path-card">
            <h3>Pro podniky</h3>
            <p>Pošli žádost o přidání provozovny do katalogu.</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
