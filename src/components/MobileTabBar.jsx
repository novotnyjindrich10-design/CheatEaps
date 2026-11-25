import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/authSession'
import { loginPath } from '../utils/authReturn'
import { clearScrollPosition } from '../utils/scrollRestore'
import { emitTabReselect, scrollViewportToTop } from '../utils/navReselect'
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

function tabIdFor(to) {
  if (to === '/') return 'home'
  if (to === '/results?view=map') return 'map'
  if (to === '/results') return 'search'
  if (to === '/oblibene') return 'favorites'
  return 'profile'
}

const TABS = [
  { to: '/', label: 'Domů', Icon: IconHome },
  { to: '/results', label: 'Hledat', Icon: IconSearch },
  { to: '/results?view=map', label: 'Mapa', Icon: IconMap },
  { to: '/oblibene', label: 'Oblíbené', Icon: IconHeart },
]

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const returnTo = `${location.pathname}${location.search || ''}`
  const profileTo = session.authenticated ? '/oblibene#ucet' : loginPath(returnTo)
  const profileLabel = session.authenticated ? 'Účet' : 'Profil'
  const profileActive =
    location.hash === '#ucet' ||
    location.pathname === '/prihlaseni' ||
    location.pathname === '/registrace'

  if (location.pathname.startsWith('/admin')) return null

  const handleActiveTap = (event, tab, pathKey) => {
    event.preventDefault()
    clearScrollPosition(pathKey)
    emitTabReselect(tab)
    scrollViewportToTop()
    if (tab === 'profile' && location.hash !== '#ucet' && session.authenticated) {
      navigate('/oblibene#ucet', { replace: true })
    }
  }

  return (
    <nav className="mobile-tabbar" aria-label="Hlavní mobilní navigace">
      <ul className="mobile-tabbar-list">
        {TABS.map(({ to, label, Icon }) => {
          const active =
            to === '/oblibene'
              ? location.pathname === '/oblibene' && location.hash !== '#ucet'
              : isTabActive(location.pathname, location.search, to)
          const tab = tabIdFor(to)
          const pathKey = to.includes('?') || to.includes('#') ? to : `${to}${location.search || ''}`
          return (
            <li key={to}>
              <Link
                to={to}
                className={`mobile-tabbar-link${active ? ' is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={active ? (event) => handleActiveTap(event, tab, pathKey === '/' ? '/' : to) : undefined}
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
            onClick={
              profileActive
                ? (event) => handleActiveTap(event, 'profile', profileTo)
                : undefined
            }
          >
            <IconUser />
            <span>{profileLabel}</span>
          </Link>
        </li>
      </ul>
    </nav>
  )
}
