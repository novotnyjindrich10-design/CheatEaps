import { useEffect, useRef } from 'react'
import {
  isIntentionalMagnetGesture,
  measureMagnetOffsets,
  prefersReducedMotion,
  resolveMagnetIndex,
  scrollMagnetToOffset,
} from '../utils/magnetScroll'

/**
 * Doplňuje nativní scroll-snap mandatory po dokončení výrazného gesta.
 * Čeká na konec nativního scrollu (scrollend), pak jen dorovná instantně —
 * bez smooth scrollTo, který na WebKitu bojuje se snap animací.
 */
export function useMagnetScroller(scrollerRef, enabled) {
  const gestureRef = useRef({
    active: false,
    startY: 0,
    lastY: 0,
    lastTs: 0,
    velocityY: 0,
  })
  const settlingRef = useRef(false)
  const pendingRef = useRef(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!enabled || !scroller || prefersReducedMotion()) return undefined

    const clearPending = () => {
      if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer)
      if (pendingRef.current?.onEnd) {
        scroller.removeEventListener('scrollend', pendingRef.current.onEnd)
      }
      pendingRef.current = null
    }

    const settle = (direction) => {
      if (settlingRef.current) return
      const offsets = measureMagnetOffsets(scroller)
      if (offsets.length === 0) return
      const index = resolveMagnetIndex({
        offsets,
        scrollTop: scroller.scrollTop,
        direction,
        intentional: true,
      })
      const target = offsets[index]
      if (!Number.isFinite(target) || Math.abs(target - scroller.scrollTop) < 4) return
      settlingRef.current = true
      // Instant — nativní snap už doběhl; smooth by s ním kolidoval.
      scrollMagnetToOffset(scroller, target, { behavior: 'auto' })
      window.setTimeout(() => {
        settlingRef.current = false
      }, 80)
    }

    const scheduleSettle = (direction) => {
      clearPending()
      let done = false
      const run = () => {
        if (done) return
        done = true
        clearPending()
        settle(direction)
      }
      const onEnd = () => run()
      const timer = window.setTimeout(run, 140)
      pendingRef.current = { timer, onEnd }
      scroller.addEventListener('scrollend', onEnd, { once: true })
    }

    const onTouchStart = (event) => {
      if (event.touches.length !== 1) return
      clearPending()
      const y = event.touches[0].clientY
      gestureRef.current = {
        active: true,
        startY: y,
        lastY: y,
        lastTs: performance.now(),
        velocityY: 0,
      }
    }

    const onTouchMove = (event) => {
      const g = gestureRef.current
      if (!g.active || event.touches.length !== 1) return
      const y = event.touches[0].clientY
      const now = performance.now()
      const dt = Math.max(1, now - g.lastTs)
      g.velocityY = (g.lastY - y) / dt
      g.lastY = y
      g.lastTs = now
    }

    const onTouchEnd = () => {
      const g = gestureRef.current
      if (!g.active) return
      g.active = false
      const deltaY = g.startY - g.lastY
      const direction = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0
      const intentional = isIntentionalMagnetGesture({
        deltaY,
        velocityY: g.velocityY,
        viewportHeight: scroller.clientHeight,
      })
      if (!intentional || direction === 0) return
      scheduleSettle(direction)
    }

    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    scroller.addEventListener('touchmove', onTouchMove, { passive: true })
    scroller.addEventListener('touchend', onTouchEnd, { passive: true })
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      clearPending()
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchmove', onTouchMove)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [scrollerRef, enabled])
}
