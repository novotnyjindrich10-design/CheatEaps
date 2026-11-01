import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'

function isActive(pathname, to) {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function Header() {
  const location = useLocation()
  const { pathname } = location
  const { session, logout } = useAuth()
  const returnTo = `${pathname}${location.search || ''}`
  const pathKey = `${pathname}${location.search || ''}`
  const [open, setOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathKey)
  const [adminFlag, setAdminFlag] = useState(false)
  const menuId = useId()
  const rootRef = useRef(null)
  const firstItemRef = useRef(null)

  if (menuPath !== pathKey) {
    setMenuPath(pathKey)
    if (open) setOpen(false)
  }

  const isAdmin = Boolean(session.authenticated && adminFlag)

  useEffect(() => {
    if (!session.authenticated) return undefined
    let cancelled = false
    fetch('/api/admin/me', { credentials: 'same-origin' })
      .then((res) => res.json().catch(() => ({})))
      .then((body) => {
        if (!cancelled) setAdminFlag(Boolean(body?.admin))
      })
      .catch(() => {
        if (!cancelled) setAdminFlag(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.authenticated, session.email])

  useEffect(() => {
    if (!open) return undefined

    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    const focusTimer = window.setTimeout(() => firstItemRef.current?.focus(), 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.clearTimeout(focusTimer)
    }
  }, [open])

  const links = [
    { to: '/results', label: 'Najít jídlo' },
    { to: '/oblibene', label: 'Oblíbené' },
    { to: '/pro-podniky', label: 'Pro podniky' },
    { to: '/podpor-me', label: 'Podpoř mě' },
  ]

  if (isAdmin) {
    links.push({ to: '/admin/zadosti', label: 'Administrace žádostí' })
  }

  return (
    <header className="site-header">
      <div className="site-header-inner" ref={rootRef}>
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <Logo size={48} />
          <span className="brand-text">
            CheapEats <em>Brno</em>
          </span>
        </Link>

        <div className="header-menu">
          <button
            type="button"
            className={`header-menu-toggle${open ? ' is-open' : ''}`}
            aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="header-menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <nav
            id={menuId}
            className={`header-menu-panel${open ? ' is-open' : ''}`}
            aria-label="Hlavní menu"
            aria-hidden={!open}
            inert={!open ? true : undefined}
          >
            <div className="header-menu-panel-head">
              <p>Menu</p>
              <button
                type="button"
                className="header-menu-close"
                aria-label="Zavřít menu"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>

            <ul className="header-menu-list">
              {links.map((item, index) => {
                const active = isActive(pathname, item.to)
                return (
                  <li key={item.to}>
                    <Link
                      ref={index === 0 ? firstItemRef : undefined}
                      to={item.to}
                      className={`header-menu-link${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}

              {session.authenticated ? (
                <>
                  <li className="header-menu-account" aria-label="Přihlášený účet">
                    {session.email}
                  </li>
                  <li>
                    <button
                      type="button"
                      className="header-menu-link header-menu-button"
                      onClick={() => {
                        setOpen(false)
                        logout()
                      }}
                    >
                      Odhlásit
                    </button>
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    to={loginPath(returnTo)}
                    className={`header-menu-link${pathname.startsWith('/prihlaseni') ? ' is-active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    Přihlášení
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  )
}
