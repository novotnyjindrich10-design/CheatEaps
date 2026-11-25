import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { CONTACT_EMAIL } from '../constants/brand'
import { authGateCopy, rememberResetNext, postLoginTarget } from '../utils/authReturn'

export default function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = postLoginTarget(params.toString())
  const gate = authGateCopy(next)
  const { session, submit } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const signup = mode === 'signup'
  const recover = !signup && params.get('obnova') === '1'
  const contactMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('FOODGO — problém s registrací')}`

  useEffect(() => {
    if (!session.ready || !session.authenticated || recover) return
    navigate(next, { replace: true })
  }, [session.ready, session.authenticated, recover, next, navigate])

  const onRecover = async (event) => {
    event.preventDefault()
    setError('')
    setErrorCode('')
    setNotice('')
    setPending(true)
    try {
      const response = await fetch('/api/auth/recover', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.ok !== true || body.sent !== true) {
        setNotice('')
        setErrorCode(body.error || '')
        if (body.error === 'redirect-not-allowed') {
          setError(body.message || 'Odkaz pro nové heslo se teď nepodařilo připravit. Obnov stránku a zkus to znovu.')
        } else {
          setError(body.message || 'E-mail s odkazem se neposlal.')
        }
        return
      }
      rememberResetNext(next, window.sessionStorage)
      setError('')
      setErrorCode('')
      setNotice(body.message)
    } catch {
      setNotice('')
      setErrorCode('')
      setError('Služba přihlášení teď neodpovídá.')
    } finally {
      setPending(false)
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setErrorCode('')
    setNotice('')
    setPending(true)
    try {
      const result = await submit(signup ? '/api/auth/signup' : '/api/auth/login', email, password)
      if (result.body?.needsConfirmation) {
        setNotice(result.body.message || 'Potvrď e-mail a pak se přihlas.')
        return
      }
      if (!result.ok || !result.body?.authenticated) {
        setErrorCode(result.body?.error || '')
        setError(result.body?.message || 'Přihlášení se nepovedlo.')
        return
      }
      navigate(next, { replace: true })
    } catch {
      setErrorCode('')
      setError('Služba přihlášení teď neodpovídá.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page auth-page">
      <Link to={gate.headline ? '/' : next} className="back-link">
        ← {gate.headline ? 'Zpět domů' : 'Zpět k nabídce'}
      </Link>
      <h1>{signup ? 'Registrace' : recover ? 'Zapomenuté heslo' : 'Přihlášení'}</h1>
      {gate.headline && !recover ? <p className="auth-gate-headline">{gate.headline}</p> : null}
      <p className="page-subtitle">{recover ? 'Pošleme odkaz pro nastavení nového hesla.' : gate.lead}</p>
      {gate.note && !recover ? <p className="location-bar-caption">{gate.note}</p> : null}

      {session.unreachable ? (
        <p className="deal-warning" role="status">
          Stav účtu se nepodařilo ověřit. Formulář necháváme otevřený — zkus se přihlásit, nebo obnov stránku.
        </p>
      ) : null}

      {!session.ready ? <p className="page-subtitle">Načítám stav účtu…</p> : null}

      {session.ready && !session.configured && !session.unreachable ? (
        <p className="deal-warning" role="status">
          Přihlášení teď není k dispozici. Zkus to později.
        </p>
      ) : null}

      {(session.configured || session.unreachable) && recover ? (
        <form className="auth-form" onSubmit={onRecover}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          {error ? (
            <div className="auth-error" role="alert">
              <p className="deal-warning">{error}</p>
              <div className="auth-error-actions">
                <button type="submit" className="btn btn-secondary" disabled={pending}>
                  Zkusit znovu
                </button>
                <a className="btn btn-secondary" href={contactMailto}>
                  Napsat na {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          {notice ? (
            <p className="detail-metric-note">
              Když e-mail nepřijde do pár minut, zkontroluj spam a jestli je účet opravdu registrovaný pod touhle
              adresou. Pak můžeš poslat odkaz znovu.
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={pending}>
            {pending ? 'Posílám…' : notice ? 'Poslat odkaz znovu' : 'Poslat odkaz'}
          </button>
        </form>
      ) : null}

      {(session.configured || session.unreachable) && !recover ? (
        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Heslo
            <input
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              required
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? (
            <div className="auth-error" role="alert">
              <p className="deal-warning">{error}</p>
              {errorCode === 'email-delivery-failed' || errorCode === 'email-not-confirmed' ? (
                <div className="auth-error-actions">
                  <button type="submit" className="btn btn-secondary" disabled={pending}>
                    Zkusit znovu
                  </button>
                  <a className="btn btn-secondary" href={contactMailto}>
                    Napsat na {CONTACT_EMAIL}
                  </a>
                </div>
              ) : null}
            </div>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={pending}>
            {pending ? 'Posílám…' : signup ? 'Vytvořit účet' : 'Přihlásit se'}
          </button>
          {signup ? null : (
            <Link className="auth-forgot" to={`/prihlaseni?obnova=1&next=${encodeURIComponent(next)}`}>
              Zapomněl jsem heslo?
            </Link>
          )}
        </form>
      ) : null}

      {!recover && !signup ? (
        <div className="auth-alt">
          <p className="auth-alt-label">Ještě nemáš účet?</p>
          <Link
            to={`/registrace?next=${encodeURIComponent(next)}`}
            className="btn btn-secondary btn-block auth-register-cta"
          >
            Registrace
          </Link>
        </div>
      ) : null}

      {!recover && signup ? (
        <p className="page-subtitle auth-switch">
          <Link to={`/prihlaseni?next=${encodeURIComponent(next)}`}>Už účet mám — přihlásit se</Link>
        </p>
      ) : null}

      {recover ? (
        <p className="page-subtitle auth-switch">
          <Link to={`/prihlaseni?next=${encodeURIComponent(next)}`}>Zpět na přihlášení</Link>
        </p>
      ) : null}

      <p className="page-subtitle">
        <Link to="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link>
        {' · '}
        <Link to="/obchodni-podminky">Obchodní podmínky</Link>
      </p>
    </main>
  )
}
