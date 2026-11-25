import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getRestaurantTags, getRestaurantCategory } from '../utils/restaurantTags'
import { mapsNavigateUrl } from '../data/restaurants'
import { formatCardPrice } from '../utils/price'
import { cardExcerpt } from '../utils/placeCopy'
import { presentRouteDistance } from '../utils/routeDistance'
import { currentInternalPath } from '../utils/internalPath'
import {
  dealHighlightLabel,
  publicDealsForRestaurant,
} from '../data/restaurantDeals'
import { isDealCardVariant } from '../utils/dealCardVariant'
import { resolveCardMedia } from '../utils/cardMedia'
import { presentOsmContact } from '../utils/osmContact'
import CuisineIllustration from './CuisineIllustration'
import { useCompare } from '../context/CompareContext'
import { showSponsoredLabel, SPONSORED_LABEL } from '../constants/monetization'

export default function RestaurantCard({ restaurant, index = 0, variant = 'default' }) {
  const from = currentInternalPath(useLocation())
  const compare = useCompare()
  const inCompare = compare.has(restaurant?.id)
  const [mediaBroken, setMediaBroken] = useState(false)
  const [mediaReady, setMediaReady] = useState(false)
  if (!restaurant?.id) return null

  const isDeal = isDealCardVariant(variant)
  const { id, name, type, address, distanceKm, distanceState } = restaurant
  const distance = presentRouteDistance(distanceKm, distanceState)
  const tags = getRestaurantTags(restaurant)
  const category = getRestaurantCategory(restaurant)
  const priceDisplay = formatCardPrice(restaurant)
  const excerpt = cardExcerpt(restaurant, 110)
  const deals = isDeal ? publicDealsForRestaurant(id) : []
  const primaryDeal = deals[0] ?? null
  const highlight = primaryDeal ? dealHighlightLabel(primaryDeal) : 'Sleva'
  const media = !mediaBroken ? resolveCardMedia(restaurant) : null
  const detailState = { from, ...(Number.isInteger(media?.pixabayId) ? { pixabayId: media.pixabayId } : {}) }
  const contact = presentOsmContact(restaurant)
  const hoursCard = contact.hasHours
    ? contact.hoursDisplay.split('\n').filter(Boolean).join(' · ')
    : null
  const offerHref = primaryDeal
    ? `/nabidka/${encodeURIComponent(primaryDeal.id)}`
    : `/results?deals=1`
  const offerSummary =
    primaryDeal?.description ||
    primaryDeal?.title ||
    primaryDeal?.headline ||
    excerpt

  return (
    <article
      className={`restaurant-card restaurant-card--${category}${isDeal ? ' restaurant-card--deal' : ''}${showSponsoredLabel(restaurant) ? ` restaurant-card--sponsored restaurant-card--sponsored-${restaurant.sponsorship?.planId || 'start'}` : ''}`}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <Link
        to={isDeal ? offerHref : `/restaurant/${id}`}
        state={detailState}
        className="restaurant-card-media-link"
        aria-label={isDeal ? `${name}: ${highlight}` : name}
      >
        <div
          className="restaurant-card-media"
          style={media?.color ? { backgroundColor: media.color } : undefined}
        >
          {media ? (
            <img
              src={media.url}
              srcSet={media.srcSet || undefined}
              sizes={
                media.srcSet
                  ? isDeal
                    ? '(max-width: 720px) 94vw, (max-width: 1100px) 46vw, 520px'
                    : '(max-width: 720px) 92vw, 380px'
                  : undefined
              }
              width={media.width || 940}
              height={media.height || 650}
              alt={media.alt || (media.kind === 'illustration' ? `Ilustrační fotografie – ${name}` : name)}
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
            {priceDisplay.updatedLabel ? (
              <span className="restaurant-card-price-updated">Aktualizováno {priceDisplay.updatedLabel}</span>
            ) : null}
          </span>
          {isDeal ? (
            <span className="restaurant-card-deal-chip" aria-label={`Nabídka: ${highlight}`}>
              {highlight}
            </span>
          ) : null}
          {media?.kind === 'illustration' ? (
            <span className="restaurant-card-media-note">Ilustrační fotografie</span>
          ) : null}
          {!media ? <span className="restaurant-card-media-note">Typ kuchyně</span> : null}
        </div>
      </Link>

      <div className="restaurant-card-body">
        {isDeal ? (
          <>
            <p className="restaurant-card-type">{type}</p>
            <h2 className="restaurant-card-title">{name}</h2>
            {primaryDeal?.title || primaryDeal?.headline ? (
              <p className="restaurant-card-deal-title">{primaryDeal.title || primaryDeal.headline}</p>
            ) : null}
            {offerSummary ? <p className="restaurant-card-desc">{offerSummary}</p> : null}
            {primaryDeal?.studentOnly ? (
              <p className="restaurant-card-deal-term">Vyžaduje ISIC</p>
            ) : null}
            {deals.length > 1 ? (
              <p className="restaurant-card-deal-more">+ další nabídky u tohoto podniku</p>
            ) : null}
          </>
        ) : (
          <Link to={`/restaurant/${id}`} state={detailState} className="restaurant-card-link">
            <div className="restaurant-card-top">
              <p className="restaurant-card-type">{type}</p>
              {showSponsoredLabel(restaurant) ? (
                <p className="sponsored-badge">{SPONSORED_LABEL}</p>
              ) : null}
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
        )}

        <div className={`restaurant-card-meta${isDeal ? '' : ' restaurant-card-meta--distance'}`}>
          <div className="restaurant-card-meta-item">
            <span className="meta-label">Vzdálenost</span>
            <span
              className="meta-value"
              aria-label={
                distanceState === 'locating'
                  ? 'Zjišťuji polohu'
                  : distanceState === 'air-pending'
                    ? 'Vzdušná vzdálenost, počítám pěší trasu'
                    : undefined
              }
            >
              {distance.value}
            </span>
            {distance.caption ? <span className="meta-price-caption">{distance.caption}</span> : null}
          </div>
        </div>

        <div className={`restaurant-card-actions${isDeal ? ' restaurant-card-actions--deal' : ''}`}>
          {isDeal ? (
            <Link to={offerHref} state={{ from }} className="btn btn-card btn-card--primary">
              Zobrazit nabídku
              <span className="btn-card-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ) : (
            <>
              <Link to={`/restaurant/${id}`} state={detailState} className="btn btn-card btn-card--primary">
                Detail
                <span className="btn-card-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <a
                href={mapsNavigateUrl(restaurant)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-card"
              >
                Navigovat
              </a>
              <button
                type="button"
                className={`btn btn-card compare-card-toggle${inCompare ? ' is-on' : ''}`}
                aria-pressed={inCompare}
                onClick={() => compare.toggle(id)}
              >
                {inCompare ? 'V porovnání' : 'Porovnat'}
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  )
}
