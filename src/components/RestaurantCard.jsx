import { Link, useLocation } from 'react-router-dom'
import { getRestaurantTags, getRestaurantCategory } from '../utils/restaurantTags'
import { mapsNavigateUrl } from '../data/restaurants'
import { formatCardPrice } from '../utils/price'
import { cardExcerpt } from '../utils/placeCopy'
import { presentRouteDistance } from '../utils/routeDistance'
import { currentInternalPath } from '../utils/internalPath'
import { dealBadgesForRestaurant } from '../data/restaurantDeals'

export default function RestaurantCard({ restaurant, index = 0 }) {
  const from = currentInternalPath(useLocation())
  if (!restaurant?.id) return null
  const { id, name, type, distanceKm, distanceState } = restaurant
  const distance = presentRouteDistance(distanceKm, distanceState)
  const tags = getRestaurantTags(restaurant)
  const category = getRestaurantCategory(restaurant)
  const priceDisplay = formatCardPrice(restaurant)
  const excerpt = cardExcerpt(restaurant)
  const dealBadges = dealBadgesForRestaurant(id)

  return (
    <article
      className={`restaurant-card restaurant-card--${category}`}
      style={{ animationDelay: `${Math.min(index, 16) * 40}ms` }}
    >
      {dealBadges.length > 0 ? (
        <div className="restaurant-card-deals">
          {dealBadges.map((badge) => (
            <Link
              key={badge.label}
              to={
                badge.count > 1
                  ? `/restaurant/${id}#nabidky`
                  : `/nabidka/${encodeURIComponent(badge.dealId)}`
              }
              state={{ from }}
              className="deal-badge"
            >
              {badge.label}
              {badge.count > 1 ? ` · ${badge.count}` : ''}
            </Link>
          ))}
        </div>
      ) : null}
      <Link to={`/restaurant/${id}`} state={{ from }} className="restaurant-card-link">
        <div className="restaurant-card-top">
          <p className="restaurant-card-type">{type}</p>
          {tags.length > 0 && (
            <div className="restaurant-card-tag-row">
              {tags.map((tag) => (
                <span key={tag.key} className={`tag tag--${tag.tone}`}>
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <h2 className="restaurant-card-title">{name}</h2>
        <p className="restaurant-card-desc">{excerpt}</p>
      </Link>

      <div className="restaurant-card-meta restaurant-card-meta--two">
        <div className="restaurant-card-meta-item">
          <span className="meta-label">Cena</span>
          <span className={`meta-value meta-value--price meta-value--${priceDisplay.tone || 'missing'}`}>
            {priceDisplay.primary}
          </span>
          {priceDisplay.status ? (
            <span className={`meta-price-caption meta-price-caption--${priceDisplay.tone || 'missing'}`}>
              {priceDisplay.status}
            </span>
          ) : null}
        </div>
        <div className="restaurant-card-meta-item">
          <span className="meta-label">Vzdálenost</span>
          <span
            className="meta-value"
            aria-label={
              distanceState === 'loading' || distanceState === 'locating'
                ? 'Počítám pěší vzdálenost'
                : undefined
            }
          >
            {distance.value}
          </span>
          {distance.caption ? <span className="meta-price-caption">{distance.caption}</span> : null}
        </div>
      </div>

      <a
        href={mapsNavigateUrl(restaurant)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-card"
      >
        Navigovat
      </a>

      <Link to={`/restaurant/${id}`} state={{ from }} className="btn btn-card">
        Zobrazit detail
        <span className="btn-card-arrow" aria-hidden="true">
          →
        </span>
      </Link>
    </article>
  )
}
