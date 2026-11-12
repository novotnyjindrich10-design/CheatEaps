import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'

const emptyReward = {
  slug: '',
  title: '',
  description: '',
  partnerName: '',
  pointsCost: 20,
  status: 'coming_soon',
  terms: '',
}

export default function AdminLoyalty() {
  const { session } = useAuth()
  const [admin, setAdmin] = useState(false)
  const [pending, setPending] = useState([])
  const [rewards, setRewards] = useState([])
  const [form, setForm] = useState(emptyReward)
  const [codeRewardId, setCodeRewardId] = useState('')
  const [codesText, setCodesText] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setError('')
    const me = await fetch('/api/admin/me', { credentials: 'same-origin' }).then((r) => r.json().catch(() => ({})))
    if (!me.admin) {
      setAdmin(false)
      return
    }
    setAdmin(true)
    const [rev, rew] = await Promise.all([
      fetch('/api/admin/reviews/pending', { credentials: 'same-origin' }).then((r) => r.json().catch(() => ({}))),
      fetch('/api/admin/loyalty/rewards', { credentials: 'same-origin' }).then((r) => r.json().catch(() => ({}))),
    ])
    if (rev.ok) setPending(rev.reviews || [])
    if (rew.ok) setRewards(rew.rewards || [])
  }

  useEffect(() => {
    if (!session.authenticated) return undefined
    load()
    return undefined
  }, [session.authenticated])

  async function moderate(reviewId, action) {
    setMessage('')
    setError('')
    const res = await fetch('/api/admin/reviews/moderate', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reviewId, action }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) {
      setError(body.message || 'Akce se nepovedla.')
      return
    }
    setMessage(body.message || 'Uloženo.')
    await load()
  }

  async function saveReward(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    const res = await fetch('/api/admin/loyalty/rewards', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) {
      setError(body.message || 'Odměnu se nepodařilo uložit.')
      return
    }
    setMessage('Odměna uložená.')
    setForm(emptyReward)
    await load()
  }

  async function addCodes(event) {
    event.preventDefault()
    setMessage('')
    setError('')
    const codes = codesText
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    const res = await fetch('/api/admin/loyalty/rewards/codes', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rewardId: codeRewardId, codes }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) {
      setError(body.message || 'Kódy se nepodařilo přidat.')
      return
    }
    setMessage(body.message || 'Kódy přidané.')
    setCodesText('')
    await load()
  }

  if (!session.ready) {
    return (
      <main className="page">
        <p className="section-desc">Načítám…</p>
      </main>
    )
  }

  if (!session.authenticated) {
    return (
      <main className="page">
        <p className="section-desc">
          <Link to={loginPath('/admin/odmeny')}>Přihlas se</Link> jako administrátor.
        </p>
      </main>
    )
  }

  if (!admin) {
    return (
      <main className="page">
        <p className="section-desc">Na správu odměn nemáš oprávnění.</p>
        <Link to="/">Zpět</Link>
      </main>
    )
  }

  return (
    <main className="page loyalty-admin-page">
      <div className="page-head">
        <Link to="/admin/zadosti" className="back-link">
          ← Administrace
        </Link>
        <h1>Odměny a schvalování recenzí</h1>
      </div>

      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <section className="loyalty-panel">
        <h2 className="section-title">Čekající recenze</h2>
        {pending.length === 0 ? (
          <p className="section-desc">Žádná recenze nečeká.</p>
        ) : (
          <ul className="loyalty-history-list">
            {pending.map((review) => (
              <li key={review.id}>
                <div>
                  <strong>{review.authorLabel}</strong> · <Link to={`/restaurant/${encodeURIComponent(review.restaurantId)}`}>{review.restaurantId}</Link> · {review.rating}/5
                  <p className="section-desc">{review.body}</p>
                </div>
                <div className="loyalty-admin-actions">
                  <button type="button" className="btn btn-primary" onClick={() => moderate(review.id, 'approve')}>
                    Schválit (+5 bodů)
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => moderate(review.id, 'reject')}>
                    Zamítnout
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="loyalty-panel">
        <h2 className="section-title">Nová / upravená odměna</h2>
        <form className="loyalty-admin-form" onSubmit={saveReward}>
          <label>
            Slug
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              pattern="[a-z0-9][a-z0-9-]{1,62}"
            />
          </label>
          <label>
            Název
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            Partner (bez falešného partnerství)
            <input value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} />
          </label>
          <label>
            Popis
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </label>
          <label>
            Cena v bodech
            <input
              type="number"
              min={1}
              value={form.pointsCost}
              onChange={(e) => setForm({ ...form, pointsCost: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            Stav
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="coming_soon">Připravujeme</option>
              <option value="available">Dostupné (jen s kódy)</option>
              <option value="disabled">Vypnuto</option>
            </select>
          </label>
          <label>
            Podmínky
            <textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={2} />
          </label>
          <button type="submit" className="btn btn-primary">
            Uložit odměnu
          </button>
        </form>
      </section>

      <section className="loyalty-panel">
        <h2 className="section-title">Přidat unikátní kódy</h2>
        <form className="loyalty-admin-form" onSubmit={addCodes}>
          <label>
            Odměna
            <select value={codeRewardId} onChange={(e) => setCodeRewardId(e.target.value)} required>
              <option value="">Vyber odměnu</option>
              {rewards.map((reward) => (
                <option key={reward.id} value={reward.id}>
                  {reward.title} ({reward.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            Kódy (jeden na řádek)
            <textarea value={codesText} onChange={(e) => setCodesText(e.target.value)} rows={6} required />
          </label>
          <button type="submit" className="btn btn-primary">
            Přidat kódy
          </button>
        </form>
        <p className="section-desc">Bez volných kódů se při uplatnění body neodečtou.</p>
      </section>
    </main>
  )
}
