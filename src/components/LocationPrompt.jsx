import { useEffect, useState } from 'react'
import { useLocationState } from '../context/LocationContext'

function LocationIcon() {
  return (
    <svg className="location-prompt-icon" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <circle cx="36" cy="36" r="34" fill="rgba(29, 107, 79, 0.12)" />
      <path
        fill="#1d6b4f"
        d="M36 14c-9.4 0-17 7.4-17 16.6 0 12.4 14.2 25.6 16.1 27.3a1.3 1.3 0 0 0 1.8 0C38.8 56.2 53 43 53 30.6 53 21.4 45.4 14 36 14zm0 23.2a6.6 6.6 0 1 1 0-13.2 6.6 6.6 0 0 1 0 13.2z"
      />
    </svg>
  )
}

export default function LocationPrompt() {
  const { showLocationPrompt, acceptPrompt, dismissPrompt } = useLocationState()
  // Sheet až po krátkém painte + první interakci (nebo fallback).
  // Auto-overlay hned po startu by se stal LCP a zničil metriky úvodu.
  const [paintReady, setPaintReady] = useState(false)
  const [engagementReady, setEngagementReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) setPaintReady(true)
      })
    })
    return () => {
      cancelled = true
      window.cancelAnimationFrame(id)
    }
  }, [])

  useEffect(() => {
    if (!showLocationPrompt) return undefined
    let cancelled = false
    const arm = () => {
      if (!cancelled) setEngagementReady(true)
    }
    window.addEventListener('scroll', arm, { once: true, passive: true })
    window.addEventListener('pointerdown', arm, { once: true })
    window.addEventListener('keydown', arm, { once: true })
    // Reální uživatelé, kteří jen čekají — sheet stejně ukaž (mimo typické LCP okno).
    const timer = window.setTimeout(arm, 16000)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.removeEventListener('scroll', arm)
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [showLocationPrompt])

  if (!paintReady || !engagementReady || !showLocationPrompt) return null

  return (
    <div
      className="location-prompt"
      role="dialog"
      aria-modal="false"
      aria-labelledby="location-prompt-title"
      aria-describedby="location-prompt-text"
    >
      <div className="location-prompt-backdrop" aria-hidden="true" />
      <div className="location-prompt-card">
        <LocationIcon />
        <h2 id="location-prompt-title" className="location-prompt-title">
          Co dobrého je kolem tebe?
        </h2>
        <p id="location-prompt-text" className="location-prompt-text">
          Povol svou polohu a objev restaurace, bistra a kavárny ve svém okolí.
        </p>
        <div className="location-prompt-actions">
          <button type="button" className="btn btn-primary location-prompt-allow" onClick={acceptPrompt}>
            Povolit polohu
          </button>
          <button type="button" className="btn btn-secondary location-prompt-skip" onClick={dismissPrompt}>
            Pokračovat bez polohy
          </button>
        </div>
      </div>
    </div>
  )
}
