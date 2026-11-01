import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RestaurantCard from '../components/RestaurantCard'
import { useAuth } from '../context/authSession'
import { useLocationState } from '../context/LocationContext'
import { getRestaurantById } from '../data/restaurants'
import { loginPath } from '../utils/authReturn'

export default function Favorites() {
  const { session } = useAuth()
  const { attachDistances } = useLocationState()
  const [ids, setIds] = useState([])
  const [missing, setMissing] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session.ready || !session.authenticated) return undefined
    let cancelled = false
    fetch('/api/favorites', { credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({})))
      .then((body) => {
        if (cancelled) return
        if (!body.ok || !Array.isArray(body.ids)) {
          setError(body.message || 'Oblíbené se nepodařilo načíst.')
          setLoading(false)
          return
        }
        const places = body.ids.map((id) => getRestaurantById(id)).filter(Boolean)
        setIds(places.map((place) => place.id))
        setMissing(body.ids.length - places.length)
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
  }, [session.authenticated, session.ready])

  const restaurants = useMemo(
    () => attachDistances(ids.map((id) => getRestaurantById(id)).filter(Boolean)),
    [attachDistances, ids],
  )

  const login = loginPath('/oblibene')
  const signup = loginPath('/oblibene', 'signup')

  return (
    <main className="page">
      <div className="page-head">
        <h1>Oblíbené</h1>
        <p className="page-subtitle">Restaurace, které sis uložil ke svému účtu CheapEats.</p>
      </div>

      {!session.ready || (session.authenticated && loading) ? <p className="page-subtitle">Načítám oblíbené…</p> : null}

      {session.ready && !session.authenticated ? (
        <div className="empty-state">
          <p>Oblíbené restaurace uvidíš po přihlášení. Zůstanou u účtu i na dalším zařízení.</p>
          <p className="favorite-auth-links">
            <Link to={login} className="btn btn-primary">
              Přihlásit se
            </Link>
            <Link to={signup} className="btn btn-secondary">
              Vytvořit účet
            </Link>
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="deal-warning" role="alert">
          {error}
        </p>
      ) : null}

      {session.authenticated && !loading && !error && restaurants.length === 0 ? (
        <div className="empty-state">
          <p>Zatím tu nic nemáš. Srdíčko na detailu restaurace ji sem přidá.</p>
          <Link to="/results" className="btn btn-primary">
            Prohlížet restaurace
          </Link>
        </div>
      ) : null}

      {missing > 0 ? (
        <p className="detail-address">Některé uložené podniky už v katalogu nejsou, tak je tu nezobrazujeme.</p>
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
