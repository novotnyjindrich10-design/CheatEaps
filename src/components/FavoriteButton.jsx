import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'

function Heart({ filled }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20.5s-7.2-4.35-7.2-9.05A3.95 3.95 0 0 1 12 8.2a3.95 3.95 0 0 1 7.2 3.25c0 4.7-7.2 9.05-7.2 9.05z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function FavoriteButton({ restaurantId }) {
  const { session } = useAuth()
  const [favorite, setFavorite] = useState(false)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
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
          setReady(true)
          return
        }
        setFavorite(body.ids.includes(restaurantId))
        setError('')
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setError('Oblíbené se nepodařilo načíst.')
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, session.authenticated, session.ready])

  const toggle = async () => {
    setError('')
    setPending(true)
    try {
      const response = await fetch(
        favorite ? `/api/favorites?restaurantId=${encodeURIComponent(restaurantId)}` : '/api/favorites',
        {
          method: favorite ? 'DELETE' : 'POST',
          credentials: 'same-origin',
          headers: favorite ? undefined : { 'content-type': 'application/json' },
          body: favorite ? undefined : JSON.stringify({ restaurantId }),
        },
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || !Array.isArray(body.ids)) {
        setError(body.message || 'Oblíbenou restauraci se nepodařilo uložit.')
        return
      }
      setFavorite(body.ids.includes(restaurantId))
    } catch {
      setError('Oblíbené se teď nepodařilo uložit.')
    } finally {
      setPending(false)
    }
  }

  const next = loginPath(`/restaurant/${restaurantId}`)
  let control
  if (!session.ready || (session.authenticated && !ready)) {
    control = (
      <button type="button" className="favorite-button" disabled>
        <Heart filled={false} />
        Načítám
      </button>
    )
  } else if (!session.authenticated) {
    control = (
      <Link className="favorite-button" to={next}>
        <Heart filled={false} />
        Uložit
      </Link>
    )
  } else {
    control = (
      <button
        type="button"
        className={`favorite-button${favorite ? ' is-on' : ''}`}
        aria-pressed={favorite}
        disabled={pending}
        onClick={toggle}
      >
        <Heart filled={favorite} />
        {pending ? 'Ukládám' : favorite ? 'V oblíbených' : 'Uložit'}
      </button>
    )
  }

  return (
    <div className="favorite-control">
      {control}
      {error ? (
        <p className="deal-warning" role="alert">
          {error}
        </p>
      ) : null}
      {!session.authenticated && session.ready ? (
        <p className="favorite-note">
          <Link to={next}>Přihlas se</Link>
          {' nebo '}
          <Link to={loginPath(`/restaurant/${restaurantId}`, 'signup')}>si založ účet</Link>
          , ať restaurace zůstane u tebe.
        </p>
      ) : null}
    </div>
  )
}
