import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authSession'

async function readJson(response) {
  return response.json().catch(() => ({}))
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState({
    ready: false,
    configured: false,
    authenticated: false,
    email: '',
    unreachable: false,
  })

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin' })
      const body = await readJson(response)
      setSession({
        ready: true,
        configured: Boolean(body.configured),
        authenticated: Boolean(body.authenticated),
        email: typeof body.email === 'string' ? body.email : '',
        unreachable: false,
      })
    } catch {
      setSession({
        ready: true,
        configured: false,
        authenticated: false,
        email: '',
        unreachable: true,
      })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => response.json().catch(() => ({})))
      .then((body) => {
        if (cancelled) return
        setSession({
          ready: true,
          configured: Boolean(body.configured),
          authenticated: Boolean(body.authenticated),
          email: typeof body.email === 'string' ? body.email : '',
          unreachable: false,
        })
      })
      .catch(() => {
        if (cancelled) return
        setSession({
          ready: true,
          configured: false,
          authenticated: false,
          email: '',
          unreachable: true,
        })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const submit = useCallback(async (path, email, password) => {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const body = await readJson(response)
    if (body.authenticated) await refresh()
    return { ok: response.ok && body.ok !== false, status: response.status, body }
  }, [refresh])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    await refresh()
  }, [refresh])

  const value = useMemo(() => ({ session, refresh, submit, logout }), [session, refresh, submit, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

