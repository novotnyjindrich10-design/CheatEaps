import { copyText } from './copyText.js'

export async function sharePlaceLink({ title, url, share, clipboard }) {
  const target = typeof url === 'string' ? url.trim() : ''
  if (!target) return { ok: false, reason: 'empty' }
  if (typeof share === 'function') {
    try {
      await share({ title: title || 'FoodGo Brno', url: target })
      return { ok: true, method: 'share' }
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, reason: 'abort' }
    }
  }
  const copied = await copyText(target, clipboard)
  if (copied.ok) return { ok: true, method: 'copy' }
  return { ok: false, reason: copied.reason || 'failed' }
}
