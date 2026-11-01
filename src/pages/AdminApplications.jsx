import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import BusinessPreview from '../components/BusinessPreview'
import { useCatalog } from '../context/CatalogContext'
import { loginPath } from '../utils/authReturn'

export default function AdminApplications() {
  const { refreshPublished } = useCatalog()
  const [me, setMe] = useState({ loading: true, authenticated: false, admin: false })
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('pending')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [note, setNote] = useState('')

  const loadMe = useCallback(async () => {
    const res = await fetch('/api/admin/me', { credentials: 'same-origin' })
    const body = await res.json().catch(() => ({}))
    setMe({
      loading: false,
      authenticated: Boolean(body.authenticated),
      admin: Boolean(body.admin),
      email: body.email || '',
    })
  }, [])

  const loadRows = useCallback(async () => {
    setError('')
    const q = filter ? `?status=${encodeURIComponent(filter)}` : ''
    const res = await fetch(`/api/admin/business-applications${q}`, { credentials: 'same-origin' })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.ok) {
      setError(body.message || 'Žádosti se nepodařilo načíst.')
      setRows([])
      return
    }
    setRows(body.applications || [])
  }, [filter])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    if (me.admin) loadRows()
  }, [me.admin, loadRows])

  const review = async (id, action) => {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch('/api/admin/business-applications/review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action, adminNote: note }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setError(body.message || 'Akce se nepovedla.')
        return
      }
      if (action === 'approve') await refreshPublished()
      await loadRows()
    } finally {
      setBusyId('')
    }
  }

  const resendEmail = async (id) => {
    setBusyId(`mail-${id}`)
    setError('')
    try {
      const res = await fetch('/api/admin/business-applications/resend-email', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!body.ok) {
        setError(body.message || body.emailError || 'E-mail se nepodařilo odeslat.')
      }
      await loadRows()
    } finally {
      setBusyId('')
    }
  }

  if (me.loading) {
    return (
      <main className="page">
        <p>Načítám…</p>
      </main>
    )
  }

  if (!me.authenticated) {
    return (
      <main className="page">
        <h1 className="section-title">Administrace žádostí</h1>
        <p>Pro správu žádostí se nejdřív přihlas.</p>
        <Link className="btn btn-primary" to={loginPath('/admin/zadosti')}>
          Přihlásit
        </Link>
      </main>
    )
  }

  if (!me.admin) {
    return (
      <main className="page">
        <h1 className="section-title">Administrace žádostí</h1>
        <p>Účet {me.email} nemá administrátorská práva. Přístup se neřídí z prohlížeče, ale z databáze.</p>
      </main>
    )
  }

  return (
    <main className="page admin-page">
      <h1 className="section-title">Žádosti o podniky</h1>
      <p className="section-desc">Přihlášen jako {me.email}. Schválení zveřejní podnik v katalogu CheapEats.</p>

      <div className="admin-filters">
        {['pending', 'needs_changes', 'approved', 'rejected', ''].map((value) => (
          <button
            key={value || 'all'}
            type="button"
            className={`btn${filter === value ? ' btn-primary' : ''}`}
            onClick={() => setFilter(value)}
          >
            {value || 'vše'}
          </button>
        ))}
      </div>

      <label className="admin-note">
        Poznámka k rozhodnutí
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
      </label>

      {error ? <p className="biz-chat-error">{error}</p> : null}

      <div className="admin-list">
        {rows.length === 0 ? <p>Žádné žádosti v tomhle filtru.</p> : null}
        {rows.map((row) => (
          <article key={row.id} className="admin-card">
            <header>
              <h2>{row.businessName}</h2>
              <p>
                Stav: <strong>{row.status}</strong> · e-mail: <strong>{row.emailStatus}</strong>
                {row.emailError ? ` (${row.emailError})` : ''}
              </p>
              <p className="admin-private">Soukromý e-mail majitele: {row.ownerEmail}</p>
              <p>
                Kategorie: {row.categoryLabel}
                {row.cuisineFocus ? ` · zaměření: ${row.cuisineFocus}` : ''}
              </p>
            </header>

            <div className="admin-verify">
              <h3>Ověření existence</h3>
              <p>
                Stav: <strong>{row.existenceStatus || 'unavailable'}</strong>
                {row.existenceRequiresManual ? ' · vyžaduje ruční kontrolu' : ''}
              </p>
              <p>{row.existenceSummary || 'Bez výsledku kontroly.'}</p>
              {row.existenceCandidates?.length ? (
                <ul>
                  {row.existenceCandidates.map((item) => (
                    <li key={`${item.placeId}-${item.name}`}>
                      {item.name}
                      {item.address ? ` · ${item.address}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="admin-desc-compare">
              <div>
                <h3>Původní popis</h3>
                <p>{row.descriptionOriginal || '—'}</p>
              </div>
              <div>
                <h3>Finální popis (k publikaci)</h3>
                <p>{row.description || '—'}</p>
                {row.descriptionReviewEngine ? (
                  <p className="biz-form-hint">
                    Kontrola: {row.descriptionReviewEngine}
                    {row.descriptionReviewNotes ? ` · ${row.descriptionReviewNotes}` : ''}
                  </p>
                ) : null}
              </div>
            </div>

            <BusinessPreview
              answers={{
                businessName: row.businessName,
                address: row.address,
                locality: row.locality,
                category: row.category,
                categoryLabel: row.cuisineFocus || row.categoryLabel,
                description: row.description,
                photo: row.photoDataUrl ? { dataUrl: row.photoDataUrl } : null,
              }}
            />
            {row.website ? (
              <p>
                Web: <a href={row.website}>{row.website}</a>
              </p>
            ) : null}
            {row.publishedPlaceId ? (
              <p>
                Zveřejněno:{' '}
                <Link to={`/restaurant/${encodeURIComponent(row.publishedPlaceId)}`}>
                  {row.publishedPlaceId}
                </Link>
              </p>
            ) : null}
            <div className="admin-actions">
              {row.status === 'pending' || row.status === 'needs_changes' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === row.id}
                    onClick={() => review(row.id, 'approve')}
                  >
                    Schválit a publikovat
                  </button>
                  <button type="button" className="btn" disabled={busyId === row.id} onClick={() => review(row.id, 'needs_changes')}>
                    Požádat o doplnění
                  </button>
                  <button type="button" className="btn" disabled={busyId === row.id} onClick={() => review(row.id, 'reject')}>
                    Zamítnout
                  </button>
                </>
              ) : null}
              {row.status === 'approved' && row.publishedPlaceId && row.emailStatus !== 'sent' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === `mail-${row.id}`}
                  onClick={() => resendEmail(row.id)}
                >
                  Znovu odeslat e-mail majiteli
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
