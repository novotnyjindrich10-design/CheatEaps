import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { loginPath } from '../utils/authReturn'

const STATUS_LABEL = {
  new: 'Nové',
  reviewing: 'Řeší se',
  resolved: 'Vyřešené',
  dismissed: 'Zamítnuté',
}

export default function AdminReports() {
  const [me, setMe] = useState({ loading: true, authenticated: false, admin: false })
  const [reports, setReports] = useState([])
  const [filter, setFilter] = useState('new')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const loadMe = useCallback(async () => {
    const response = await fetch('/api/admin/me', { credentials: 'same-origin' })
    const body = await response.json().catch(() => ({}))
    setMe({
      loading: false,
      authenticated: Boolean(body.authenticated),
      admin: Boolean(body.admin),
      email: body.email || '',
    })
  }, [])

  const loadReports = useCallback(async () => {
    const response = await fetch('/api/place-reports', { credentials: 'same-origin' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.ok) {
      setError(body.message || 'Hlášení se nepodařilo načíst.')
      setReports([])
      return
    }
    setError('')
    setReports(body.reports || [])
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    if (me.admin) loadReports()
  }, [me.admin, loadReports])

  const rows = useMemo(() => {
    if (filter === 'all') return reports
    return reports.filter((row) => row.status === filter)
  }, [reports, filter])

  const setStatus = async (id, status) => {
    setBusyId(id)
    setError('')
    try {
      const response = await fetch('/api/place-reports', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setError(body.message || 'Stav se nepodařilo uložit.')
        return
      }
      await loadReports()
    } finally {
      setBusyId('')
    }
  }

  if (me.loading) {
    return (
      <main className="page admin-page">
        <p>Ověřuji administrátorský přístup…</p>
      </main>
    )
  }

  if (!me.authenticated) {
    return (
      <main className="page admin-page">
        <h1>Hlášení chyb</h1>
        <p>Pro správu hlášení se přihlas.</p>
        <Link className="btn btn-primary" to={loginPath('/admin/hlaseni')}>
          Přihlásit
        </Link>
      </main>
    )
  }

  if (!me.admin) {
    return (
      <main className="page admin-page">
        <h1>Hlášení chyb</h1>
        <p>Účet {me.email} nemá administrátorská práva.</p>
      </main>
    )
  }

  return (
    <main className="page admin-page">
      <h1>Hlášení chyb</h1>
      <p className="section-desc">
        Návštěvníci hlásí chybný údaj u podniku. Stav se ukládá do databáze. Úprava samotného katalogu je na stránce
        Podniky.
      </p>
      <AdminNav />

      <div className="admin-filters" role="group" aria-label="Filtr hlášení">
        {['new', 'reviewing', 'resolved', 'dismissed', 'all'].map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'btn btn-primary' : 'btn btn-secondary'}
            onClick={() => setFilter(value)}
          >
            {value === 'all' ? 'Všechna' : STATUS_LABEL[value]}
          </button>
        ))}
      </div>

      {error ? <p role="alert">{error}</p> : null}

      <div className="admin-list">
        {rows.length === 0 ? <p>Žádná hlášení v tomto filtru.</p> : null}
        {rows.map((report) => (
          <article key={report.id} className="admin-card">
            <h2>{report.restaurantId}</h2>
            <p>
              {STATUS_LABEL[report.status] || report.status} · {report.reason}
            </p>
            <p>{report.details}</p>
            {report.contact ? <p className="admin-private">Kontakt: {report.contact}</p> : null}
            <div className="admin-actions">
              <Link className="btn" to={`/restaurant/${report.restaurantId}`}>
                Detail podniku
              </Link>
              <Link className="btn" to="/admin/podniky">
                Upravit katalog
              </Link>
              {report.status !== 'reviewing' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === report.id}
                  onClick={() => setStatus(report.id, 'reviewing')}
                >
                  Řešit
                </button>
              ) : null}
              {report.status !== 'resolved' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === report.id}
                  onClick={() => setStatus(report.id, 'resolved')}
                >
                  Vyřešit
                </button>
              ) : null}
              {report.status !== 'dismissed' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === report.id}
                  onClick={() => setStatus(report.id, 'dismissed')}
                >
                  Zamítnout
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
