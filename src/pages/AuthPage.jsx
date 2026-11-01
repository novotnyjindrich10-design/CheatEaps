import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { rememberResetNext, postLoginTarget } from '../utils/authReturn'

const SETUP_STEPS = [
  'V Supabase založ projekt a v Authentication → Providers nech zapnutý e-mail.',
  'Authentication → URL Configuration: Site URL nastav na adresu CheapEats (lokálně např. http://127.0.0.1:5173, na Vercelu produkční https://…).',
  'Do Redirect URLs přidej /nove-heslo pro lokál i produkci (nebo /** na stejné doméně).',
  'Do .env / Vercel Environment Variables doplň SUPABASE_URL a SUPABASE_ANON_KEY. Bez předpony VITE_, ať se klíč nedostane do prohlížeče.',
  'V SQL editoru spusť supabase/bootstrap-all.sql (a případně business-applications-form-v2.sql).',
  'Restartuj vývojový server, nebo znovu nasaď Vercel, který obsluhuje /api.',
]

export default function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = postLoginTarget(params.toString())
  const { session, submit } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const signup = mode === 'signup'
  const recover = !signup && params.get('obnova') === '1'

  const onRecover = async (event) => {
    event.preventDefault()
    setError('')
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
        if (body.error === 'redirect-not-allowed') {
          setError(
            body.message ||
              'Návratová adresa není připravená. V Supabase doplň Redirect URLs pro /nove-heslo a obnov stránku.',
          )
        } else {
          setError(body.message || 'E-mail s odkazem se neposlal.')
        }
        return
      }
      rememberResetNext(next, window.sessionStorage)
      setError('')
      setNotice(body.message)
    } catch {
      setNotice('')
      setError('Služba přihlášení teď neodpovídá.')
    } finally {
      setPending(false)
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      const result = await submit(signup ? '/api/auth/signup' : '/api/auth/login', email, password)
      if (result.body?.needsConfirmation) {
        setNotice(result.body.message || 'Potvrď e-mail a pak se přihlas.')
        return
      }
      if (!result.ok || !result.body?.authenticated) {
        setError(result.body?.message || 'Přihlášení se nepovedlo.')
        return
      }
      navigate(next, { replace: true })
    } catch {
      setError('Služba přihlášení teď neodpovídá.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="page auth-page">
      <Link to={next} className="back-link">
        ← Zpět k nabídce
      </Link>
      <h1>{signup ? 'Registrace' : recover ? 'Zapomenuté heslo' : 'Přihlášení'}</h1>
      <p className="page-subtitle">
        Účet CheapEats odemkne kód a postup uplatnění. Restaurace kvůli tomu svůj ceník nemění.
      </p>

      {session.unreachable ? (
        <p className="deal-warning" role="status">
          Server přihlášení neodpovídá. Ve vývoji ho umí Vite, samotný statický build ne.
        </p>
      ) : null}

      {!session.ready ? <p className="page-subtitle">Načítám stav účtu…</p> : null}

      {session.ready && !session.configured ? (
        <section className="deal-panel">
          <h2>Přihlášení ještě není zapnuté</h2>
          <ol className="deal-steps">
            {SETUP_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {session.configured && recover ? (
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
            <p className="deal-warning" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          {notice ? (
            <p className="detail-metric-note">
              Když e-mail nepřijde do pár minut, zkontroluj spam a jestli je účet opravdu registrovaný pod touhle
              adresou. Pak můžeš poslat odkaz znovu.
            </p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Posílám…' : notice ? 'Poslat odkaz znovu' : 'Poslat odkaz'}
          </button>
        </form>
      ) : null}

      {session.configured && !recover ? (
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
            <p className="deal-warning" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p role="status">{notice}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Posílám…' : signup ? 'Vytvořit účet' : 'Přihlásit se'}
          </button>
          {signup ? null : (
            <Link className="auth-forgot" to={`/prihlaseni?obnova=1&next=${encodeURIComponent(next)}`}>
              Zapomněl jsem heslo?
            </Link>
          )}
        </form>
      ) : null}

      <p className="page-subtitle">
        {recover ? (
          <Link to={`/prihlaseni?next=${encodeURIComponent(next)}`}>Zpět na přihlášení</Link>
        ) : signup ? (
          <Link to={`/prihlaseni?next=${encodeURIComponent(next)}`}>Už účet mám</Link>
        ) : (
          <Link to={`/registrace?next=${encodeURIComponent(next)}`}>Nemám účet</Link>
        )}
      </p>
    </main>
  )
}
