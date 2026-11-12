import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { getRestaurantById } from '../data/restaurants'
import { allDealRows, dealValidityNote, publicDealById } from '../data/restaurantDeals'
import { useAuth } from '../context/authSession'
import { copyText } from '../utils/copyText'
import { httpUrl } from '../utils/website'
import { DEALS_RESULTS_PATH, loginPath } from '../utils/authReturn'
import { safeInternalPath } from '../utils/internalPath'

export default function DealDetail() {
  const { dealId } = useParams()
  const location = useLocation()
  const decodedId = decodeURIComponent(dealId || '')
  const known = allDealRows().find((item) => item.id === decodedId) ?? null
  const live = publicDealById(decodedId)
  const restaurant = known ? getRestaurantById(known.restaurantId) : null
  const { session } = useAuth()
  const [detail, setDetail] = useState(null)
  const [detailError, setDetailError] = useState(false)
  const [copyState, setCopyState] = useState('')
  const here = `/nabidka/${encodeURIComponent(decodedId)}`
  const back = safeInternalPath(location.state?.from, DEALS_RESULTS_PATH)
  const backLabel = back === DEALS_RESULTS_PATH || back.startsWith('/results?') ? '← Slevy' : '← Zpět'

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

  if (!session.ready) {
    return (
      <main className="page">
        <Link to={back} className="back-link">
          {backLabel}
        </Link>
        <p className="page-subtitle" role="status">
          Ověřuji přihlášení… Nabídku zatím nezobrazujeme.
        </p>
      </main>
    )
  }

  if (!session.authenticated) {
    return <Navigate to={loginPath(here)} replace />
  }

  const publicSource = httpUrl(known.sourceUrl || live?.sourceUrl)

  if (!live) {
    return (
      <main className="page">
        <Link to={back} className="back-link">
          {backLabel}
        </Link>
        <h1>Nabídka už neplatí</h1>
        <p className="deal-warning">
          {(known.title || known.headline)} se nezobrazuje jako aktivní ověřená sleva.
        </p>
        {publicSource ? (
          <p>
            <a href={publicSource} target="_blank" rel="noopener noreferrer">
              Ověřit nabídku u zdroje
            </a>
          </p>
        ) : null}
      </main>
    )
  }

  const source = httpUrl(detail?.body?.sourceUrl) || publicSource
  const code = typeof detail?.body?.code === 'string' ? detail.body.code : ''

  const onCopy = async () => {
    const result = await copyText(code, navigator.clipboard)
    setCopyState(result.ok ? 'Kód je ve schránce.' : 'Kód se nepodařilo zkopírovat. Označ ho a zkopíruj ručně.')
  }

  return (
    <main className="page deal-page">
      <Link to={back} className="back-link">
        {backLabel}
      </Link>
      <p className="detail-kicker">{restaurant?.name || 'Restaurace'}</p>
      <h1>{live.title || live.headline}</h1>
      {live.description ? <p className="page-subtitle">{live.description}</p> : null}
      <p className="location-bar-caption">
        Prohlížení této nabídky je v FoodGo zdarma. Body se neodečítají. Přihlášení do FoodGo
        nenahrazuje průkaz ISIC.
      </p>
      {live.salePrice != null ? (
        <p>
          Akční cena ze zdroje: <strong>{live.salePrice} Kč</strong>
          {live.originalPrice != null ? ` (původní doložená: ${live.originalPrice} Kč)` : ''}
        </p>
      ) : null}
      {dealValidityNote(live) ? (
        <p className="deal-warning" role="note">
          {dealValidityNote(live)} Kontrola {live.checkedAt}.
        </p>
      ) : (
        <p className="location-bar-caption" role="note">
          Ověřeno {live.checkedAt}
          {live.validUntil && live.sourceHasEndDate ? `, platí do ${live.validUntil}` : ''}.
        </p>
      )}

      <section className="deal-panel">
        {live.studentOnly ? (
          <p className="deal-isic-required">
            <strong>Vyžaduje platný průkaz ISIC.</strong> Přihlášení do FoodGo ho nenahrazuje.
          </p>
        ) : null}
        {live.requiresLoyaltyApp ? <p>Vyžaduje externí věrnostní aplikaci restaurace.</p> : null}
        {live.conditions?.length ? (
          <>
            <h2>Podmínky</h2>
            <ul className="deal-steps">
              {live.conditions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="detail-metric-note">Datum ověření: {live.checkedAt}</p>
        {source ? (
          <p>
            <a href={source} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              Ověřit nabídku
            </a>
          </p>
        ) : null}
      </section>

      {!detail && !detailError ? <p>Načítám postup…</p> : null}
      {detailError ? <p className="deal-warning">Postup se nepodařilo načíst.</p> : null}
      {detail?.status === 401 ? (
        <p className="deal-warning">
          Relace vypršela.{' '}
          <Link to={loginPath(here)}>Přihlas se znovu</Link>
        </p>
      ) : null}
      {detail?.status === 503 ? (
        <p className="deal-warning">{detail.body?.message || 'Přihlášení není zapnuté.'}</p>
      ) : null}
      {detail?.body?.ok ? (
        <section className="deal-panel">
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
        </section>
      ) : null}
    </main>
  )
}
