import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { getRestaurantById, mapsNavigateUrl } from '../data/restaurants'
import { PRICE_CATEGORY_LABELS, getCategoryMeta } from '../constants/filters'
import { getRestaurantCategory } from '../utils/restaurantTags'
import { formatPlacePrice, formatVerifiedDate, hasEstimatePrice, hasVerifiedPrice } from '../utils/price'
import {
  formatReviewCount,
  hasGoogleRating,
  mapsLinkFor,
  osmDirectionsUrl,
} from '../utils/googleRating'
import { httpUrl, officialWebsiteOf } from '../utils/website'
import { safeInternalPath } from '../utils/internalPath'
import { buildDetailParagraphs, cardExcerpt, studentFacts } from '../utils/placeCopy'
import StarRating from '../components/StarRating'
import FoodHero from '../components/FoodHero'
import { presentRouteDistance } from '../utils/routeDistance'
import { useLocationState } from '../context/LocationContext'
import FavoriteButton from '../components/FavoriteButton'
import PlaceReportForm from '../components/PlaceReportForm'
import RestaurantReviews from '../components/RestaurantReviews'
import { presentOsmContact } from '../utils/osmContact'
import { openingStatusNow } from '../utils/openingStatus'
import { fetchWithTimeout } from '../utils/fetchTimeout'
import { applyPixabayChoice } from '../utils/pageIllustrations'
import { applyPageMeta } from '../utils/pageMeta'
import { shareImageUrl } from '../utils/placePhoto'
import { useCatalog } from '../context/CatalogContext'
import { similarRestaurants } from '../utils/similarPlaces'
import { formatSponsorshipRange, partitionPlacements, showSponsoredLabel, SPONSORED_LABEL } from '../constants/monetization'
import { sharePlaceLink } from '../utils/sharePlace'
import { trackProductEvent } from '../utils/productEvents'
import { rememberRecentView } from '../utils/recentViews'
import RestaurantCard from '../components/RestaurantCard'

export default function RestaurantDetail() {
  const { id } = useParams()
  const location = useLocation()
  const backTo = safeInternalPath(location.state?.from, '/results')
  const backLabel = backTo === '/' || backTo.startsWith('/?') ? '← Domů' : '← Zpět'
  const { attachDistances } = useLocationState()
  const { restaurants } = useCatalog()
  const restaurant = restaurants.find((place) => place.id === decodeURIComponent(id ?? '')) ?? getRestaurantById(id)
  const [shareNote, setShareNote] = useState('')

  useEffect(() => {
    if (!restaurant?.id) return
    const restaurantId = restaurant.id
    const sponsored = Boolean(restaurant.sponsored)
    rememberRecentView(restaurantId)
    trackProductEvent('restaurant_detail_open', { restaurantId, sponsored })
    fetchWithTimeout('/api/place-stats/event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ restaurantId, event: 'profile_view' }),
    }).catch(() => {})
  }, [restaurant?.id, restaurant?.sponsored])

  const similar = useMemo(
    () =>
      restaurant
        ? similarRestaurants(partitionPlacements(restaurants).organic, restaurant, 6)
        : [],
    [restaurant, restaurants],
  )

  async function shareCurrent() {
    const result = await sharePlaceLink({
      title: restaurant?.name,
      url: window.location.href,
      share: typeof navigator.share === 'function' ? navigator.share.bind(navigator) : undefined,
      clipboard: navigator.clipboard,
    })
    if (result.reason === 'abort') return
    if (result.method === 'copy') setShareNote('Odkaz je zkopírovaný.')
    else if (result.ok) setShareNote('Sdílení je připravené.')
    else setShareNote('Odkaz se nepodařilo zkopírovat.')
  }

  useEffect(() => {
    if (!restaurant) {
      applyPageMeta({
        title: 'Podnik nenalezen | FoodGo Brno',
        description: 'Tenhle podnik v katalogu FoodGo Brno není.',
        path: `/restaurant/${encodeURIComponent(id || '')}`,
        robots: 'noindex',
      })
      return
    }
    const where = restaurant.address ? `, ${restaurant.address}` : ''
    applyPageMeta({
      title: `${restaurant.name} | FoodGo Brno`,
      description: `${restaurant.name}${where}. Detail v katalogu FoodGo Brno.`.slice(0, 180),
      path: `/restaurant/${encodeURIComponent(restaurant.id)}`,
      image: typeof location !== 'undefined' ? shareImageUrl(restaurant, location.origin) : undefined,
    })
  }, [id, restaurant, location.origin])

  if (!restaurant) {
    return (
      <main className="page detail-page">
        <h1 className="section-title">Restaurace nenalezena</h1>
        <Link to={backTo} className="btn btn-secondary">
          {backLabel}
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
  const menuSource = httpUrl(priceSource)
  const profileUrl = httpUrl(googleMapsUrl)
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
  const contact = presentOsmContact(restaurant)
  const heroRestaurant = applyPixabayChoice(restaurant, location.state?.pixabayId)

  return (
    <main className={`page detail-page theme-${foodCategory || 'default'}`}>
      <Link to={backTo} className="back-link">
        {backLabel}
      </Link>

      <article className="detail-shell">
        <header className="detail-hero">
          <div className="detail-hero-copy">
            <p className="detail-kicker">{foodMeta ? foodMeta.label : type}</p>
            {showSponsoredLabel(restaurant) ? (
              <p className="detail-kicker sponsored-badge">
                {SPONSORED_LABEL}
                {formatSponsorshipRange(restaurant.sponsorship)
                  ? ` · ${formatSponsorshipRange(restaurant.sponsorship)}`
                  : ''}
                . Placená propagace, ne hodnocení návštěvníků.
              </p>
            ) : null}
            <div className="detail-title-row">
              <h1 className="detail-title">{name}</h1>
              <FavoriteButton restaurantId={restaurant.id} />
            </div>
            <p className="detail-lede">{lede}</p>
            {address ? <p className="detail-hero-address">{address}</p> : null}
          </div>
          <FoodHero restaurant={heroRestaurant} />
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
                distanceState === 'locating'
                  ? 'Zjišťuji polohu'
                  : distanceState === 'air-pending'
                    ? 'Vzdušná vzdálenost, počítám pěší trasu'
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
            <dd className="detail-metric-address">{address || 'Adresa není k dispozici'}</dd>
          </div>
          {googleOk ? (
            <div className="detail-metric">
              <dt>Google hodnocení</dt>
              <dd>
                <StarRating rating={googleRating} reviewCount={googleReviewCount} size="sm" />
              </dd>
              {typeof googleReviewCount === 'number' ? (
                <p className="detail-metric-note">{formatReviewCount(googleReviewCount)}</p>
              ) : null}
              {googleRatingCheckedAt ? (
                <p className="detail-metric-note">Ověřeno {googleRatingCheckedAt}</p>
              ) : null}
              {profileUrl ? (
                <p className="detail-metric-note">
                  <a href={profileUrl} target="_blank" rel="noopener noreferrer">
                    Profil na Google Maps
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
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
          {contact.hasPhone ? (
            <a href={`tel:${contact.phoneTel}`} className="btn btn-secondary">
              Zavolat
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
          <a
            href={osmDirectionsUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            OpenStreetMap
          </a>
          <button type="button" className="btn btn-secondary" onClick={shareCurrent}>
            Sdílet odkaz
          </button>
        </div>
        {shareNote ? (
          <p className="detail-source-note" role="status">
            {shareNote}
          </p>
        ) : null}

        <div className="detail-grid">
          <section className="detail-section">
            <h2 className="detail-section-title">O podniku</h2>
            {paragraphs.map((p, i) => (
              <p key={i} className="detail-description">
                {p}
              </p>
            ))}
          </section>

          <section className="detail-section detail-contact" aria-labelledby="contact-title">
            <h2 id="contact-title" className="detail-section-title">
              Kontakt a provoz
            </h2>
            <dl className="detail-contact-list">
              <div>
                <dt>Adresa</dt>
                <dd>{address || 'Zatím nemáme ověřenou adresu.'}</dd>
              </div>
              <div>
                <dt>Telefon</dt>
                <dd>
                  {contact.hasPhone ? (
                    <>
                      <a href={`tel:${contact.phoneTel}`}>{contact.phoneDisplay}</a>
                      <p className="detail-source-note">{contact.unverifiedNote}</p>
                    </>
                  ) : (
                    <span className="detail-pending-note">
                      Telefon v OpenStreetMap chybí, nebo zápis nejde spolehlivě přečíst.
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Web</dt>
                <dd>
                  {officialWeb ? (
                    <a href={officialWeb} target="_blank" rel="noopener noreferrer">
                      {officialWeb.replace(/^https?:\/\//, '')}
                    </a>
                  ) : (
                    'Oficiální web nemáme ověřený.'
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="detail-section detail-hours" aria-labelledby="hours-title">
          <h2 id="hours-title" className="detail-section-title">
            Otevírací doba
          </h2>
          {contact.hasHours ? (
            <>
              {(() => {
                const openState = openingStatusNow(contact.hoursRaw)
                if (openState.status === 'open') {
                  return (
                    <p className="open-now-badge open-now-badge--open" role="status">
                      Otevřeno teď (podle OSM, Europe/Prague)
                    </p>
                  )
                }
                if (openState.status === 'closed') {
                  return (
                    <p className="open-now-badge open-now-badge--closed" role="status">
                      Teď zavřeno (podle OSM, Europe/Prague)
                    </p>
                  )
                }
                return (
                  <p className="detail-source-note">
                    Stav Otevřeno / Zavřeno u tohoto zápisu spolehlivě neodvozujeme.
                  </p>
                )
              })()}
              <ul className="detail-hours-list">
                {contact.hoursDisplay.split('\n').map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="detail-source-note">{contact.unverifiedNote}</p>
            </>
          ) : (
            <p className="detail-pending-note">
              Otevírací dobu v OpenStreetMap nemáme, nebo zápis není čitelný. Stav Otevřeno / Zavřeno
              proto nezobrazujeme.
            </p>
          )}
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
                Ověřeno {formatVerifiedDate(priceVerifiedAt)}
                {priceChannel === 'delivery' ? ' (rozvoz)' : ' (provozovna)'}
                {menuSource ? (
                  <>
                    {' '}
                    v{' '}
                    <a href={menuSource} target="_blank" rel="noopener noreferrer">
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

        {menuSource || lunchMenu ? (
          <section className="detail-section">
            <h2 className="detail-section-title">Menu</h2>
            {lunchMenu ? (
              <p className="detail-description">
                V OpenStreetMap je u podniku vyznačené polední menu.
              </p>
            ) : null}
            {menuSource ? (
              <p className="detail-description">
                Aktuální nabídku ověř v{' '}
                <a href={menuSource} target="_blank" rel="noopener noreferrer">
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

        <RestaurantReviews restaurantId={restaurant.id} />

        <section className="detail-section" aria-labelledby="report-title">
          <h2 id="report-title" className="visually-hidden">
            Nahlásit chybu
          </h2>
          <PlaceReportForm restaurantId={restaurant.id} restaurantName={restaurant.name} />
        </section>

        {similar.length > 0 ? (
          <section className="detail-section" aria-labelledby="similar-title">
            <h2 id="similar-title" className="detail-section-title">
              Podobné podniky
            </h2>
            <p className="detail-source-note">
              Stejný typ kuchyně. Pořadí bere i blízkou ověřenou cenu a vzdálenost, pokud souřadnice máme.
            </p>
            <ul className="restaurant-list similar-list">
              {similar.map((place, index) => (
                <li key={place.id}>
                  <RestaurantCard restaurant={place} index={index} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </main>
  )
}
