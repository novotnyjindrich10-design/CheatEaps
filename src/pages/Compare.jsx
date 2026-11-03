import { Link } from 'react-router-dom'
import { getRestaurantById } from '../data/restaurants'
import { getCategoryMeta } from '../constants/filters'
import { useCompare } from '../context/CompareContext'
import { useLocationState } from '../context/LocationContext'
import { formatCardPrice } from '../utils/price'
import { dietOfferTag, getRestaurantCategory } from '../utils/restaurantTags'
import { presentOsmContact } from '../utils/osmContact'
import { presentRouteDistance } from '../utils/routeDistance'
import { officialWebsiteOf } from '../utils/website'

function cell(value) {
  const text = String(value || '').trim()
  return text || 'Údaj v katalogu není'
}

export default function Compare() {
  const { ids, remove, clear } = useCompare()
  const { attachDistances } = useLocationState()
  const places = attachDistances(ids.map((id) => getRestaurantById(id)).filter(Boolean))

  return (
    <main className="page compare-page">
      <div className="page-head">
        <Link to="/results" className="back-link">
          ← Zpět na výsledky
        </Link>
        <h1>Porovnání podniků</h1>
        <p className="page-subtitle">Nejvíc tři podniky. Chybějící údaj necháváme prázdný, nedoplňujeme ho odhadem.</p>
      </div>

      {places.length === 0 ? (
        <div className="empty-state">
          <p>Zatím nemáš vybraný žádný podnik. Na kartě v seznamu zvol Porovnat.</p>
          <Link to="/results" className="btn btn-primary">
            Najít podniky
          </Link>
        </div>
      ) : (
        <ul className="compare-list">
          {places.map((place) => {
            const price = formatCardPrice(place)
            const category = getCategoryMeta(getRestaurantCategory(place))
            const diet = dietOfferTag(place)
            const contact = presentOsmContact(place)
            const distance = presentRouteDistance(place.distanceKm, place.distanceState)
            const website = officialWebsiteOf(place)
            return (
              <li key={place.id} className="compare-card">
                <h2>{place.name}</h2>
                <dl>
                  <div>
                    <dt>Typ kuchyně</dt>
                    <dd>{cell(category?.label || place.type)}</dd>
                  </div>
                  <div>
                    <dt>Cena</dt>
                    <dd>
                      {price.primary} · {price.status}
                    </dd>
                  </div>
                  <div>
                    <dt>Lokalita</dt>
                    <dd>{cell(place.address)}</dd>
                  </div>
                  <div>
                    <dt>Vzdálenost</dt>
                    <dd>
                      {distance.value}
                      {distance.caption ? ` (${distance.caption})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Bez masa / vegan</dt>
                    <dd>{diet ? diet.label : 'V datech to doložené není'}</dd>
                  </div>
                  <div>
                    <dt>Telefon</dt>
                    <dd>
                      {contact.hasPhone ? <a href={`tel:${contact.phoneTel}`}>{contact.phoneDisplay}</a> : 'Telefon nemáme'}
                    </dd>
                  </div>
                  <div>
                    <dt>Web</dt>
                    <dd>
                      {website ? (
                        <a href={website} target="_blank" rel="noopener noreferrer">
                          {website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : (
                        'Oficiální web nemáme'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Otevírací doba</dt>
                    <dd>{contact.hasHours ? contact.hoursDisplay : 'Otevírací dobu nemáme'}</dd>
                  </div>
                </dl>
                <div className="compare-card-actions">
                  <Link to={`/restaurant/${place.id}`} className="btn btn-primary">
                    Detail
                  </Link>
                  <button type="button" className="btn btn-secondary" onClick={() => remove(place.id)}>
                    Odebrat
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {places.length > 0 ? (
        <button type="button" className="btn btn-secondary compare-clear" onClick={clear}>
          Zrušit porovnání
        </button>
      ) : null}
    </main>
  )
}
