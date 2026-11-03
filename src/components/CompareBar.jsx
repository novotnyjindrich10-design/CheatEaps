import { Link } from 'react-router-dom'
import { getRestaurantById } from '../data/restaurants'
import { useCompare } from '../context/CompareContext'

export default function CompareBar() {
  const { ids, notice, remove, clear } = useCompare()
  if (ids.length === 0 && !notice) return null
  const places = ids.map((id) => getRestaurantById(id)).filter(Boolean)

  return (
    <div className="compare-bar" aria-label="Porovnání podniků">
      <p className="compare-bar-title">Porovnání ({places.length}/3)</p>
      <ul className="compare-bar-list">
        {places.map((place) => (
          <li key={place.id}>
            <span>{place.name}</span>
            <button type="button" onClick={() => remove(place.id)} aria-label={`Odebrat ${place.name} z porovnání`}>
              Odebrat
            </button>
          </li>
        ))}
      </ul>
      {notice ? (
        <p className="compare-bar-notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="compare-bar-actions">
        <Link to="/porovnani" className="btn btn-primary">
          Porovnat
        </Link>
        <button type="button" className="btn btn-secondary" onClick={clear}>
          Zrušit
        </button>
      </div>
    </div>
  )
}
