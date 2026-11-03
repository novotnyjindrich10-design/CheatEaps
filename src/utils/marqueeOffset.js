/** Drží posun ve střední kopii tří stejných sad, aby skok nebyl vidět. */
export function normalizeMarqueeOffset(offset, loop) {
  if (!(loop > 1) || !Number.isFinite(offset)) return offset
  let next = offset
  let guard = 0
  while (next >= loop * 2 && guard < 8) {
    next -= loop
    guard += 1
  }
  while (next < loop && guard < 8) {
    next += loop
    guard += 1
  }
  return next
}
