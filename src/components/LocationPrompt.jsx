import { useLocationState } from '../context/LocationContext'

/**
 * Kompaktní výzva jen když prohlížeč blokuje opakovanou nativní žádost.
 * Nejsou to fullscreen modal ani potvrzení po úspěchu.
 */
export default function LocationPrompt({ force = false }) {
  const { permissionBlocked, origin, status, errorMessage, dismissPrompt, locate } = useLocationState()
  const show =
    force ||
    (permissionBlocked && !origin && (status === 'denied' || Boolean(errorMessage)))

  if (!show) return null

  return (
    <div className="location-hint" role="status">
      <p className="location-hint-text">
        {status === 'denied'
          ? 'Poloha je v prohlížeči zakázaná. Povol ji v nastavení webu, nebo pokračuj bez GPS.'
          : errorMessage ||
            'Polohu teď nejde znovu vyžádat. Pokračuj bez GPS, nebo zkus oprávnění v prohlížeči.'}
      </p>
      <div className="location-hint-actions">
        <button
          type="button"
          className="btn btn-secondary location-hint-btn"
          onClick={() => locate({ forceRefresh: false })}
        >
          Zkusit znovu
        </button>
        <button type="button" className="location-hint-skip" onClick={dismissPrompt}>
          Pokračovat bez GPS
        </button>
      </div>
    </div>
  )
}
