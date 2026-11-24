import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../constants/brand'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'

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
