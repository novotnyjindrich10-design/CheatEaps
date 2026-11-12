function hasControlChars(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

/** Cesta uvnitř aplikace. Odmítne cizí adresu a protokolově relativní odkaz. */
export function safeInternalPath(value, fallback = '/results') {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.includes('://') || value.includes('\\')) return fallback
  if (hasControlChars(value)) return fallback
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return fallback
  }
  // Odhalí i /%2f%2fevil.com po jednom dekódování.
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return fallback
  if (decoded.includes('://') || decoded.includes('\\')) return fallback
  if (hasControlChars(decoded)) return fallback
  return value
}

export function currentInternalPath(location) {
  const path = `${location?.pathname || '/'}${location?.search || ''}`
  return safeInternalPath(path, '/results')
}
