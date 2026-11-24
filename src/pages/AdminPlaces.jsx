import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminNav from '../components/AdminNav'
import { useCatalog } from '../context/CatalogContext'
import { listRestaurants } from '../data/restaurants'
import { loginPath } from '../utils/authReturn'

export default function AdminPlaces() {
  const { refreshOverrides } = useCatalog()
  const [catalogTick, setCatalogTick] = useState(0)
  const basePlaces = useMemo(() => {
    void catalogTick
    return listRestaurants()
  }, [catalogTick])
  const [me, setMe] = useState({ loading: true, authenticated: false, admin: false })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [overrides, setOverrides] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState({ name: '', address: '', category: '', hidden: false, adminNote: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

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

  const loadOverrides = useCallback(async () => {
    const response = await fetch('/api/admin/place-overrides', { credentials: 'same-origin' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.ok) {
      setError(body.message || 'Přepisy katalogu se nepodařilo načíst. Možná chybí SQL place-overrides.')
      setOverrides([])
      return
    }
    setError('')
    setOverrides(body.overrides || [])
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    if (me.admin) {
      loadOverrides()
      setCatalogTick((n) => n + 1)
    }
  }, [me.admin, loadOverrides])

  const overrideMap = useMemo(() => {
    const map = new Map()
    for (const row of overrides) map.set(row.placeId, row)
    return map
  }, [overrides])

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('cs')
    return basePlaces
      .map((place) => {
        const patch = overrideMap.get(place.id)
        return {
          ...place,
          name: patch?.name || place.name,
          address: patch?.address || place.address,
          category: patch?.category || place.category,
          override: patch || null,
          effectivelyHidden: patch?.hidden === true,
        }
      })
      .filter((place) => {
        if (filter === 'hidden' && !place.effectivelyHidden) return false
        if (filter === 'edited' && !place.override) return false
        if (!q) return true
        return [place.id, place.name, place.address, place.category]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('cs').includes(q))
      })
      .slice(0, 80)
  }, [basePlaces, overrideMap, query, filter])

  const selectPlace = (place) => {
    setSelectedId(place.id)
    const patch = overrideMap.get(place.id)
    setForm({
      name: patch?.name || '',
      address: patch?.address || '',
      category: patch?.category || '',
      hidden: patch?.hidden === true,
      adminNote: patch?.adminNote || '',
    })
    setMessage('')
  }

  const save = async (event) => {
    event.preventDefault()
    if (!selectedId) return
    setBusy(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/admin/place-overrides', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          placeId: selectedId,
          name: form.name,
          address: form.address,
          category: form.category,
          hidden: form.hidden,
          adminNote: form.adminNote,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setError(body.message || 'Uložení se nepovedlo.')
        return
      }
      setMessage('Úprava je uložená a návštěvníkům se projeví po obnovení katalogu.')
      await loadOverrides()
      await refreshOverrides?.()
    } finally {
      setBusy(false)
    }
  }

  const clearOverride = async () => {
    if (!selectedId) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/place-overrides?placeId=${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setError(body.message || 'Přepis se nepodařilo zrušit.')
        return
      }
      setMessage('Přepis je zrušený. Platí znovu statický katalog.')
      setForm({ name: '', address: '', category: '', hidden: false, adminNote: '' })
      await loadOverrides()
      await refreshOverrides?.()
    } finally {
      setBusy(false)
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
        <h1>Administrace podniků</h1>
        <p>Pro správu katalogu se přihlas.</p>
        <Link className="btn btn-primary" to={loginPath('/admin/podniky')}>
          Přihlásit
        </Link>
      </main>
    )
  }

  if (!me.admin) {
    return (
      <main className="page admin-page">
        <h1>Administrace podniků</h1>
        <p>Účet {me.email} nemá administrátorská práva.</p>
      </main>
    )
  }

  return (
    <main className="page admin-page">
      <h1>Podniky</h1>
      <p className="section-desc">
        Statických 775 podniků se v souborech nemění. Skrytí a úpravy jména, adresy nebo kategorie se ukládají
        do databáze a sloučí se s katalogem za běhu. Nové podniky schvaluj v žádostech o katalog.
      </p>
      <AdminNav />

      <div className="admin-filters" role="group" aria-label="Filtr podniků">
        <label>
          Hledat
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="název, adresa, id" />
        </label>
        <label>
          Filtr
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Vše v katalogu</option>
            <option value="edited">Jen s přepisem</option>
            <option value="hidden">Skryté</option>
          </select>
        </label>
      </div>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <div className="admin-list">
        {rows.map((place) => (
          <article key={place.id} className="admin-card">
            <h2>{place.name}</h2>
            <p>{place.address || 'Bez adresy'}</p>
            <p>
              {place.category || 'bez kategorie'} · {place.id}
              {place.effectivelyHidden ? ' · skrytý' : ''}
              {place.override ? ' · má přepis' : ''}
            </p>
            <div className="admin-actions">
              <button type="button" className="btn btn-secondary" onClick={() => selectPlace(place)}>
                Upravit
              </button>
              <Link className="btn" to={`/restaurant/${place.id}`}>
                Veřejný detail
              </Link>
            </div>
          </article>
        ))}
      </div>

      {selectedId ? (
        <form className="biz-form biz-form-grid" onSubmit={save}>
          <h2>Úprava {selectedId}</h2>
          <p className="section-desc">Prázdné pole zachová hodnotu ze statického katalogu.</p>
          <label>
            Název
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Adresa
            <input
              value={form.address}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
          </label>
          <label>
            Kategorie
            <input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
            />
          </label>
          <label>
            Interní poznámka
            <textarea
              value={form.adminNote}
              onChange={(event) => setForm((current) => ({ ...current, adminNote: event.target.value }))}
            />
          </label>
          <label className="admin-note">
            <input
              type="checkbox"
              checked={form.hidden}
              onChange={(event) => setForm((current) => ({ ...current, hidden: event.target.checked }))}
            />{' '}
            Skrýt podnik návštěvníkům
          </label>
          <div className="admin-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Ukládám…' : 'Uložit přepis'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={clearOverride}>
              Zrušit přepis
            </button>
          </div>
        </form>
      ) : null}
    </main>
  )
}
