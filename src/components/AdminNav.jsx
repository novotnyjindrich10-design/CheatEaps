import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/admin/podniky', label: 'Podniky' },
  { to: '/admin/hlaseni', label: 'Hlášení' },
  { to: '/admin/zadosti', label: 'Žádosti o katalog' },
  { to: '/admin/propagace', label: 'Propagace' },
  { to: '/admin/odmeny', label: 'Recenze a odměny' },
]

export default function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Administrace FoodGo">
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => (isActive ? 'admin-nav-link is-active' : 'admin-nav-link')}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}
