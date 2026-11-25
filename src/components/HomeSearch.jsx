import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCatalog } from '../context/CatalogContext'
import { buildSearchSuggestions } from '../utils/smartSearch'
import SearchSuggest from './SearchSuggest'
import { suggestKeyAction } from '../utils/searchSuggest'
import {
  clearRecentSearches,
  listRecentSearches,
  rememberRecentSearch,
  removeRecentSearch,
} from '../utils/recentSearches'

export default function HomeSearch({ id = 'home-search' }) {
  const navigate = useNavigate()
  const { restaurants } = useCatalog()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recent, setRecent] = useState(() => listRecentSearches())
  const suggestions = useMemo(
    () => (open && value.trim().length >= 2 ? buildSearchSuggestions(restaurants, value) : []),
    [open, restaurants, value],
  )
  const listId = `${id}-suggest`
  const showRecent = open && value.trim().length < 2 && recent.length > 0

  function goToQuery(query) {
    const trimmed = String(query || '').trim()
    if (trimmed) setRecent(rememberRecentSearch(trimmed))
    const params = new URLSearchParams()
    if (trimmed) {
      params.set('q', trimmed)
      params.set('sort', 'relevance')
    }
    const search = params.toString()
    navigate(search ? `/results?${search}` : '/results')
  }

  function pick(suggestion) {
    setOpen(false)
    setActiveIndex(-1)
    if (suggestion.kind === 'restaurant') {
      navigate(`/restaurant/${suggestion.id}`)
      return
    }
    if (suggestion.kind === 'category') {
      navigate(`/results?type=${encodeURIComponent(suggestion.id)}`)
      return
    }
    goToQuery(suggestion.query || suggestion.label)
  }

  function onSubmit(event) {
    event.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      pick(suggestions[activeIndex])
      return
    }
    goToQuery(value.trim())
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
    <form className="home-search" onSubmit={onSubmit} role="search">
      <label className="visually-hidden" htmlFor={id}>
        Hledat restauraci v Brně
      </label>
      <div className="home-search-field">
        <svg className="search-bar-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id={id}
          type="search"
          className="home-search-input"
          placeholder="Název, kuchyně nebo ulice"
          value={value}
          role="combobox"
          aria-expanded={open && (suggestions.length > 0 || showRecent)}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
          onChange={(event) => {
            setValue(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => {
            setRecent(listRecentSearches())
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false)
              setActiveIndex(-1)
            }, 120)
          }}
          autoComplete="off"
          enterKeyHint="search"
          inputMode="search"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary home-search-submit">
          Hledat
        </button>
      </div>
      {showRecent ? (
        <div className="search-recent" id={listId}>
          <div className="search-recent-head">
            <p className="search-recent-title">Nedávná hledání</p>
            <button
              type="button"
              className="search-recent-clear"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setRecent(clearRecentSearches())}
            >
              Smazat
            </button>
          </div>
          <ul className="search-recent-list" role="listbox">
            {recent.map((item) => (
              <li key={item} role="presentation">
                <button
                  type="button"
                  className="search-recent-item"
                  role="option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setValue(item)
                    goToQuery(item)
                    setOpen(false)
                  }}
                >
                  {item}
                </button>
                <button
                  type="button"
                  className="search-recent-remove"
                  aria-label={`Odebrat ${item}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setRecent(removeRecentSearch(item))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : open ? (
        <SearchSuggest id={listId} suggestions={suggestions} activeIndex={activeIndex} onPick={pick} />
      ) : null}
    </form>
  )
}
