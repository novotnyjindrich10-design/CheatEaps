import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'
import { IconHeart, IconHome, IconMap, IconSearch, IconUser } from './navIcons'

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
