import { Link, useParams } from 'react-router-dom'
import { getRestaurantById, mapsNavigateUrl } from '../data/restaurants'
import { PRICE_CATEGORY_LABELS, getCategoryMeta } from '../constants/filters'
import { getRestaurantCategory } from '../utils/restaurantTags'
import { formatPlacePrice, hasEstimatePrice, hasVerifiedPrice } from '../utils/price'
import {
  formatReviewCount,
  hasGoogleRating,
  mapsLinkFor,
} from '../utils/googleRating'
import { officialWebsiteOf } from '../utils/website'
import { buildDetailParagraphs, cardExcerpt, studentFacts } from '../utils/placeCopy'
import StarRating from '../components/StarRating'
import FoodHero from '../components/FoodHero'
import { presentRouteDistance } from '../utils/routeDistance'
import { useLocationState } from '../context/LocationContext'

export default function RestaurantDetail() {
  const { id } = useParams()
  const { attachDistances } = useLocationState()
  const restaurant = getRestaurantById(id)

  if (!restaurant) {
    return (
      <main className="page detail-page">
        <p>Restaurace nenalezena.</p>
        <Link to="/results" className="btn btn-secondary">
          Zpět na výsledky
        </Link>
      </main>
    )
  }

  const {
    name,
    type,
    address,
    googleRating,
    googleReviewCount,
    googleMapsUrl,
    googleRatingCheckedAt,
    priceCategory,
    priceSource,
    priceVerifiedAt,
    priceChannel,
    priceNote,
    priceConfidence,
    priceItem,
    lunchMenu,
  } = restaurant

  const officialWeb = officialWebsiteOf(restaurant)
  const priceDisplay = formatPlacePrice(restaurant)
  const categoryLabel =
    hasVerifiedPrice(restaurant) && priceCategory && PRICE_CATEGORY_LABELS[priceCategory]
      ? PRICE_CATEGORY_LABELS[priceCategory]
      : null
  const foodCategory = getRestaurantCategory(restaurant)
  const foodMeta = getCategoryMeta(foodCategory)
  const paragraphs = buildDetailParagraphs(restaurant)
  const facts = studentFacts(restaurant)
  const googleOk = hasGoogleRating(restaurant)
  const mapsUrl = mapsLinkFor(restaurant)
  const located = attachDistances([restaurant])[0]
  const distanceKm = located?.distanceKm
  const distanceState = located?.distanceState
  const distance = presentRouteDistance(distanceKm, distanceState)
  const lede = cardExcerpt(restaurant, 220)
  const verified = hasVerifiedPrice(restaurant)
  const estimated = hasEstimatePrice(restaurant)

  return (
    <main className={`page detail-page theme-${foodCategory || 'default'}`}>
      <Link to="/results" className="back-link">
        ← Výsledky
      </Link>

      <article className="detail-shell">
        <header className="detail-hero">
          <div className="detail-hero-copy">
            <p className="detail-kicker">{foodMeta ? foodMeta.label : type}</p>
            <h1 className="detail-title">{name}</h1>
            <p className="detail-lede">{lede}</p>
          </div>
          <FoodHero restaurant={restaurant} />
        </header>

        <dl className="detail-metrics">
          <div className="detail-metric">
            <dt>{priceDisplay.statusLabel || 'Cena'}</dt>
            <dd className={`detail-stat-value--${priceDisplay.tone || 'missing'}`}>
              {priceDisplay.primary}
            </dd>
            {priceDisplay.caption ? <p className="detail-metric-note">{priceDisplay.caption}</p> : null}
          </div>
          <div className="detail-metric">
            <dt>Typ kuchyně</dt>
            <dd>{type}</dd>
          </div>
          <div className="detail-metric">
            <dt>Vzdálenost</dt>
            <dd
              aria-label={
                distanceState === 'loading' || distanceState === 'locating'
                  ? 'Počítám pěší vzdálenost'
                  : undefined
              }
            >
              {distance.value}
              {distanceState === 'route' ? ' pěšky' : ''}
            </dd>
            {distance.caption && distanceState !== 'route' ? (
              <p className="detail-metric-note">{distance.caption}</p>
            ) : null}
          </div>
          <div className="detail-metric">
            <dt>Adresa</dt>
            <dd className="detail-metric-address">{address}</dd>
          </div>
        </dl>

        {facts.length > 0 || categoryLabel ? (
          <ul className="place-facts">
            {categoryLabel ? <li className="place-fact">{categoryLabel}</li> : null}
            {facts.map((fact) => (
              <li key={fact.key} className="place-fact">
                {fact.label}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="detail-actions">
          {officialWeb ? (
            <a href={officialWeb} target="_blank" rel="noopener noreferrer" className="btn btn-official">
              Oficiální web
            </a>
          ) : null}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
            Google Maps
          </a>
          <a
            href={mapsNavigateUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Navigovat
          </a>
        </div>

        <section className="detail-section">
          <h2 className="detail-section-title">O podniku</h2>
          {paragraphs.map((p, i) => (
            <p key={i} className="detail-description">
              {p}
            </p>
          ))}
        </section>

        <section className="detail-section">
          <h2 className="detail-section-title">Ceny</h2>
          {verified ? (
            <>
              <p className="detail-description">
                {priceDisplay.primary}
                {priceItem ? ` · ${priceItem}` : ''}
                {categoryLabel ? ` · ${categoryLabel}` : ''}
              </p>
              <p className="detail-address">
                Ověřeno {priceVerifiedAt}
                {priceChannel === 'delivery' ? ' (rozvoz)' : ' (provozovna)'}
                {priceSource ? (
                  <>
                    {' '}
                    v{' '}
                    <a href={priceSource} target="_blank" rel="noopener noreferrer">
                      zdroji menu
                    </a>
                    .
                  </>
                ) : (
                  '.'
                )}
              </p>
            </>
          ) : estimated ? (
            <p className="detail-description">
              {priceConfidence === 'low'
                ? 'Orientační odhad · nízká jistota. '
                : 'Toto není ověřená cena z menu. '}
              {priceDisplay.primary}. {priceNote}
            </p>
          ) : (
            <p className="detail-description">Cena z menu není ověřená.</p>
          )}
        </section>

        {priceSource || lunchMenu ? (
          <section className="detail-section">
            <h2 className="detail-section-title">Menu</h2>
            {lunchMenu ? (
              <p className="detail-description">
                V OpenStreetMap je u podniku vyznačené polední menu.
              </p>
            ) : null}
            {priceSource ? (
              <p className="detail-description">
                Aktuální nabídku ověř v{' '}
                <a href={priceSource} target="_blank" rel="noopener noreferrer">
                  zdroji cen
                </a>
                {officialWeb ? (
                  <>
                    {' '}
                    nebo na{' '}
                    <a href={officialWeb} target="_blank" rel="noopener noreferrer">
                      oficiálním webu
                    </a>
                  </>
                ) : null}
                .
              </p>
            ) : officialWeb ? (
              <p className="detail-description">
                Nabídku hledej na{' '}
                <a href={officialWeb} target="_blank" rel="noopener noreferrer">
                  oficiálním webu
                </a>
                .
              </p>
            ) : null}
          </section>
        ) : null}

        {googleOk ? (
          <section className="detail-section">
            <h2 className="detail-section-title">Hodnocení na Google</h2>
            <StarRating rating={googleRating} reviewCount={googleReviewCount} size="lg" />
            {typeof googleReviewCount === 'number' ? (
              <p className="detail-address">{formatReviewCount(googleReviewCount)}</p>
            ) : null}
            {googleRatingCheckedAt ? (
              <p className="detail-address">Ověřeno {googleRatingCheckedAt}</p>
            ) : null}
            {googleMapsUrl ? (
              <p className="detail-address">
                <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                  Profil pobočky na Google Maps
                </a>
              </p>
            ) : null}
          </section>
        ) : null}
      </article>
    </main>
  )
}
