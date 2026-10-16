import { useState } from 'react'
import CuisineIllustration from './CuisineIllustration'
import {
  foodIllustration,
  licenseLabel,
  needsAttribution,
  officialHero,
} from '../utils/placePhoto'
import { getRestaurantCategory } from '../utils/restaurantTags'

function IllustrationCredit({ photo }) {
  if (!photo || photo.kind !== 'illustration') return null
  const showCredit = needsAttribution(photo.license) || photo.creator || photo.sourceUrl
  if (!showCredit && !photo.license) return null

  const licenseText = licenseLabel(photo.license)
  const creator = photo.creator || 'autor neuveden'

  return (
    <p className="detail-hero-credit">
      {needsAttribution(photo.license) ? (
        <>
          Foto:{' '}
          {photo.creatorUrl ? (
            <a href={photo.creatorUrl} target="_blank" rel="noreferrer">
              {creator}
            </a>
          ) : (
            creator
          )}
          {licenseText ? (
            <>
              {' · '}
              {photo.licenseUrl ? (
                <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
                  {licenseText}
                </a>
              ) : (
                licenseText
              )}
            </>
          ) : null}
          {photo.sourceUrl ? (
            <>
              {' · '}
              <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
                zdroj
              </a>
            </>
          ) : null}
        </>
      ) : (
        <>
          {licenseText ? `${licenseText}` : 'Ilustrace'}
          {photo.sourceUrl ? (
            <>
              {' · '}
              <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
                zdroj
              </a>
            </>
          ) : null}
        </>
      )}
    </p>
  )
}

export default function FoodHero({ restaurant }) {
  const official = officialHero(restaurant)
  const illustration = foodIllustration(restaurant)
  const [officialBroken, setOfficialBroken] = useState(false)
  const [illustrationBroken, setIllustrationBroken] = useState(false)
  const category = getRestaurantCategory(restaurant) || 'neuvedeno'

  const photo =
    (official && !officialBroken && official) ||
    (illustration && !illustrationBroken && illustration) ||
    null

  if (!photo) {
    return (
      <figure className="detail-hero-figure detail-hero-figure--illustration">
        <CuisineIllustration category={category} />
        <figcaption>Ilustrace typu kuchyně, ne fotografie tohoto podniku</figcaption>
      </figure>
    )
  }

  if (photo.kind === 'illustration') {
    return (
      <figure className="detail-hero-figure detail-hero-figure--photo detail-hero-figure--stock">
        <img
          src={photo.url}
          alt={photo.alt}
          loading="eager"
          decoding="async"
          sizes="(max-width: 800px) 92vw, 440px"
          onError={() => setIllustrationBroken(true)}
        />
        <figcaption>
          Ilustrační fotografie
          {photo.dish ? ` (${photo.dish})` : ''}, ne jídlo z tohoto podniku
        </figcaption>
        <IllustrationCredit photo={photo} />
      </figure>
    )
  }

  return (
    <figure
      className={`detail-hero-figure ${photo.transparent ? 'detail-hero-figure--cutout' : 'detail-hero-figure--photo'}`}
    >
      <img
        src={photo.url}
        alt={photo.alt}
        loading="eager"
        decoding="async"
        sizes="(max-width: 800px) 92vw, 440px"
        referrerPolicy="no-referrer"
        onError={() => setOfficialBroken(true)}
      />
      <figcaption>Foto z oficiálního webu podniku</figcaption>
    </figure>
  )
}
