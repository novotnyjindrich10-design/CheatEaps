import { useMemo, useState } from 'react'
import { hasFiniteLatLon, hasVerifiedCoordinates } from '../utils/geo'
import { foldSearchText } from '../utils/filterRestaurants'
import { useLocationState } from '../context/LocationContext'

function LocationPin() {
  return (
    <svg className="location-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21.2s6.5-5.7 6.5-10.6a6.5 6.5 0 1 0-13 0c0 4.9 6.5 10.6 6.5 10.6z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10.5" r="2.15" fill="#8cff4a" />
    </svg>
  )
}

export default function LocationBar({ places = [], variant = 'default' }) {
  const { origin, status, errorMessage, locate, clearOrigin, setManualOrigin, routeStatus, routeMessage } =
    useLocationState()
  const activeGps = origin?.type === 'gps' && hasFiniteLatLon(origin.lat, origin.lon)
  const activeManual = origin?.type === 'manual' && hasFiniteLatLon(origin.lat, origin.lon)
  const active = activeGps || activeManual
  const locating = status === 'locating'
  const [manualOpen, setManualOpen] = useState(false)
  const [query, setQuery] = useState('')
  const suggestions = useMemo(() => {
    const needle = foldSearchText(query)
    if (needle.length < 2) return []
    return places
      .filter((place) => hasVerifiedCoordinates(place))
      .filter((place) => foldSearchText(`${place.name} ${place.address ?? ''}`).includes(needle))
      .slice(0, 6)
  }, [places, query])

  let statusText = 'Vzdálenost je volitelná.'
  if (activeGps) statusText = 'Poloha je aktivní.'
  else if (activeManual) statusText = `Výchozí místo: ${origin.label}.`

  return (
    <section className={`location-bar${variant === 'hero' ? ' location-bar--hero' : ''}`} aria-label="Poloha">
      <button
        type="button"
        className={`btn btn-primary location-btn${activeGps ? ' is-active' : ''}`}
        onClick={locate}
        disabled={locating}
        aria-busy={locating}
      >
        <LocationPin />
        {locating ? 'Zjišťuji polohu…' : activeGps ? 'Aktualizovat polohu' : 'Zapnout polohu'}
      </button>
      <button type="button" className="location-manual-toggle" onClick={() => setManualOpen((open) => !open)}>
        Zadat místo
      </button>
      {active ? (
        <button type="button" className="location-manual-toggle" onClick={clearOrigin}>
          Vypnout polohu
        </button>
      ) : null}
      <p className={`location-bar-status${active ? ' is-on' : ''}`} role="status">
        {statusText}
      </p>
      {errorMessage ? (
        <p className="location-bar-note" role="alert">
          {active ? `Aktualizace polohy selhala. ${errorMessage}` : errorMessage}
        </p>
      ) : null}
      {manualOpen ? (
        <div className="location-manual">
          <input
            id="manual-origin"
            className="location-manual-input"
            type="search"
            placeholder="Název nebo ulice v Brně"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Zadat místo podle názvu nebo ulice"
            autoComplete="off"
          />
          {suggestions.length > 0 ? (
            <ul className="location-suggestions">
              {suggestions.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setManualOrigin(place)
                      setManualOpen(false)
                      setQuery('')
                    }}
                  >
                    {place.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {active && routeStatus === 'loading' ? <p className="location-bar-caption">Počítám pěší vzdálenost…</p> : null}
      {active && routeMessage ? (
        <p className="location-bar-note" role="status">
          {routeMessage}
        </p>
      ) : null}
    </section>
  )
}
