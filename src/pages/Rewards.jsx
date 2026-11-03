import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'

export default function Rewards() {
  const { session } = useAuth()
  const [data, setData] = useState(null)
  const [redemptions, setRedemptions] = useState([])
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [flash, setFlash] = useState(null)

  async function load() {
    setError('')
    try {
      const rewardsRes = await fetch('/api/loyalty/rewards', { credentials: 'same-origin' })
      const rewardsBody = await rewardsRes.json().catch(() => ({}))
      if (!rewardsRes.ok || !rewardsBody.ok) {
        setError(rewardsBody.message || 'Odměny se nepodařilo načíst.')
        return
      }
      setData(rewardsBody)
      if (session.authenticated) {
        const [redRes, histRes] = await Promise.all([
          fetch('/api/loyalty/redemptions', { credentials: 'same-origin' }),
          fetch('/api/loyalty/history', { credentials: 'same-origin' }),
        ])
        const redBody = await redRes.json().catch(() => ({}))
        const histBody = await histRes.json().catch(() => ({}))
        if (redBody.ok) setRedemptions(redBody.redemptions || [])
        if (histBody.ok) setHistory(histBody.transactions || [])
      } else {
        setRedemptions([])
        setHistory([])
      }
    } catch {
      setError('Odměny se nepodařilo načíst.')
    }
  }

  useEffect(() => {
    load()
  }, [session.authenticated])

  async function redeem(rewardId) {
    if (!session.authenticated) return
    setBusyId(rewardId)
    setFlash(null)
    setError('')
    try {
      const res = await fetch('/api/loyalty/redeem', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.ok) {
        setError(body.message || 'Uplatnění se nepovedlo.')
        return
      }
      setFlash({ code: body.code, message: body.message })
      await load()
    } catch {
      setError('Uplatnění se nepovedlo.')
    } finally {
      setBusyId('')
    }
  }

  const points = data?.points
  const missing = data?.pointsMissing
  const nextCost = data?.nextRewardCost

  return (
    <main className="page loyalty-page">
      <div className="page-head">
        <Link to="/" className="back-link">
          ← Domů
        </Link>
        <h1>Slevy a odměny</h1>
        <p className="page-subtitle">
          Za schválenou recenzi získáš {data?.reviewRewardPoints ?? 5} bodů. Body spravuje server — nejde je
          upravit z prohlížeče.
        </p>
      </div>

      <section className="loyalty-balance" aria-labelledby="loyalty-balance-title">
        <h2 id="loyalty-balance-title" className="section-title">
          Tvoje body
        </h2>
        {session.authenticated ? (
          <>
            <p className="loyalty-points">
              <strong>{points == null ? '…' : points}</strong> bodů
            </p>
            {nextCost != null ? (
              <p className="section-desc">
                Do další odměny za {nextCost} bodů ti chybí <strong>{missing}</strong>.
              </p>
            ) : (
              <p className="section-desc">Máš dost bodů na všechny zveřejněné odměny, nebo zatím žádná nečeká.</p>
            )}
            <p className="loyalty-account-links">
              <a href="#loyalty-history">Historie bodů</a>
              {' · '}
              <a href="#loyalty-redemptions">Uplatněné odměny</a>
            </p>
          </>
        ) : (
          <p className="section-desc">
            <Link to={loginPath('/odmeny')}>Přihlas se</Link>, ať vidíš zůstatek a můžeš uplatnit odměnu.
          </p>
        )}
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {flash ? (
        <div className="loyalty-flash" role="status">
          <p>{flash.message}</p>
          <p className="loyalty-code">
            Kód: <code>{flash.code}</code>
          </p>
        </div>
      ) : null}

      <section className="loyalty-rewards" aria-labelledby="loyalty-rewards-title">
        <h2 id="loyalty-rewards-title" className="section-title">
          Dostupné odměny
        </h2>
        <ul className="loyalty-reward-list">
          {(data?.rewards || []).map((reward) => {
            const coming = reward.status === 'coming_soon' || reward.label === 'Připravujeme'
            const canRedeem =
              session.authenticated && !coming && reward.status === 'available' && points != null && points >= reward.pointsCost
            return (
              <li key={reward.id} className={`loyalty-reward-card${coming ? ' is-soon' : ''}`}>
                <div className="loyalty-reward-top">
                  <h3>{reward.title}</h3>
                  <span className="loyalty-reward-badge">{reward.label}</span>
                </div>
                {reward.partnerName ? <p className="loyalty-partner">{reward.partnerName}</p> : null}
                <p className="section-desc">{reward.description}</p>
                <p className="loyalty-cost">
                  <strong>{reward.pointsCost}</strong> bodů
                </p>
                {reward.terms ? <p className="loyalty-terms">{reward.terms}</p> : null}
                {coming ? (
                  <p className="loyalty-soon-note">Připravujeme — bez dodaných kódů body neodečteme.</p>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canRedeem || busyId === reward.id}
                    onClick={() => redeem(reward.id)}
                  >
                    {busyId === reward.id ? 'Uplatňuji…' : 'Uplatnit odměnu'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        {(data?.rewards || []).length === 0 && !error ? (
          <p className="empty-state">Zatím tu nejsou žádné odměny.</p>
        ) : null}
      </section>

      {session.authenticated ? (
        <>
          <section id="loyalty-redemptions" className="loyalty-panel" aria-labelledby="loyalty-redemptions-title">
            <h2 id="loyalty-redemptions-title" className="section-title">
              Uplatněné odměny
            </h2>
            {redemptions.length === 0 ? (
              <p className="section-desc">Zatím žádná uplatněná odměna.</p>
            ) : (
              <ul className="loyalty-history-list">
                {redemptions.map((row) => (
                  <li key={row.id}>
                    <strong>{row.title}</strong>
                    <span className="loyalty-code-inline">
                      kód <code>{row.code}</code>
                    </span>
                    <span className="loyalty-meta">−{row.pointsSpent} bodů</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="loyalty-history" className="loyalty-panel" aria-labelledby="loyalty-history-title">
            <h2 id="loyalty-history-title" className="section-title">
              Historie bodů
            </h2>
            {history.length === 0 ? (
              <p className="section-desc">Zatím žádný pohyb bodů.</p>
            ) : (
              <ul className="loyalty-history-list">
                {history.map((row) => (
                  <li key={row.id}>
                    <strong>
                      {row.amount > 0 ? '+' : ''}
                      {row.amount}
                    </strong>
                    <span>{row.note || row.kind}</span>
                    <span className="loyalty-meta">zůstatek {row.balanceAfter ?? row.balance_after}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </main>
  )
}
