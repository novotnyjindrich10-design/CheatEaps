import { Link } from 'react-router-dom'
import {
  FOOD_CATEGORIES,
  HOME_CATEGORIES,
  buildCategoryHref,
} from '../constants/filters'

export default function CategoryStrip({
  activeType = '',
  onSelect,
  asLinks = false,
  variant = 'pills',
}) {
  const categories = variant === 'grid' ? HOME_CATEGORIES : FOOD_CATEGORIES
  const isGrid = variant === 'grid'

  return (
    <div className={isGrid ? 'category-grid-wrap' : 'category-strip-wrap'}>
      <div
        className={isGrid ? 'category-grid' : 'category-strip'}
      >
        {!isGrid &&
          (asLinks ? (
            <Link
              to="/results"
              className={`category-pill ${activeType === '' ? 'is-active' : ''}`}
            >
              Vše
            </Link>
          ) : (
            <button
              type="button"
              className={`category-pill ${activeType === '' ? 'is-active' : ''}`}
              onClick={() => onSelect('')}
            >
              Vše
            </button>
          ))}

        {categories.map(({ value, label, emoji }) => {
          if (isGrid) {
            return (
              <Link
                key={value}
                to={buildCategoryHref(value)}
                className={`category-card category-card--${value}`}
              >
                <span className="category-card-glow" aria-hidden="true" />
                <span className="category-card-emoji" aria-hidden="true">
                  {emoji}
                </span>
                <span className="category-card-label">{label}</span>
              </Link>
            )
          }

          const className = `category-pill category-pill--${value} ${
            activeType === value ? 'is-active' : ''
          }`
          const content = (
            <>
              <span className="category-pill-emoji" aria-hidden="true">
                {emoji}
              </span>
              {label}
            </>
          )

          if (asLinks) {
            return (
              <Link
                key={value}
                to={buildCategoryHref(value)}
                className={className}
              >
                {content}
              </Link>
            )
          }

          return (
            <button
              key={value}
              type="button"
              className={className}
              onClick={() => onSelect(value)}
            >
              {content}
            </button>
          )
        })}
      </div>
    </div>
  )
}
