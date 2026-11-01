/** Cesta uvnitř aplikace. Odmítne cizí adresu a protokolově relativní odkaz. */
export function safeInternalPath(value, fallback = '/results') {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.includes('://') || value.includes('\\')) return fallback
  return value
}

export function currentInternalPath(location) {
  const path = `${location?.pathname || '/'}${location?.search || ''}`
  return safeInternalPath(path, '/results')
}
