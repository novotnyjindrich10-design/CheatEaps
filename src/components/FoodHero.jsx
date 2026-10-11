import { useState } from 'react'
import CuisineIllustration from './CuisineIllustration'
import { officialHero } from '../utils/placePhoto'
import { getRestaurantCategory } from '../utils/restaurantTags'

export default function FoodHero({ restaurant }) {
  const photo = officialHero(restaurant)
  const [broken, setBroken] = useState(false)
  const category = getRestaurantCategory(restaurant) || 'neuvedeno'
  const showPhoto = photo && !broken

  if (!showPhoto) {
    return (
      <figure className="detail-hero-figure detail-hero-figure--illustration">
        <CuisineIllustration category={category} />
        <figcaption>Ilustrace typu kuchyně, ne fotografie tohoto podniku</figcaption>
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
        onError={() => setBroken(true)}
      />
      <figcaption>Foto z oficiálního webu podniku</figcaption>
    </figure>
  )
}
