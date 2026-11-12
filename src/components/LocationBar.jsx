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

function locationStatusText({ status, activeGps, activeManual, origin, originFresh }) {
  if (status === 'locating') return 'Zjišťuji polohu…'
  if (status === 'updated') return 'Poloha načtena'
  if (status === 'current') return 'Poloha je aktuální'
  if (status === 'denied') return 'Poloha je v prohlížeči zakázaná'
  if (
    status === 'timeout' ||
    status === 'unavailable' ||
    status === 'error' ||
    status === 'invalid' ||
    status === 'unsupported' ||
    status === 'insecure'
  ) {
    return 'Polohu se nepodařilo zjistit'
  }
  if (activeGps && originFresh) return 'Poloha je aktivní'
  if (activeGps) return 'Poslední uložená poloha — aktualizuj, nebo ji zapomeň'
  if (activeManual) return `Výchozí místo: ${origin.label}`
  return 'Vzdálenost je volitelná'
}

export default function LocationBar({ places = [], variant = 'default' }) {
  const {
    origin,
    originFresh,
    status,
    errorMessage,
    locate,
    forgetOrigin,
    setManualOrigin,
    routeStatus,
    routeMessage,
  } = useLocationState()
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

  const statusText = locationStatusText({ status, activeGps, activeManual, origin, originFresh })
  const buttonLabel = locating
    ? 'Zjišťuji polohu…'
    : activeGps
      ? 'Aktualizovat polohu'
      : 'Použít moji polohu'

  return (
    <section className={`location-bar${variant === 'hero' ? ' location-bar--hero' : ''}`} aria-label="Poloha">
      <div className="location-bar-actions">
        <button
          type="button"
          className={`btn btn-primary location-btn${activeGps ? ' is-active' : ''}`}
          onClick={() => locate({ forceRefresh: activeGps, highAccuracy: activeGps })}
          disabled={locating}
          aria-busy={locating}
        >
          <LocationPin />
          {buttonLabel}
        </button>
        <button type="button" className="location-manual-toggle" onClick={() => setManualOpen((open) => !open)}>
          Zadat místo
        </button>
        {active ? (
          <button type="button" className="location-manual-toggle" onClick={forgetOrigin}>
            Zapomenout moji polohu
          </button>
        ) : null}
      </div>
      <p
        className={`location-bar-status${
          active || locating || status === 'updated' || status === 'current' ? ' is-on' : ''
        }`}
        role="status"
      >
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
      {variant !== 'hero' && active && routeStatus === 'loading' ? (
        <p className="location-bar-caption">Doplňuji pěší vzdálenosti… zatím je vzdušná čára.</p>
      ) : null}
      {variant !== 'hero' && active && routeMessage ? (
        <p className="location-bar-note" role="status">
          {routeMessage}
        </p>
      ) : null}
    </section>
  )
}
