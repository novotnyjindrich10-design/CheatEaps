export function suggestKeyAction(event, { open, suggestions, activeIndex }) {
  if (event.key === 'Escape') return { type: 'close' }
  if (!open || suggestions.length === 0) return null
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const next = activeIndex < 0 ? 0 : (activeIndex + 1) % suggestions.length
    return { type: 'move', index: next }
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const next = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1
    return { type: 'move', index: next }
  }
  if (event.key === 'Enter' && activeIndex >= 0) {
    event.preventDefault()
    return { type: 'pick', suggestion: suggestions[activeIndex] }
  }
  return null
}
