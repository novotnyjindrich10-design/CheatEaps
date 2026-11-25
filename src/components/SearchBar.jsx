import { useMemo, useState } from 'react'
import { buildSearchSuggestions } from '../utils/smartSearch'
import SearchSuggest from './SearchSuggest'
import { suggestKeyAction } from '../utils/searchSuggest'

export default function SearchBar({
  value,
  onChange,
  restaurants = [],
  onPick,
  id = 'search-restaurants',
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const suggestions = useMemo(
    () => (open ? buildSearchSuggestions(restaurants, value) : []),
    [open, restaurants, value],
  )
  const listId = `${id}-suggest`

  function pick(suggestion) {
    setOpen(false)
    setActiveIndex(-1)
    onPick?.(suggestion)
  }

  function onKeyDown(event) {
    const action = suggestKeyAction(event, { open, suggestions, activeIndex })
    if (!action) return
    if (action.type === 'close') {
      setOpen(false)
      setActiveIndex(-1)
    } else if (action.type === 'move') setActiveIndex(action.index)
    else if (action.type === 'pick') pick(action.suggestion)
  }

  return (
    <div className="search-bar-wrap">
      <div className="search-bar">
        <svg className="search-bar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id={id}
          type="search"
          className="search-bar-input"
          placeholder="Název, kuchyně nebo ulice"
          aria-label="Hledat restauraci"
          value={value}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            setOpen(false)
            setActiveIndex(-1)
          }}
          autoComplete="off"
        />
      </div>
      {open ? (
        <SearchSuggest id={listId} suggestions={suggestions} activeIndex={activeIndex} onPick={pick} />
      ) : null}
    </div>
  )
}
