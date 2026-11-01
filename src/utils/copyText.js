export async function copyText(value, clipboard) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { ok: false, reason: 'empty' }
  const writer = clipboard?.writeText
  if (typeof writer !== 'function') return { ok: false, reason: 'unsupported' }
  try {
    await writer.call(clipboard, text)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
