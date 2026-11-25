import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'
import {
  IconAdmin,
  IconHeart,
  IconHome,
  IconInfo,
  IconLogout,
  IconMail,
  IconMap,
  IconSearch,
  IconStore,
  IconUser,
} from './navIcons'

function isActive(pathname, search, to, hash = '') {
  if (to === '/') return pathname === '/'
  if (to === '/oblibene') return pathname === '/oblibene' && hash !== '#ucet'
  if (to.includes('#')) {
    const [path, wantHash = ''] = to.split('#')
    return pathname === path && hash === `#${wantHash}`
  }
  const [path, query = ''] = to.split('?')
  if (!(pathname === path || pathname.startsWith(`${path}/`))) return false
  const want = new URLSearchParams(query)
  const have = new URLSearchParams(search || '')
  if ([...want.keys()].length === 0) {
    if (path === '/results') return have.get('view') !== 'map'
    return true
  }
  for (const [key, value] of want.entries()) {
    if (have.get(key) !== value) return false
  }
  return true
}

function NavLinks({
  links,
  pathname,
  search,
  hash = '',
  onNavigate,
  linkClass,
  firstItemRef,
  withIcons = false,
}) {
  return links.map((item, index) => {
    const active = isActive(pathname, search, item.to, hash)
    const Icon = item.Icon
    return (
      <li key={`${item.to}-${item.label}`}>
        <Link
          ref={index === 0 ? firstItemRef : undefined}
          to={item.to}
          className={`${linkClass}${active ? ' is-active' : ''}`}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
        >
          {withIcons && Icon ? (
            <span className="header-menu-icon" aria-hidden="true">
              <Icon />
            </span>
          ) : null}
          <span>{item.label}</span>
        </Link>
      </li>
    )
  })
}

const PRIMARY_LINKS = [
  { to: '/', label: 'Úvod' },
  { to: '/results', label: 'Najít podnik' },
  { to: '/results?view=map', label: 'Mapa' },
  { to: '/oblibene', label: 'Oblíbené' },
]

/** Vedlejší cesty — desktop „Více“. */
const SECONDARY_LINKS = [{ to: '/pro-podniky', label: 'Pro podniky' }]

const MOBILE_PRIMARY_LINKS = [
  { to: '/', label: 'Domů', Icon: IconHome },
  { to: '/results', label: 'Hledat', Icon: IconSearch },
  { to: '/results?view=map', label: 'Mapa', Icon: IconMap },
  { to: '/oblibene', label: 'Oblíbené', Icon: IconHeart },
]

const MOBILE_SECONDARY_LINKS = [
  { to: '/pro-podniky', label: 'Pro podniky', Icon: IconStore },
  { to: '/o-foodgo', label: 'O FoodGo', Icon: IconInfo },
  { to: '/kontakt', label: 'Kontakt', Icon: IconMail },
]

export default function Header() {
  const location = useLocation()
  const { pathname } = location
  const { session, logout } = useAuth()
  const returnTo = `${pathname}${location.search || ''}`
  const pathKey = `${pathname}${location.search || ''}${location.hash || ''}`
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathKey)
  const [adminFlag, setAdminFlag] = useState(false)
  const menuId = useId()
  const moreId = useId()
  const rootRef = useRef(null)
  const moreRef = useRef(null)
  const firstItemRef = useRef(null)
  const toggleRef = useRef(null)
  const closeRef = useRef(null)

  if (menuPath !== pathKey) {
    setMenuPath(pathKey)
    if (open) setOpen(false)
    if (moreOpen) setMoreOpen(false)
  }

  const isAdmin = Boolean(session.authenticated && adminFlag)

  const adminLinks = isAdmin
    ? [
        { to: '/admin/zadosti', label: 'Administrace žádostí', Icon: IconAdmin },
        { to: '/admin/propagace', label: 'Propagace', Icon: IconAdmin },
        { to: '/admin/odmeny', label: 'Odměny a recenze', Icon: IconAdmin },
      ]
    : []

  const moreLinks = [...SECONDARY_LINKS, ...adminLinks.map(({ to, label }) => ({ to, label }))]
  const mobileSecondary = [...MOBILE_SECONDARY_LINKS, ...adminLinks]
  const search = location.search || ''
  const hash = location.hash || ''
  const moreActive = moreLinks.some((item) => isActive(pathname, search, item.to, hash))
  const profileTo = session.authenticated ? '/oblibene#ucet' : loginPath(returnTo)
  const profileLabel = session.authenticated ? 'Účet' : 'Profil'
  const profileActive =
    hash === '#ucet' || pathname.startsWith('/prihlaseni') || pathname.startsWith('/registrace')

  useEffect(() => {
    if (!session.authenticated) {
      setAdminFlag(false)
      return undefined
    }
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
      if (event.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }

    document.documentElement.classList.add('nav-drawer-open')
    document.addEventListener('keydown', onKey)
    const focusTimer = window.setTimeout(() => firstItemRef.current?.focus(), 0)

    return () => {
      document.documentElement.classList.remove('nav-drawer-open')
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(focusTimer)
    }
  }, [open])

  useEffect(() => {
    if (!moreOpen) return undefined

    const onKey = (event) => {
      if (event.key === 'Escape') setMoreOpen(false)
    }
    const onPointer = (event) => {
      if (!moreRef.current?.contains(event.target)) setMoreOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [moreOpen])

  const close = () => setOpen(false)

  return (
    <header className="site-header">
      <div className="site-header-inner" ref={rootRef}>
        <Link to="/" className="brand" onClick={close} aria-label="FOODGO Brno — Domů">
          <Logo height={48} showCity />
        </Link>

        <nav className="header-desktop-nav" aria-label="Hlavní menu">
          <ul className="header-desktop-list">
            <NavLinks
              links={PRIMARY_LINKS}
              pathname={pathname}
              search={search}
              linkClass="header-desktop-link"
            />
            <li className="header-more" ref={moreRef}>
              <button
                type="button"
                className={`header-desktop-link header-more-toggle${moreOpen || moreActive ? ' is-active' : ''}`}
                aria-expanded={moreOpen}
                aria-controls={moreId}
                aria-haspopup="true"
                onClick={() => setMoreOpen((value) => !value)}
              >
                Více
                <span className="header-more-caret" aria-hidden="true" />
              </button>
              <div
                id={moreId}
                className={`header-more-panel${moreOpen ? ' is-open' : ''}`}
                hidden={!moreOpen}
              >
                <ul className="header-more-list">
                  <NavLinks
                    links={moreLinks}
                    pathname={pathname}
                    search={search}
                    onNavigate={() => setMoreOpen(false)}
                    linkClass="header-more-link"
                  />
                </ul>
              </div>
            </li>
          </ul>
          <div className="header-desktop-account">
            {session.authenticated ? (
              <>
                <span className="header-account" title={session.email}>
                  {session.email}
                </span>
                <button type="button" className="header-link header-logout" onClick={logout}>
                  Odhlásit
                </button>
              </>
            ) : (
              <Link
                to={loginPath(returnTo)}
                className={`header-desktop-link header-desktop-link--cta${
                  pathname.startsWith('/prihlaseni') || pathname.startsWith('/registrace')
                    ? ' is-active'
                    : ''
                }`}
              >
                Přihlášení
              </Link>
            )}
          </div>
        </nav>

        <div className="header-menu">
          <button
            type="button"
            ref={toggleRef}
            className="header-menu-toggle"
            aria-label="Otevřít menu"
            aria-expanded={open}
            aria-controls={menuId}
            hidden={open || undefined}
            onClick={() => setOpen(true)}
          >
            <span className="header-menu-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>

      <div
        className={`header-menu-backdrop${open ? ' is-open' : ''}`}
        hidden={!open}
        onClick={close}
        aria-hidden="true"
      />

      <nav
        id={menuId}
        className={`header-menu-drawer${open ? ' is-open' : ''}`}
        aria-label="Mobilní menu"
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="header-menu-drawer-inner">
          <div className="header-menu-panel-head">
            <p>Menu</p>
            <button
              type="button"
              ref={closeRef}
              className="header-menu-close"
              aria-label="Zavřít menu"
              onClick={() => {
                close()
                toggleRef.current?.focus()
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <ul className="header-menu-list">
            <li className="header-menu-group" aria-hidden="true">
              Navigace
            </li>
            <NavLinks
              links={MOBILE_PRIMARY_LINKS}
              pathname={pathname}
              search={search}
              onNavigate={close}
              linkClass="header-menu-link"
              firstItemRef={firstItemRef}
              withIcons
            />
            <li>
              <Link
                to={profileTo}
                className={`header-menu-link${profileActive ? ' is-active' : ''}`}
                aria-current={profileActive ? 'page' : undefined}
                onClick={close}
              >
                <span className="header-menu-icon" aria-hidden="true">
                  <IconUser />
                </span>
                <span>{profileLabel}</span>
              </Link>
            </li>

            <li className="header-menu-group" aria-hidden="true">
              Další
            </li>
            <NavLinks
              links={mobileSecondary}
              pathname={pathname}
              search={search}
              onNavigate={close}
              linkClass="header-menu-link"
              withIcons
            />

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
                      close()
                      logout()
                    }}
                  >
                    <span className="header-menu-icon" aria-hidden="true">
                      <IconLogout />
                    </span>
                    <span>Odhlásit</span>
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link
                  to={loginPath(returnTo)}
                  className={`header-menu-link header-menu-link--cta${
                    pathname.startsWith('/prihlaseni') ? ' is-active' : ''
                  }`}
                  onClick={close}
                >
                  <span className="header-menu-icon" aria-hidden="true">
                    <IconUser />
                  </span>
                  <span>Přihlášení</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      </nav>
    </header>
  )
}
