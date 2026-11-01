import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getRestaurantById } from '../data/restaurants'
import { allDealRows, dealValidityNote, publicDealById } from '../data/restaurantDeals'
import { useAuth } from '../context/authSession'
import { copyText } from '../utils/copyText'
import { httpUrl } from '../utils/website'
import { loginPath } from '../utils/authReturn'

export default function DealDetail() {
  const { dealId } = useParams()
  const decodedId = decodeURIComponent(dealId || '')
  const known = allDealRows().find((item) => item.id === decodedId) ?? null
  const live = publicDealById(decodedId)
  const restaurant = known ? getRestaurantById(known.restaurantId) : null
  const { session } = useAuth()
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState(false)
  const [copyState, setCopyState] = useState('')
  const here = `/nabidka/${encodeURIComponent(decodedId)}`

  useEffect(() => {
    if (!session.ready || !session.authenticated) return undefined
    const current = publicDealById(decodedId)
    if (!current) return undefined
    let cancelled = false
    fetch(`/api/deal-detail?id=${encodeURIComponent(current.id)}`, { credentials: 'same-origin' })
      .then(async (response) => ({ status: response.status, body: await response.json().catch(() => ({})) }))
      .then((payload) => {
        if (!cancelled) setDetail(payload)
      })
      .catch(() => {
        if (!cancelled) setDetailError(true)
      })
    return () => {
      cancelled = true
    }
  }, [decodedId, session.ready, session.authenticated])

  if (!known) {
    return (
      <main className="page">
        <h1>Nabídka nenalezena</h1>
        <Link to="/results" className="btn btn-secondary">
          Zpět na výsledky
        </Link>
      </main>
    )
  }

  const back = `/restaurant/${known.restaurantId}`

  if (!live) {
    return (
      <main className="page">
        <Link to={back} className="back-link">
          ← {restaurant?.name || 'Podnik'}
        </Link>
        <h1>Nabídka už neplatí</h1>
        <p className="deal-warning">{known.headline} se nezobrazuje jako aktivní sleva.</p>
      </main>
    )
  }

  const source = httpUrl(detail?.body?.sourceUrl)
  const code = typeof detail?.body?.code === 'string' ? detail.body.code : ''

  const onCopy = async () => {
    const result = await copyText(code, navigator.clipboard)
    setCopyState(result.ok ? 'Kód je ve schránce.' : 'Kód se nepodařilo zkopírovat. Označ ho a zkopíruj ručně.')
  }

  return (
    <main className="page deal-page">
      <Link to={back} className="back-link">
        ← {restaurant?.name || 'Podnik'}
      </Link>
      <p className="detail-kicker">{restaurant?.name || 'Restaurace'}</p>
      <h1>{live.headline}</h1>
      <p className="deal-warning" role="note">
        {dealValidityNote(live)}
        {live.validUntil ? ` Uvedený konec: ${live.validUntil}.` : ''} Kontrola {live.checkedAt}.
      </p>

      {!session.ready ? <p>Načítám účet…</p> : null}

      {session.ready && !session.authenticated ? (
        <section className="deal-panel">
          <h2>Podrobnosti jsou až po přihlášení</h2>
          <p>
            Štítek je veřejný. Kód, podmínky a postup CheapEats ukáže přihlášenému účtu. Restaurace tímhle účtem
            slevu nepodmiňuje.
          </p>
          <Link to={loginPath(here)} className="btn btn-primary">
            Přihlásit se
          </Link>
          <Link to={loginPath(here, 'signup')} className="btn btn-secondary">
            Vytvořit účet
          </Link>
        </section>
      ) : null}

      {session.authenticated && !detail && !detailError ? <p>Načítám postup…</p> : null}
      {session.authenticated && detailError ? (
        <p className="deal-warning">Postup se nepodařilo načíst.</p>
      ) : null}
      {session.authenticated && detail?.status === 401 ? (
        <p className="deal-warning">
          Relace vypršela.{' '}
          <Link to={loginPath(here)}>Přihlas se znovu</Link>
        </p>
      ) : null}
      {session.authenticated && detail?.status === 503 ? (
        <p className="deal-warning">{detail.body?.message || 'Přihlášení není zapnuté.'}</p>
      ) : null}
      {session.authenticated && detail?.body?.ok ? (
        <section className="deal-panel">
          {detail.body.studentOnly ? <p>Jen s platným studentským průkazem, který zdroj uvádí.</p> : null}
          {detail.body.requiresLoyaltyApp ? <p>Vyžaduje externí věrnostní aplikaci restaurace.</p> : null}
          <h2>Podmínky</h2>
          <ul className="deal-steps">
            {detail.body.conditions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h2>Jak ji uplatnit</h2>
          <ol className="deal-steps">
            {detail.body.steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          {code ? (
            <div className="deal-code">
              <p>
                Kód: <strong>{code}</strong>
              </p>
              <button type="button" className="btn btn-primary" onClick={onCopy}>
                Zkopírovat kód
              </button>
              {copyState ? <p role="status">{copyState}</p> : null}
            </div>
          ) : (
            <p>Tahle nabídka nemá kód.</p>
          )}
          {source ? (
            <p>
              <a href={source} target="_blank" rel="noopener noreferrer">
                Zdroj nabídky
              </a>
            </p>
          ) : null}
        </section>
      ) : null}
    </main>
  )
}
