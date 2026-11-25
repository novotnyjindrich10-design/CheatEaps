import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'

function isTabActive(pathname, search, to) {
  if (to === '/') return pathname === '/'
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

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16.5 16.5 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 6.5 9.5 4l5 2.5L20 4v13.5L14.5 20l-5-2.5L4 20V6.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 4v13.5M14.5 6.5V20" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 19.5s-6.5-4.1-6.5-8.4A3.6 3.6 0 0 1 12 8.2a3.6 3.6 0 0 1 6.5 2.9c0 4.3-6.5 8.4-6.5 8.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19.2a6.5 6.5 0 0 1 13 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

const TABS = [
  { to: '/', label: 'Domů', Icon: IconHome },
  { to: '/results', label: 'Hledat', Icon: IconSearch },
  { to: '/results?view=map', label: 'Mapa', Icon: IconMap },
  { to: '/oblibene', label: 'Oblíbené', Icon: IconHeart },
]

export default function MobileTabBar() {
  const location = useLocation()
  const { session } = useAuth()
  const returnTo = `${location.pathname}${location.search || ''}`
  const profileTo = session.authenticated ? '/oblibene#ucet' : loginPath(returnTo)
  const profileLabel = session.authenticated ? 'Účet' : 'Profil'
  const profileActive =
    location.hash === '#ucet' ||
    location.pathname === '/prihlaseni' ||
    location.pathname === '/registrace'

  if (location.pathname.startsWith('/admin')) return null

  return (
    <nav className="mobile-tabbar" aria-label="Hlavní mobilní navigace">
      <ul className="mobile-tabbar-list">
        {TABS.map(({ to, label, Icon }) => {
          const active =
            to === '/oblibene'
              ? location.pathname === '/oblibene' && location.hash !== '#ucet'
              : isTabActive(location.pathname, location.search, to)
          return (
            <li key={to}>
              <Link
                to={to}
                className={`mobile-tabbar-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
        <li>
          <Link
            to={profileTo}
            className={`mobile-tabbar-link${profileActive ? ' is-active' : ''}`}
            aria-current={profileActive ? 'page' : undefined}
          >
            <IconUser />
            <span>{profileLabel}</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
