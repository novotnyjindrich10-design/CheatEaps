export default function ResultsPager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const previous = page > 1
  const next = page < totalPages

  return (
    <nav className="results-pager" aria-label="Stránkování výsledků">
      <button
        type="button"
        className="btn btn-secondary results-pager-btn"
        disabled={!previous}
        onClick={() => onChange(page - 1)}
      >
        Předchozí
      </button>
      <p className="results-pager-status" aria-live="polite">
        Stránka {page} z {totalPages}
      </p>
      <button
        type="button"
        className="btn btn-secondary results-pager-btn"
        disabled={!next}
        onClick={() => onChange(page + 1)}
      >
        Další
      </button>
    </nav>
  )
}
