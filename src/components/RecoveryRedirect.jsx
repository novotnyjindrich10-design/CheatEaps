import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasRecoveryCallback, NEW_PASSWORD_PATH, recoveryCallbackLocation } from '../utils/recoveryLink'

/** Když Supabase pošle tokeny na Site URL místo /nove-heslo, přesměruj je sem. */
export default function RecoveryRedirect() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname === NEW_PASSWORD_PATH) return undefined
    const hash = location.hash || window.location.hash || ''
    const href = `${window.location.origin}${location.pathname}${location.search}${hash}`
    if (!hasRecoveryCallback(href)) return undefined
    navigate(recoveryCallbackLocation(href), { replace: true })
    return undefined
  }, [location.hash, location.pathname, location.search, navigate])

  return null
}
