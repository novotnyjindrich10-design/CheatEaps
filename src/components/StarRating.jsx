import { formatRatingNumber, formatReviewCount } from '../utils/googleRating'

export default function StarRating({ rating, reviewCount, size = 'md', compact = false, source = 'Google' }) {
  if (typeof rating !== 'number') {
    return (
      <span className={`star-rating star-rating--${size}`} aria-label="Hodnocení neuvedeno">
        <span className="star-rating-value">—</span>
      </span>
    )
  }

  const shown = formatRatingNumber(rating)
  const reviews = typeof reviewCount === 'number' ? formatReviewCount(reviewCount) : ''
  const label = reviews
    ? `${source} hodnocení ${shown} z 5, ${reviews}`
    : `${source} hodnocení ${shown} z 5`

  return (
    <span className={`star-rating star-rating--${size}`} aria-label={label}>
      <svg className="star-rating-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.77l-4.94 2.94.94-5.5-4-3.9 5.53-.8L10 1.5z"
        />
      </svg>
      <span className="star-rating-value">
        {compact && reviews ? `${shown} · ${reviews}` : shown}
      </span>
    </span>
  )
}
