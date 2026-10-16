import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'

export default function Header() {
  const { pathname } = useLocation()
  const onResults = pathname.startsWith('/results') || pathname.startsWith('/restaurant')
  const onBusiness = pathname.startsWith('/pro-podniky')

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          <Logo size={38} />
          <span className="brand-text">
            CheapEats <em>Brno</em>
          </span>
        </Link>
        <nav className="header-actions" aria-label="Hlavní navigace">
          {onResults ? (
            <Link to="/results" className="header-link">
              Výsledky
            </Link>
          ) : (
            <Link to="/results" className="btn btn-header">
              Najít jídlo
            </Link>
          )}
          <Link
            to="/pro-podniky"
            className={`header-link${onBusiness ? ' is-active' : ''}`}
            aria-current={onBusiness ? 'page' : undefined}
          >
            Pro podniky
          </Link>
        </nav>
      </div>
    </header>
  )
}
