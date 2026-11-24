import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatKc } from '../constants/businessPlans'
import { buildInvoiceDraft } from '../constants/invoiceDraft'
import { loginPath } from '../utils/authReturn'

function when(value) {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return ''
  return new Date(time).toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' })
}

const ACTIONS = [
  ['accept', 'Schválit spolupráci'],
  ['invoice', 'Označit fakturu'],
  ['mark_paid', 'Úhrada ověřena'],
  ['activate', 'Zapnout reklamu'],
  ['end', 'Ukončit reklamu'],
  ['decline', 'Odmítnout'],
]

const CONFIRM_ACTIONS = new Set(['mark_paid', 'activate', 'end', 'decline'])

const STATUS_FILTERS = [
  ['all', 'Vše'],
  ['inquiry', 'Poptávky'],
  ['accepted', 'Schválené'],
  ['active', 'Aktivní reklamy'],
  ['declined', 'Odmítnuté'],
  ['ended', 'Ukončené'],
]

export default function AdminPromotions() {
  const [me, setMe] = useState({ loading: true, authenticated: false, admin: false })
  const [orders, setOrders] = useState([])
  const [checkedAt, setCheckedAt] = useState(0)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [invoiceNo, setInvoiceNo] = useState({})
  const [placeIds, setPlaceIds] = useState({})
  const [busyId, setBusyId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const loadOrders = useCallback(async () => {
    const response = await fetch('/api/admin/promotion-orders', { credentials: 'same-origin' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.ok) {
      setError(body.message || 'Poptávky se nepodařilo načíst.')
      setOrders([])
      setStats(null)
      return
    }
    setError('')
    setOrders(body.orders || [])
    setCheckedAt(Date.now())
    setStats(body.stats || null)
  }, [])

  useEffect(() => {
    loadMe()
  }, [loadMe])

  useEffect(() => {
    if (me.admin) loadOrders()
  }, [me.admin, loadOrders])

  const review = async (id, action, placeId, invoiceNumber) => {
    if (CONFIRM_ACTIONS.has(action)) {
      const prompts = {
        mark_paid: 'Opravdu označit úhradu jako ověřenou? Reklama se tím ještě nezapne.',
        activate: 'Opravdu zapnout reklamu u tohoto podniku ve veřejných výsledcích?',
        end: 'Opravdu ukončit aktivní reklamu hned teď?',
        decline: 'Opravdu odmítnout tuhle poptávku?',
      }
      if (!window.confirm(prompts[action] || 'Opravdu pokračovat?')) return
    }
    setBusyId(`${action}-${id}`)
    setError('')
    try {
      const response = await fetch('/api/admin/promotion-orders/review', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, action, adminNote: note, placeId, invoiceNumber }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setError(body.message || 'Akce se nepovedla.')
        return
      }
      await loadOrders()
    } finally {
      setBusyId('')
    }
  }

  const visibleOrders = statusFilter === 'all'
    ? orders
    : orders.filter((order) => order.status === statusFilter)

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
        <h1 className="section-title">Propagace</h1>
        <p>Pro správu poptávek se nejdřív přihlas.</p>
        <Link className="btn btn-primary" to={loginPath('/admin/propagace')}>Přihlásit</Link>
      </main>
    )
  }

  if (!me.admin) {
    return (
      <main className="page">
        <h1 className="section-title">Propagace</h1>
        <p>Účet {me.email} nemá administrátorská práva.</p>
      </main>
    )
  }

  return (
    <main className="page admin-page">
      <h1 className="section-title">Poptávky propagace</h1>
      <p className="section-desc">
        Přihlášen jako {me.email}. Reklama se zapne až po ověřené úhradě. Obnovení se samo nezapíná.
        Text faktury níže je jen podklad, ne platný doklad.
      </p>
      <p>
        <Link to="/admin/zadosti">Žádosti o katalog</Link>
      </p>
      {stats ? (
        <p className="section-desc">
          Poptávek v evidenci: {stats.inquiries}. Aktivních umístění: {stats.activeSponsorships}.
          {' '}
          Evidovaná částka u stavu paid: {formatKc(stats.recordedRevenueCzk || 0)}. {stats.note}
        </p>
      ) : null}
      <label className="admin-note">
        Poznámka k rozhodnutí
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
      </label>
      {error ? <p className="biz-chat-error">{error}</p> : null}
      <div className="admin-filters" role="group" aria-label="Filtr stavu poptávek">
        {STATUS_FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn${statusFilter === value ? ' btn-primary' : ''}`}
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="admin-list">
        {orders.length === 0 ? <p>Žádné poptávky.</p> : null}
        {orders.length > 0 && visibleOrders.length === 0 ? <p>V tomto filtru nic není.</p> : null}
        {visibleOrders.map((order) => {
          const draft = buildInvoiceDraft(order)
          const expired = order.activated && order.endsAt && checkedAt > 0 && Date.parse(order.endsAt) <= checkedAt
          const placeId = placeIds[order.id] ?? order.placeId ?? ''
          const invoiceNumber = invoiceNo[order.id] ?? order.invoiceNumber ?? ''
          return (
            <article key={order.id} className="admin-card">
              <h2>{order.businessName}</h2>
              <p>
                {order.reference} · {order.planName} · {order.serviceLabel} · {formatKc(order.amount)} · {order.status} · platba {order.paymentStatus}
              </p>
              <p className="admin-private">
                {order.companyName}, {order.contactName}, {order.email}, {order.phone}
              </p>
              <p className="admin-private">{order.billingAddress}</p>
              <p>{draft.finalAmount == null ? 'Konečná částka není určená.' : `Konečná částka ${formatKc(draft.finalAmount)}.`} {draft.vatNote}</p>
              {order.invoiceNumber ? <p>Zapsané číslo dokladu: {order.invoiceNumber}</p> : null}
              {order.startsAt ? <p>Od {when(order.startsAt)} do {when(order.endsAt)}</p> : null}
              {expired ? <p>Platnost reklamy skončila. Ve výsledcích se už nezvýrazňuje.</p> : null}
              <label className="admin-note">
                Číslo dokladu z účetnictví
                <input
                  value={invoiceNumber}
                  maxLength={40}
                  onChange={(event) => setInvoiceNo((current) => ({ ...current, [order.id]: event.target.value }))}
                />
              </label>
              <label className="admin-note">
                Podnik v katalogu
                <input
                  value={placeId}
                  maxLength={80}
                  onChange={(event) => setPlaceIds((current) => ({ ...current, [order.id]: event.target.value }))}
                />
              </label>
              <label className="admin-note">
                Podklad k ruční faktuře, není doklad
                <textarea className="admin-draft" readOnly value={draft.text} />
              </label>
              <div className="admin-actions">
                {ACTIONS.map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    className="btn"
                    disabled={
                      busyId === `${action}-${order.id}`
                      || (action === 'activate' && order.paymentStatus !== 'paid')
                      || (action === 'mark_paid' && order.paymentStatus === 'paid')
                    }
                    onClick={() => review(order.id, action, placeId, invoiceNumber)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
