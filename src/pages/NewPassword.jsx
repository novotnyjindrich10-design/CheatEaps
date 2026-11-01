import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { takeResetNext } from '../utils/authReturn'
import {
  parseRecoveryLink,
  recoveryFailureMessage,
  recoveryPrepareBody,
  stripRecoveryParams,
} from '../utils/recoveryLink'

export default function NewPassword() {
  const { refresh } = useAuth()
  const [recovery] = useState(() => parseRecoveryLink(window.location.href))
  const [continueTo] = useState(() => takeResetNext(window.sessionStorage))
  const [prepareBody] = useState(() => recoveryPrepareBody(recovery))
  const [phase, setPhase] = useState(() => {
    if (recovery.status !== 'ready') return recovery.status
    return prepareBody ? 'loading' : 'missing'
  })
  const [detail, setDetail] = useState(recovery.error || '')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const next = stripRecoveryParams(window.location.href)
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [])

  useEffect(() => {
    if (!prepareBody) return undefined
    let cancelled = false
    fetch('/api/auth/prepare-recovery', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(prepareBody),
    })
      .then((response) => response.json().catch(() => ({})))
      .then((payload) => {
        if (cancelled) return
        if (!payload.ok || payload.ready !== true) {
          setDetail(payload.error || payload.message || '')
          setPhase('invalid')
          setError(payload.message || recoveryFailureMessage('invalid'))
          return
        }
        setPhase('ready')
        setError('')
      })
      .catch(() => {
        if (cancelled) return
        setPhase('invalid')
        setError('Služba přihlášení teď neodpovídá.')
      })
    return () => {
      cancelled = true
    }
  }, [prepareBody])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== again) {
      setError('Hesla se neshodují.')
      return
    }
    setPending(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.ok || body.passwordUpdated !== true) {
        setError(body.message || 'Heslo se nepodařilo změnit.')
        if (body.error === 'link-expired') setPhase('invalid')
        return
      }
      setDone(true)
      await refresh()
    } catch {
      setError('Služba přihlášení teď neodpovídá.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page auth-page">
      <h1>Nové heslo</h1>

      {phase === 'loading' ? <p className="page-subtitle">Ověřuju odkaz z e-mailu…</p> : null}

      {phase !== 'ready' && phase !== 'loading' && !done ? (
        <section className="deal-panel">
          <p className="deal-warning" role="alert">
            {error || recoveryFailureMessage(phase, detail)}
          </p>
          <Link to="/prihlaseni?obnova=1" className="btn btn-primary">
            Poslat nový odkaz
          </Link>
          <Link to="/prihlaseni" className="btn btn-secondary">
            Zpět na přihlášení
          </Link>
        </section>
      ) : null}

      {phase === 'ready' && !done ? (
        <form className="auth-form" onSubmit={onSubmit}>
          <p className="page-subtitle">Odkaz z e-mailu je platný. Zadej nové heslo a potvrď ho.</p>
          <label>
            Nové heslo
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              required
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label>
            Heslo znovu
            <input
              type="password"
              autoComplete="new-password"
              value={again}
              required
              minLength={8}
              onChange={(event) => setAgain(event.target.value)}
            />
          </label>
          {error ? (
            <p className="deal-warning" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Ukládám…' : 'Uložit heslo'}
          </button>
        </form>
      ) : null}

      {done ? (
        <section className="deal-panel">
          <p role="status">Heslo je změněné. Můžeš se přihlásit nebo pokračovat do CheapEats.</p>
          <Link to="/prihlaseni" className="btn btn-primary">
            Přejít na přihlášení
          </Link>
          <Link to={continueTo} className="btn btn-secondary">
            Pokračovat do aplikace
          </Link>
        </section>
      ) : null}
    </main>
  )
}
