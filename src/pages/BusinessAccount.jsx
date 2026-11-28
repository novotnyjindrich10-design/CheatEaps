import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../constants/brand'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'
import { summarizeRange } from '../utils/placeStatWindows'

function when(value) {
  const time = Date.parse(value)
  if (!Number.isFinite(time)) return ''
  return new Date(time).toLocaleString('cs-CZ', { dateStyle: 'medium', timeStyle: 'short' })
}

const STATUS_LABEL = {
  inquiry: 'Poptávka čeká na kontrolu',
  accepted: 'Poptávka je přijatá, propagace ještě neběží',
  active: 'Propagace je aktivní',
  declined: 'Poptávka byla odmítnutá',
  ended: 'Propagace skončila',
}

export default function BusinessAccount() {
  const { session } = useAuth()
  const [reference, setReference] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [order, setOrder] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payments, setPayments] = useState({ loading: true, enabled: false, live: false })
  const [ownerStats, setOwnerStats] = useState({ loading: false, body: null })

  useEffect(() => {
    let cancelled = false
    fetch('/api/payments/status', { credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({})))
      .then((body) => {
        if (cancelled) return
        setPayments({
          loading: false,
          enabled: Boolean(body?.enabled),
          live: Boolean(body?.live),
        })
      })
      .catch(() => {
        if (!cancelled) setPayments({ loading: false, enabled: false, live: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!session.ready || !session.authenticated) {
      setOwnerStats({ loading: false, body: null })
      return undefined
    }
    let cancelled = false
    setOwnerStats({ loading: true, body: null })
    fetch('/api/place-stats/owner', { credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({})))
      .then((body) => {
        if (!cancelled) setOwnerStats({ loading: false, body })
      })
      .catch(() => {
        if (!cancelled) {
          setOwnerStats({
            loading: false,
            body: { ok: false, empty: true, message: 'Statistiky se teď nepodařilo načíst.' },
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [session.authenticated, session.ready])

  const lookup = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setOrder(null)
    try {
      const response = await fetch(`/api/promotion-orders?reference=${encodeURIComponent(reference.trim())}`, {
        headers: { 'x-foodgo-order-key': accessKey.trim() },
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok) {
        setMessage(body.message || 'Poptávka se nenašla. Zkontroluj kód a přístupový klíč z potvrzení.')
        return
      }
      setOrder(body.order)
    } catch {
      setMessage('Stav poptávky se teď nepodařilo načíst.')
    } finally {
      setLoading(false)
    }
  }

  const startPayment = async () => {
    if (!order) return
    setPaying(true)
    setMessage('')
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reference: reference.trim(),
          accessKey: accessKey.trim(),
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok || !body.redirect) {
        setMessage(body.message || 'Platební bránu teď nejde otevřít. Poptávka zůstává uložená.')
        return
      }
      window.location.assign(body.redirect)
    } catch {
      setMessage('Platební bránu teď nejde otevřít. Poptávka zůstává uložená.')
    } finally {
      setPaying(false)
    }
  }

  const canPay =
    order
    && !order.paid
    && order.status !== 'declined'
    && order.status !== 'ended'
    && payments.enabled

  return (
    <main className="page biz-page">
      <p className="biz-kicker">Účet podniku</p>
      <h1>Správa podniku</h1>
      <p className="biz-lead">
        Přihlášení neopravňuje převzít cizí restauraci. Profil v katalogu se změní až po kontrole žádosti.
      </p>

      <section className="biz-section" aria-labelledby="claim-title">
        <h2 id="claim-title">Požádat o správu profilu</h2>
        {session.ready && session.authenticated ? (
          <p>Jsi přihlášený jako {session.email || 'účet FoodGo'}. Samotný účet podnik v katalogu nespravuje.</p>
        ) : (
          <p>
            <Link to={loginPath('/pro-podniky/ucet')}>Přihlásit se</Link>
            {' '}
            můžeš kvůli kontaktu. Oprávnění ke konkrétnímu podniku z toho samo nevznikne.
          </p>
        )}
        <ul>
          <li>Žádost o neplacený zápis nebo úpravu povolených údajů jde přes formulář na stránce Pro podniky.</li>
          <li>Uvést můžeš název, adresu, kontakt, web a popis. Do katalogu se dostanou až po kontrole.</li>
          <li>Cizí podnik tímto účtem nepřepíšeš a jeho propagaci neuvidíš bez přístupového klíče své poptávky.</li>
        </ul>
        <Link className="btn btn-primary" to="/pro-podniky#zapis">
          Otevřít žádost o zápis
        </Link>
      </section>

      <OwnerStats session={session} stats={ownerStats} order={order} />

      <section className="biz-section" aria-labelledby="order-title">
        <h2 id="order-title">Stav propagace</h2>
        <p className="section-desc">
          Kód poptávky a přístupový klíč dostaneš po odeslání nezávazné poptávky. Klíč nikomu neposílej.
          Automatické obnovení není zapnuté, takže není co vypínat. Po datu konce zvýraznění skončí samo.
        </p>
        <form className="biz-form biz-form-grid" onSubmit={lookup}>
          <label>
            Kód poptávky
            <input value={reference} onChange={(event) => setReference(event.target.value)} autoComplete="off" required />
          </label>
          <label>
            Přístupový klíč
            <input value={accessKey} onChange={(event) => setAccessKey(event.target.value)} autoComplete="off" required />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Načítám…' : 'Zobrazit poptávku'}
          </button>
        </form>
        {message ? <p role="status">{message}</p> : null}
        {order ? (
          <article className="biz-plan">
            <h3>{order.businessName}</h3>
            <p>{STATUS_LABEL[order.status] || order.status}</p>
            <p>
              {order.planName} · {order.serviceLabel} · {order.amount} {order.currency || 'Kč'}
            </p>
            <p>Platba: {order.paid ? 'v evidenci označeno jako uhrazeno' : 'není uhrazeno'}.</p>
            <p>Obnovení: samo se neobnovuje (jednorázové období, ne předplatné).</p>
            {order.startsAt ? <p>Začátek propagace: {when(order.startsAt)}</p> : null}
            {order.endsAt ? <p>Konec propagace: {when(order.endsAt)}</p> : <p>Datum konce se nastaví až po zapnutí propagace.</p>}
            {canPay ? (
              <p>
                <button type="button" className="btn btn-primary" onClick={startPayment} disabled={paying}>
                  {paying ? 'Otevírám bránu…' : payments.live ? 'Zaplatit online' : 'Zaplatit v testovací bráně'}
                </button>
              </p>
            ) : null}
            {!payments.loading && !payments.enabled && !order.paid ? (
              <p className="section-desc">
                Online platba ještě není k dispozici. Stačí nezávazná poptávka a potvrzení e-mailem. Nic se
                nestrhává.
              </p>
            ) : null}
            <p>
              <Link to="/pro-podniky#balicky">Požádat o další propagaci</Link>
              {' '}
              založí novou nezávaznou poptávku. Běžící období to samo nezmění.
            </p>
            <p className="section-desc">
              Problém s poptávkou? Napiš na{' '}
              <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Poptávka ${order.reference || ''}`)}`}>
                {CONTACT_EMAIL}
              </a>
              {' · '}
              <Link to="/reklamni-zvyrazneni">Jak funguje reklama</Link>
            </p>
          </article>
        ) : null}
      </section>
    </main>
  )
}

function countLine(label, value) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function WindowTable({ title, counts }) {
  if (!counts) return null
  return (
    <div>
      <h4>{title}</h4>
      <dl className="detail-contact-list">
        {countLine('Otevření detailu', counts.profileViews)}
        {countLine('Kliknutí na navigaci', counts.routeClicks)}
        {countLine('Kliknutí na web', counts.websiteClicks)}
        {countLine('Kliknutí na telefon', counts.phoneClicks)}
      </dl>
    </div>
  )
}

function OwnerStats({ session, stats, order }) {
  if (!session.ready) return null
  if (!session.authenticated) {
    return (
      <section className="biz-section" aria-labelledby="stats-title">
        <h2 id="stats-title">Statistiky podniku</h2>
        <p className="section-desc">
          Naměřená čísla uvidíš po přihlášení, a jen u podniku, jehož správu máš ověřenou.
        </p>
      </section>
    )
  }
  const body = stats.body
  const places = Array.isArray(body?.places) ? body.places : []
  const promo = places.find((place) => place.restaurantId === order?.placeId)
  const promoWindow =
    promo?.days && order?.startsAt && order?.endsAt
      ? summarizeRange(promo.days, order.startsAt, order.endsAt)
      : null

  return (
    <section className="biz-section" aria-labelledby="stats-title">
      <h2 id="stats-title">Statistiky podniku</h2>
      <p className="section-desc">
        Počítáme jen skutečné otevření detailu, navigaci, web a telefon. Zobrazení v seznamu zatím neměříme,
        proto tu není nula, která by vypadala jako výsledek.
      </p>
      {stats.loading ? <p role="status">Načítám statistiky…</p> : null}
      {!stats.loading && body?.message ? <p>{body.message}</p> : null}
      {!stats.loading && body?.empty && places.length === 0 ? (
        <p className="empty-state">Zatím tu nejsou žádná naměřená data.</p>
      ) : null}
      {places.map((place) => (
        <article key={place.restaurantId} className="biz-plan">
          <h3>{place.restaurantId}</h3>
          {!place.hasData ? (
            <p>U tohoto podniku zatím není žádné naměřené zobrazení ani kliknutí.</p>
          ) : (
            <>
              <WindowTable title="Posledních 7 dní" counts={place.windows?.d7} />
              <WindowTable title="Posledních 30 dní" counts={place.windows?.d30} />
            </>
          )}
        </article>
      ))}
      {order?.startsAt && order?.endsAt ? (
        <article className="biz-plan">
          <h3>Výsledky během propagace</h3>
          <p>
            Období {when(order.startsAt)} – {when(order.endsAt)}.
          </p>
          {promoWindow?.hasData ? (
            <WindowTable title="Naměřeno v tomhle období" counts={promoWindow} />
          ) : (
            <p>V tomhle období zatím nejsou naměřená data. Neukazujeme odhad.</p>
          )}
        </article>
      ) : null}
    </section>
  )
}
