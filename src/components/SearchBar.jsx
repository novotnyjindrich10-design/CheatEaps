export default function SearchBar({ value, onChange, id = 'search-restaurants' }) {
  return (
    <div className="search-bar">
      <svg className="search-bar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        id={id}
        type="search"
        className="search-bar-input"
        placeholder="Hledat restauraci…"
        aria-label="Hledat restauraci"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}
