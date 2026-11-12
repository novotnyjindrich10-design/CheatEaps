import { useLocationState } from '../context/LocationContext'

export default function LocationPrompt() {
  const { showLocationPrompt, acceptPrompt, dismissPrompt } = useLocationState()

  if (!showLocationPrompt) return null

  return (
    <div className="location-prompt" role="dialog" aria-labelledby="location-prompt-title" aria-modal="false">
      <div className="location-prompt-card">
        <p id="location-prompt-title" className="location-prompt-title">
          Povol polohu a najdeme ti nejbližší podniky v okolí.
        </p>
        <p className="location-prompt-text">
          Souřadnice zůstávají v tvém prohlížeči. Bez polohy FoodGo funguje dál — jen bez řazení podle vzdálenosti.
        </p>
        <div className="location-prompt-actions">
          <button type="button" className="btn btn-primary" onClick={acceptPrompt}>
            Povolit polohu
          </button>
          <button type="button" className="btn btn-secondary" onClick={dismissPrompt}>
            Teď ne
          </button>
        </div>
      </div>
    </div>
  )
}
