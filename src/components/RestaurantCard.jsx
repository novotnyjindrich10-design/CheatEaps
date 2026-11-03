import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getRestaurantTags, getRestaurantCategory } from '../utils/restaurantTags'
import { mapsNavigateUrl } from '../data/restaurants'
import { formatCardPrice } from '../utils/price'
import { cardExcerpt } from '../utils/placeCopy'
import { presentRouteDistance } from '../utils/routeDistance'
import { currentInternalPath } from '../utils/internalPath'
import { dealBadgesForRestaurant } from '../data/restaurantDeals'
import { resolveCardMedia } from '../utils/cardMedia'
import { presentOsmContact } from '../utils/osmContact'
import CuisineIllustration from './CuisineIllustration'
import { useCompare } from '../context/CompareContext'

export default function RestaurantCard({ restaurant, index = 0 }) {
  const from = currentInternalPath(useLocation())
  const compare = useCompare()
  const inCompare = compare.has(restaurant?.id)
  const [mediaBroken, setMediaBroken] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  if (!restaurant?.id) return null

  const { id, name, type, address, distanceKm, distanceState } = restaurant
  const distance = presentRouteDistance(distanceKm, distanceState)
  const tags = getRestaurantTags(restaurant)
  const category = getRestaurantCategory(restaurant)
  const priceDisplay = formatCardPrice(restaurant)
  const excerpt = cardExcerpt(restaurant, 110)
  const dealBadges = dealBadgesForRestaurant(id)
  const media = !mediaBroken ? resolveCardMedia(restaurant) : null
  const detailState = { from, ...(Number.isInteger(media?.pixabayId) ? { pixabayId: media.pixabayId } : {}) }
  const contact = presentOsmContact(restaurant)
  const hoursCard = contact.hasHours
    ? contact.hoursDisplay.split('\n').filter(Boolean).join(' · ')
    : null

  return (
    <article
      className={`restaurant-card restaurant-card--${category}`}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <Link to={`/restaurant/${id}`} state={detailState} className="restaurant-card-media-link">
        <div
          className="restaurant-card-media"
          style={media?.color ? { backgroundColor: media.color } : undefined}
        >
          {media ? (
            <img
              src={media.url}
              srcSet={media.srcSet || undefined}
              sizes={media.srcSet ? '(max-width: 720px) 92vw, 380px' : undefined}
              width={media.width || 940}
              height={media.height || 650}
              alt={media.kind === 'illustration' ? 'Ilustrační fotografie' : ''}
              className={[media.transparent ? 'is-cutout' : '', mediaReady ? 'is-ready' : 'is-pending']
                .filter(Boolean)
                .join(' ')}
              loading={index < 3 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
              decoding="async"
              referrerPolicy={media.kind === 'official' ? 'no-referrer' : undefined}
              onLoad={() => setMediaReady(true)}
              onError={() => setMediaBroken(true)}
            />
          ) : (
            <CuisineIllustration category={category} />
          )}
          <span className={`restaurant-card-price-chip restaurant-card-price-chip--${priceDisplay.tone}`}>
            <span className="restaurant-card-price-value">{priceDisplay.primary}</span>
            <span className="restaurant-card-price-status">{priceDisplay.status}</span>
          </span>
          {media?.kind === 'illustration' ? (
            <span className="restaurant-card-media-note">Ilustrační fotografie</span>
          ) : null}
          {!media ? <span className="restaurant-card-media-note">Typ kuchyně</span> : null}
        </div>
      </Link>

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

      <div className="restaurant-card-body">
        <Link to={`/restaurant/${id}`} state={detailState} className="restaurant-card-link">
          <div className="restaurant-card-top">
            <p className="restaurant-card-type">{type}</p>
            {tags.length > 0 ? (
              <div className="restaurant-card-tag-row">
                {tags.map((tag) => (
                  <span key={tag.key} className={`tag tag--${tag.tone}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <h2 className="restaurant-card-title">{name}</h2>
          {address ? <p className="restaurant-card-address">{address}</p> : null}
          {hoursCard ? (
            <p className="restaurant-card-hours" title={contact.unverifiedNote}>
              <span className="restaurant-card-hours-label">Otevírací doba</span>
              <span className="restaurant-card-hours-value">{hoursCard}</span>
            </p>
          ) : null}
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

        <div className="restaurant-card-actions">
          <a
            href={mapsNavigateUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-card"
          >
            Navigovat
          </a>
          <Link to={`/restaurant/${id}`} state={detailState} className="btn btn-card btn-card--primary">
            Detail
            <span className="btn-card-arrow" aria-hidden="true">
              →
            </span>
          </Link>
          <button
            type="button"
            className={`btn btn-card compare-card-toggle${inCompare ? ' is-on' : ''}`}
            aria-pressed={inCompare}
            onClick={() => compare.toggle(id)}
          >
            {inCompare ? 'V porovnání' : 'Porovnat'}
          </button>
        </div>
      </div>
    </article>
  )
}
