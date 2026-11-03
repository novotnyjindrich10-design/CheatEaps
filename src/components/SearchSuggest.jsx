export default function SearchSuggest({ id, suggestions, activeIndex, onPick }) {
  if (suggestions.length === 0) return null
  return (
    <ul className="search-suggest" id={id} role="listbox">
      {suggestions.map((suggestion, index) => {
        const optionId = `${id}-opt-${index}`
        return (
          <li key={`${suggestion.kind}-${suggestion.id || suggestion.label}`} role="presentation">
            <button
              type="button"
              role="option"
              id={optionId}
              className={`search-suggest-option${index === activeIndex ? ' is-active' : ''}`}
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(suggestion)}
            >
              <span className="search-suggest-label">{suggestion.label}</span>
              <span className="search-suggest-hint">{suggestion.hint}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
