import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RestaurantCard from '../components/RestaurantCard'
import { useAuth } from '../context/authSession'
import { useCatalog } from '../context/CatalogContext'
import { useLocationState } from '../context/LocationContext'
import { getRestaurantById } from '../data/restaurants'
import { loginPath } from '../utils/authReturn'
import { removeMissingLocalFavorites } from '../utils/localFavorites'
import { varyPixabayOnPage } from '../utils/pageIllustrations'
import { fetchWithTimeout } from '../utils/fetchTimeout'

function placeExists(id) {
  return Boolean(getRestaurantById(id))
}

export default function Favorites() {
  const { session, logout } = useAuth()
  const { catalogReady } = useCatalog()
  const { attachDistances } = useLocationState()
  const [ids, setIds] = useState([])
  const [missing, setMissing] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState('local')

  useEffect(() => {
    if (!session.ready) return undefined

    if (!session.authenticated) {
      if (!catalogReady) {
        setLoading(true)
        return undefined
      }
      const cleaned = removeMissingLocalFavorites(placeExists)
      setIds(cleaned)
      setMissing(0)
      setSource('local')
      setError('')
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    fetchWithTimeout('/api/favorites', { credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({})))
      .then(async (body) => {
        if (cancelled) return
        if (!body.ok || !Array.isArray(body.ids)) {
          setError(body.message || 'Oblíbené se nepodařilo načíst.')
          setLoading(false)
          return
        }
        // Katalog se načítá async — neoznačuj ID za chybějící dřív, než je ready.
        if (!catalogReady) {
          const { ensureRestaurantsLoaded } = await import('../data/restaurants')
          await ensureRestaurantsLoaded()
        }
        if (cancelled) return
        const places = body.ids.map((id) => getRestaurantById(id)).filter(Boolean)
        setIds(places.map((place) => place.id))
        setMissing(body.ids.length - places.length)
        setSource('account')
        setError('')
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Oblíbené se nepodařilo načíst.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session.authenticated, session.ready, catalogReady])

  const restaurants = useMemo(
    () => varyPixabayOnPage(attachDistances(ids.map((id) => getRestaurantById(id)).filter(Boolean))),
    [attachDistances, ids],
  )

  const login = loginPath('/oblibene')
  const signup = loginPath('/oblibene', 'signup')

  return (
    <main className="page">
      <div className="page-head">
        <h1>Oblíbené</h1>
        <p className="page-subtitle">
          {source === 'account'
            ? 'Restaurace uložené k účtu FoodGo.'
            : 'Restaurace uložené v tomto prohlížeči. Po přihlášení je můžeš synchronizovat s účtem.'}
        </p>
      </div>

      {session.ready && session.authenticated ? (
        <div className="favorite-account" id="ucet">
          <p className="favorite-account-email" title={session.email}>
            {session.email}
          </p>
          <button type="button" className="btn btn-secondary" onClick={logout}>
            Odhlásit
          </button>
        </div>
      ) : null}

      {!session.ready || (session.authenticated && loading) || (!session.authenticated && !catalogReady) ? (
        <p className="page-subtitle">Načítám oblíbené…</p>
      ) : null}

      {session.ready && !session.authenticated ? (
        <div className="favorite-auth-cta" aria-label="Přihlášení a registrace">
          <Link to={login} className="btn btn-primary favorite-auth-login">
            Přihlásit se
          </Link>
          <Link to={signup} className="btn btn-secondary favorite-auth-register">
            Registrace
          </Link>
          <p className="favorite-auth-note">Po přihlášení se oblíbené uloží k účtu.</p>
        </div>
      ) : null}

      {error ? (
        <p className="page-subtitle" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && session.ready && restaurants.length === 0 && !error ? (
        <div className="empty-state">
          <p>Zatím tu nic není. Ulož podnik tlačítkem srdce v detailu.</p>
          {missing > 0 ? (
            <p className="section-desc" role="status">
              {missing} uložených ID už v katalogu není.
            </p>
          ) : null}
          <Link to="/results" className="btn btn-primary">
            Najít podnik
          </Link>
        </div>
      ) : null}

      {restaurants.length > 0 ? (
        <ul className="restaurant-list">
          {restaurants.map((restaurant, index) => (
            <li key={restaurant.id}>
              <RestaurantCard restaurant={restaurant} index={index} />
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  )
}
