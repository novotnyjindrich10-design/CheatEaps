import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { QUICK_BUDGETS } from '../constants/filters'
import CategoryStrip from '../components/CategoryStrip'
import HomeSearch from '../components/HomeSearch'
import LocationBar from '../components/LocationBar'
import RestaurantCard from '../components/RestaurantCard'
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { partitionPlacements } from '../constants/monetization'
import { compareByRecordQuality } from '../utils/recordQuality'
import { suppressCatalogDuplicates } from '../utils/catalogDuplicates'
import { filterAndSortRestaurants } from '../utils/filterRestaurants'
import { varyPixabayOnPage } from '../utils/pageIllustrations'
import { mealPeriodForHour } from '../utils/mealPeriod'
import { listRecentViews } from '../utils/recentViews'
import { getRestaurantById } from '../data/restaurants'
import { presentOsmContact } from '../utils/osmContact'
import { isOpenNowReliable } from '../utils/openingStatus'

const FEATURED_COUNT = 12

/** Bez polohy: různé kategorie, v každé nejlíp zdokumentovaný podnik. */
function pickRecommended(places, limit = FEATURED_COUNT) {
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

function pickNearest(places, limit = FEATURED_COUNT) {
  return filterAndSortRestaurants(places, {
    hasOrigin: true,
    sortBy: 'distance',
  }).slice(0, limit)
}

function preferOpenPlaces(places) {
  const open = []
  const rest = []
  for (const place of places) {
    const hoursRaw = presentOsmContact(place).hoursRaw
    if (hoursRaw && isOpenNowReliable(hoursRaw)) open.push(place)
    else rest.push(place)
  }
  return [...open, ...rest]
}

export default function Home() {
  const { restaurants } = useCatalog()
  const { attachDistances, origin } = useLocationState()
  const hasOrigin = Boolean(origin)
  const period = useMemo(() => mealPeriodForHour(new Date().getHours()), [])
  const organic = useMemo(() => partitionPlacements(restaurants).organic, [restaurants])
  const located = useMemo(() => attachDistances(organic), [attachDistances, organic])
  const featured = useMemo(() => {
    let pool = located
    if (period.category) {
      const narrowed = filterAndSortRestaurants(located, {
        cuisineType: period.category,
        hasOrigin,
        sortBy: hasOrigin ? 'distance' : 'quality',
      })
      if (narrowed.length >= 4) pool = narrowed
    }
    let picked = hasOrigin ? pickNearest(pool) : pickRecommended(pool)
    if (period.preferOpen) picked = preferOpenPlaces(picked).slice(0, FEATURED_COUNT)
    return varyPixabayOnPage(picked)
  }, [hasOrigin, located, period])

  const recentPlaces = useMemo(() => {
    return listRecentViews()
      .map((id) => getRestaurantById(id))
      .filter(Boolean)
      .slice(0, 4)
  }, [])

  const sectionTitle = hasOrigin ? 'Nejbližší podniky' : period.title
  const sectionDesc = hasOrigin
    ? 'Seřazeno od nejbližšího podle tvé polohy. Vzdálenost ukazujeme jen u podniků se souřadnicemi.'
    : period.hint

  return (
    <main className="page home-page">
      <section className="home-hero">
        <div className="home-hero-panel">
          <h1 className="home-hero-title">
            <span className="home-hero-line">Najdi jídlo</span>{' '}
            <span className="home-hero-line home-hero-accent">v Brně</span>
          </h1>
          <p className="home-hero-lead">
            Hledej podle chuti, rozpočtu a vzdálenosti. FoodGo odděluje ověřené údaje od odhadů.
          </p>
          <HomeSearch />
          <LocationBar places={restaurants} variant="hero" />
          <div className="home-quick-filters" aria-label="Rychlé filtry">
            <Link to="/results?open=1" className="home-quick-chip">
              Právě otevřeno
            </Link>
            <Link to="/results?budget=150" className="home-quick-chip">
              Do 150 Kč
            </Link>
            <Link
              to={hasOrigin ? '/results?sort=distance' : '/results'}
              className="home-quick-chip"
            >
              Nejblíže
            </Link>
          </div>
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

      <section className="home-listings" aria-labelledby="featured-title">
        <div className="section-heading section-heading--split">
          <div>
            <h2 id="featured-title" className="section-title">
              {sectionTitle}
            </h2>
            <p className="section-desc">{sectionDesc}</p>
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

      {recentPlaces.length > 0 ? (
        <section className="home-recent" aria-labelledby="recent-title">
          <div className="section-heading section-heading--split">
            <div>
              <h2 id="recent-title" className="section-title">
                Nedávno prohlížené
              </h2>
              <p className="section-desc">Jen v tomto zařízení. Nic se neodesílá.</p>
            </div>
          </div>
          <ul className="restaurant-list restaurant-list--compact">
            {recentPlaces.map((restaurant, index) => (
              <li key={restaurant.id}>
                <RestaurantCard restaurant={restaurant} index={index} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="budget-quick" aria-labelledby="budget-quick-title">
        <div className="budget-quick-panel">
          <h2 id="budget-quick-title" className="section-title">
            Podle rozpočtu
          </h2>
          <p className="section-desc">
            Filtr bere jen ověřenou cenu z menu — ne odhad. U rozpětí musí do limitu vejít i horní mez.
            Ověřenou cenu má zatím menší část katalogu; ostatní podniky uvidíš bez cenového limitu.
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
          <p className="section-desc">Rychlé cesty k tomu, co FoodGo umí hned teď.</p>
        </div>
        <div className="home-path-grid">
          <Link to="/results?view=map" className="home-path-card">
            <h3>Mapa Brna</h3>
            <p>Body restaurací podle filtrů. Klikni na bod a otevři detail.</p>
          </Link>
          <Link to="/nevim-co-jist" className="home-path-card">
            <h3>Nevím, co jíst</h3>
            <p>Náhodný podnik podle ceny, kategorie a volitelně okolí.</p>
          </Link>
          <Link to="/results?verified=1" className="home-path-card">
            <h3>Ověřené ceny</h3>
            <p>Jen podniky s doloženou cenou z menu.</p>
          </Link>
          <Link to="/oblibene" className="home-path-card">
            <h3>Oblíbené</h3>
            <p>Ulož podniky v prohlížeči — bez účtu i po přihlášení.</p>
          </Link>
        </div>
      </section>
    </main>
  )
}
