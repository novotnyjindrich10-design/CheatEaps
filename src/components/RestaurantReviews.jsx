import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import StarRating from './StarRating'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'
import { formatReviewDate } from '../utils/communityText'

const EMPTY = {
  summary: { count: 0, average: null, label: 'Zatím bez hodnocení' },
  reviews: [],
}

export default function RestaurantReviews({ restaurantId }) {
  const { session } = useAuth()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [nickname, setNickname] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const next = loginPath(`/restaurant/${restaurantId}`)
  const mine = data.reviews.find((review) => review.mine) || null

  useEffect(() => {
    let cancelled = false
    fetch(`/api/reviews?restaurantId=${encodeURIComponent(restaurantId)}`, { credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({})))
      .then((body) => {
        if (cancelled) return
        if (!body.ok) {
          setError(body.message || 'Recenze se nepodařilo načíst.')
          setLoading(false)
          return
        }
        setData({ summary: body.summary, reviews: body.reviews || [] })
        const own = (body.reviews || []).find((review) => review.mine)
        setRating(own?.rating || 0)
        setText(own?.body || '')
        if (own?.authorLabel && !own.authorLabel.startsWith('Host ')) setNickname(own.authorLabel)
        setError('')
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError('Recenze se nepodařilo načíst.')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId, session.authenticated])

  const apply = (body) => {
    setData({ summary: body.summary, reviews: body.reviews || [] })
    const own = (body.reviews || []).find((review) => review.mine)
    setRating(own?.rating || 0)
    setText(own?.body || '')
    setNotice(body.message || '')
    setError('')
    setConfirmDelete(false)
  }

  const save = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      const response = await fetch('/api/reviews', {
        method: mine ? 'PUT' : 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          rating,
          body: text,
          displayName: nickname,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || body.saved !== true) {
        setError(body.message || 'Recenzi se nepodařilo uložit.')
        return
      }
      apply(body)
    } catch {
      setError('Recenze se teď nepodařilo uložit.')
    } finally {
      setPending(false)
    }
  }

  const remove = async () => {
    setPending(true)
    setError('')
    try {
      const response = await fetch(`/api/reviews?restaurantId=${encodeURIComponent(restaurantId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || body.deleted !== true) {
        setError(body.message || 'Recenzi se nepodařilo smazat.')
        return
      }
      apply(body)
      setNickname('')
    } catch {
      setError('Recenzi se teď nepodařilo smazat.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="detail-section" id="recenze">
      <h2 className="detail-section-title">Recenze zákazníků</h2>
      <p className="detail-address">Hodnocení CheapEats. S hodnocením na Google se nesčítá.</p>
      {loading ? <p className="detail-address">Načítám recenze…</p> : null}
      {!loading && !error && data.summary.average == null ? (
        <p className="review-empty">{data.summary.label || 'Zatím bez hodnocení'}</p>
      ) : null}
      {!loading && typeof data.summary.average === 'number' ? (
        <StarRating rating={data.summary.average} reviewCount={data.summary.count} size="lg" source="CheapEats" />
      ) : null}

      {error ? (
        <p className="deal-warning" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}

      {session.ready && !session.authenticated ? (
        <p className="detail-address">
          <Link to={next}>Přihlas se</Link>
          {' nebo '}
          <Link to={loginPath(`/restaurant/${restaurantId}`, 'signup')}>si založ účet</Link>
          , když chceš napsat recenzi.
        </p>
      ) : null}

      {session.authenticated ? (
        <form className="auth-form review-form" onSubmit={save}>
          <p className="detail-address">{mine ? 'Tvoje recenze' : 'Přidat recenzi'}</p>
          <div className="review-stars" role="radiogroup" aria-label="Hodnocení od 1 do 5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`review-star${value <= rating ? ' is-on' : ''}`}
                role="radio"
                aria-checked={rating === value}
                onClick={() => setRating(value)}
              >
                <span aria-hidden="true">★</span>
                <span className="visually-hidden">{value} z 5</span>
              </button>
            ))}
          </div>
          <label>
            Veřejná přezdívka
            <input
              value={nickname}
              maxLength={32}
              autoComplete="nickname"
              placeholder="Třeba Alex"
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
          <p className="detail-metric-note">Bez přezdívky se zobrazí Host a krátký kód účtu. E-mail veřejný není.</p>
          <label>
            Text recenze
            <textarea
              value={text}
              required
              maxLength={1000}
              rows={4}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending || rating < 1}>
            {pending ? 'Ukládám…' : mine ? 'Uložit změny' : 'Uložit recenzi'}
          </button>
          {mine ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={pending}
              onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Opravdu smazat' : 'Smazat recenzi'}
            </button>
          ) : null}
        </form>
      ) : null}

      {data.reviews.length > 0 ? (
        <ul className="review-list">
          {data.reviews.map((review) => (
            <li key={review.id}>
              <ReviewItem review={review} onReported={setNotice} onError={setError} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function ReviewItem({ review, onReported, onError }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const date = formatReviewDate(review.createdAt)

  const report = async (event) => {
    event.preventDefault()
    setPending(true)
    try {
      const response = await fetch('/api/review-reports', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, reason }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || body.reported !== true) {
        onError(body.message || 'Nahlášení se nepodařilo uložit.')
        return
      }
      onError('')
      onReported(body.message)
      setOpen(false)
      setReason('')
    } catch {
      onError('Nahlášení se teď nepodařilo uložit.')
    } finally {
      setPending(false)
    }
  }

  return (
    <article className="review-item" data-author-id={review.authorId}>
      <header className="review-item-head">
        <strong>{review.authorLabel}</strong>
        <StarRating rating={review.rating} size="sm" source="CheapEats" />
        {date ? <time dateTime={review.createdAt}>{date}</time> : null}
      </header>
      <p>{review.body}</p>
      {review.mine || open ? null : (
        <button type="button" className="review-report" onClick={() => setOpen(true)}>
          Nahlásit
        </button>
      )}
      {open ? (
        <form className="review-report-form" onSubmit={report}>
          <label>
            Co je nevhodné
            <input value={reason} maxLength={280} required onChange={(event) => setReason(event.target.value)} />
          </label>
          <button type="submit" className="btn btn-secondary" disabled={pending}>
            {pending ? 'Posílám…' : 'Odeslat nahlášení'}
          </button>
        </form>
      ) : null}
    </article>
  )
}
