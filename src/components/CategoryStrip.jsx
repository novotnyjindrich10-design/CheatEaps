import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HOME_CATEGORIES,
  STRIP_CATEGORIES,
  buildCategoryHref,
  isLoyaltyCategory,
} from '../constants/filters'
import { pixabayPhotosById } from '../data/pixabayLibrary'
import { normalizeMarqueeOffset } from '../utils/marqueeOffset'

/** Ověřené snímky z místní Pixabay knihovny. Slevy nemají vhodnou fotografii jídla. */
const CATEGORY_PHOTO_ID = {
  pizza: 10389335,
  burger: 4953465,
  asijske: 5425611,
  ceske: 2872112,
  vegetarianske: 1819752,
  veganske: 4783972,
  kebab: 6109976,
  cina: 6896277,
  mexiko: 5932654,
  kava: 756490,
  sladke: 1283822,
  zdrave: 1786327,
}

const CATEGORY_PHOTO_POSITION = {
  pizza: 'center 48%',
  burger: 'center 38%',
  asijske: 'center 34%',
  ceske: '46% 42%',
  vegetarianske: '78% 46%',
  veganske: 'center 72%',
  kebab: '16% 36%',
  cina: 'center 40%',
  mexiko: 'center 42%',
  kava: 'center 40%',
  sladke: '30% 42%',
  zdrave: 'center 44%',
}

function categoryPhoto(value) {
  const photo = pixabayPhotosById[CATEGORY_PHOTO_ID[value]]
  if (!photo?.cardUrl?.startsWith('/food-illustrations/pixabay/')) return null
  return photo
}

const MARQUEE_SPEED = 20

function subscribeReducedMotion(onChange) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
}

export default function CategoryStrip({
  activeType = '',
  onSelect,
  asLinks = false,
  variant = 'pills',
}) {
  const navigate = useNavigate()
  const reducedMotion = usePrefersReducedMotion()
  const scrollerRef = useRef(null)
  const loopRef = useRef(0)
  const wrapLockRef = useRef(false)
  const holdWrapRef = useRef(false)
  const markManualRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const categories = variant === 'grid' ? HOME_CATEGORIES : STRIP_CATEGORIES
  const isGrid = variant === 'grid'
  const marquee = isGrid && !reducedMotion

  useEffect(() => {
    if (!isGrid) return undefined
    const el = scrollerRef.current
    if (!el) return undefined

    function updateArrows() {
      if (marquee) {
        const overflows = el.scrollWidth - el.clientWidth > 8
        setCanScrollLeft(overflows)
        setCanScrollRight(overflows)
        return
      }
      const max = el.scrollWidth - el.clientWidth
      setCanScrollLeft(el.scrollLeft > 4)
      setCanScrollRight(max > 4 && el.scrollLeft < max - 4)
    }

    updateArrows()
    if (marquee) {
      const observer = new ResizeObserver(updateArrows)
      observer.observe(el)
      return () => observer.disconnect()
    }

    el.addEventListener('scroll', updateArrows, { passive: true })
    const observer = new ResizeObserver(updateArrows)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      observer.disconnect()
    }
  }, [isGrid, marquee])

  useLayoutEffect(() => {
    if (!marquee) return undefined
    const el = scrollerRef.current
    if (!el) return undefined
    const wrap = el.parentElement
    if (!wrap) return undefined

    const hover = { current: false }
    const focus = { current: false }
    const userScroll = { current: false }
    const touchLocked = { current: false }
    let frame = 0
    let lastTime = 0
    let position = el.scrollLeft
    let resumeTimer = 0
    let driving = 0
    let lastOwnWrite = 0

    function measure() {
      const real = el.querySelectorAll('.category-card:not([data-clone])')
      const cards = el.querySelectorAll('.category-card')
      const count = real.length
      const origin = cards[count]
      const nextCopy = cards[count * 2]
      if (!origin || !nextCopy || count < 1) {
        loopRef.current = 0
        return
      }
      const loop = nextCopy.getBoundingClientRect().left - origin.getBoundingClientRect().left
      loopRef.current = loop > 1 ? loop : 0
    }

    function commit(next) {
      position = next
      driving += 1
      lastOwnWrite = performance.now()
      el.scrollLeft = next
      driving -= 1
    }

    function playing() {
      return (
        !touchLocked.current &&
        !hover.current &&
        !focus.current &&
        !userScroll.current &&
        loopRef.current > 1 &&
        !document.hidden
      )
    }

    function halt() {
      if (!frame) return
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
    }

    function tick(now) {
      if (!playing()) {
        frame = 0
        lastTime = 0
        return
      }
      if (!lastTime) lastTime = now
      const dt = Math.min(34, Math.max(0, now - lastTime))
      lastTime = now
      const loop = loopRef.current
      const added = (MARQUEE_SPEED * dt) / 1000
      position += added
      if (loop > 1 && position >= loop * 2) position -= loop
      driving += 1
      lastOwnWrite = performance.now()
      el.scrollLeft = position
      driving -= 1
      frame = requestAnimationFrame(tick)
    }

    function sync() {
      if (playing()) {
        if (!frame) frame = requestAnimationFrame(tick)
        return
      }
      halt()
    }

    function releaseUserScroll() {
      window.clearTimeout(resumeTimer)
      resumeTimer = 0
      holdWrapRef.current = false
      const normalized = normalizeMarqueeOffset(el.scrollLeft, loopRef.current)
      if (Math.abs(normalized - el.scrollLeft) > 0.5) commit(normalized)
      else position = el.scrollLeft
      userScroll.current = false
      sync()
    }

    function armUserScroll() {
      userScroll.current = true
      halt()
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(releaseUserScroll, 900)
    }

    markManualRef.current = armUserScroll

    function settle() {
      measure()
      const loop = loopRef.current
      if (loop <= 1) return
      const visual = ((el.scrollLeft % loop) + loop) % loop
      commit(loop + visual)
    }

    function onScroll() {
      if (driving > 0 || wrapLockRef.current) return
      if (!userScroll.current && performance.now() - lastOwnWrite < 80) return
      position = el.scrollLeft
      armUserScroll()
      if (holdWrapRef.current) return
      const normalized = normalizeMarqueeOffset(position, loopRef.current)
      if (Math.abs(normalized - position) > 0.5) commit(normalized)
    }

    function onScrollEnd() {
      if (driving > 0 || wrapLockRef.current || !userScroll.current) return
      releaseUserScroll()
    }

    function onEnter() {
      hover.current = true
      sync()
    }

    function onLeave() {
      hover.current = false
      sync()
    }

    function onFocusIn() {
      focus.current = true
      sync()
    }

    function onFocusOut(event) {
      if (wrap.contains(event.relatedTarget)) return
      focus.current = false
      sync()
    }

    function onPointerDown(event) {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') touchLocked.current = true
      armUserScroll()
    }

    function onWheel(event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) && !event.shiftKey) return
      armUserScroll()
    }

    function onHide() {
      if (document.hidden) halt()
      else sync()
    }

    settle()
    const observer = new ResizeObserver(() => {
      const loopBefore = loopRef.current
      const visual = loopBefore > 1 ? ((position % loopBefore) + loopBefore) % loopBefore : 0
      measure()
      const loop = loopRef.current
      if (loop > 1 && !userScroll.current && !touchLocked.current) commit(loop + visual)
      sync()
    })
    observer.observe(el)
    wrap.addEventListener('mouseenter', onEnter)
    wrap.addEventListener('mouseleave', onLeave)
    wrap.addEventListener('focusin', onFocusIn)
    wrap.addEventListener('focusout', onFocusOut)
    wrap.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', onScrollEnd)
    el.addEventListener('wheel', onWheel, { passive: true })
    document.addEventListener('visibilitychange', onHide)
    sync()

    return () => {
      halt()
      window.clearTimeout(resumeTimer)
      markManualRef.current = null
      observer.disconnect()
      wrap.removeEventListener('mouseenter', onEnter)
      wrap.removeEventListener('mouseleave', onLeave)
      wrap.removeEventListener('focusin', onFocusIn)
      wrap.removeEventListener('focusout', onFocusOut)
      wrap.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', onScrollEnd)
      el.removeEventListener('wheel', onWheel)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [marquee])

  function scrollByCard(direction) {
    const el = scrollerRef.current
    if (!el) return
    markManualRef.current?.()
    const card = el.querySelector('.category-card')
    const styles = getComputedStyle(el)
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 16
    const amount = (card?.getBoundingClientRect().width || 240) + gap
    const delta = direction * amount
    const loop = loopRef.current
    if (!(marquee && loop > 1)) {
      el.scrollBy({ left: delta, behavior: reducedMotion ? 'auto' : 'smooth' })
      return
    }

    holdWrapRef.current = true
    let left = el.scrollLeft
    if (direction < 0 && left + delta < loop) {
      wrapLockRef.current = true
      el.scrollLeft = left + loop
      wrapLockRef.current = false
      left = el.scrollLeft
    } else if (direction > 0 && left + delta >= loop * 2) {
      wrapLockRef.current = true
      el.scrollLeft = left - loop
      wrapLockRef.current = false
      left = el.scrollLeft
    }
    el.scrollTo({ left: left + delta, behavior: 'smooth' })
  }

  function onGridKeyDown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollByCard(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      scrollByCard(1)
    }
  }

  function handleSelect(value) {
    if (isLoyaltyCategory(value)) {
      navigate('/odmeny')
      return
    }
    onSelect?.(value)
  }

  function renderCard(category, cloneKey) {
    const { value, label } = category
    const clone = Boolean(cloneKey)
    const photo = categoryPhoto(value)
    return (
      <Link
        key={clone ? `${cloneKey}-${value}` : value}
        to={buildCategoryHref(value)}
        className={`category-card category-card--${value}${photo ? '' : ' category-card--plain'}`}
        data-clone={clone ? cloneKey : undefined}
        tabIndex={clone ? -1 : undefined}
        aria-hidden={clone ? true : undefined}
        onMouseDown={
          clone
            ? (event) => {
                if (event.button === 0) event.preventDefault()
              }
            : undefined
        }
      >
        {photo ? (
          <>
            <img
              className="category-card-photo"
              src={photo.cardUrl}
              alt=""
              width={photo.width}
              height={photo.height}
              draggable="false"
              decoding="async"
              style={{ objectPosition: CATEGORY_PHOTO_POSITION[value] || 'center' }}
              title={clone ? undefined : `Foto: ${photo.user}, Pixabay`}
            />
            <img
              className="category-card-photo category-card-photo--soft"
              src={photo.cardUrl}
              alt=""
              width={photo.width}
              height={photo.height}
              draggable="false"
              decoding="async"
              aria-hidden="true"
              style={{ objectPosition: CATEGORY_PHOTO_POSITION[value] || 'center' }}
            />
          </>
        ) : (
          <span className="category-card-art" aria-hidden="true">
            %
          </span>
        )}
        <span className="category-card-shade" aria-hidden="true" />
        <span className="category-card-label">{label}</span>
      </Link>
    )
  }

  return (
    <div className={isGrid ? 'category-grid-wrap' : 'category-strip-wrap'}>
      {isGrid ? (
        <button
          type="button"
          className="category-scroll-btn category-scroll-btn--prev"
          aria-label="Posunout kategorie doleva"
          disabled={!canScrollLeft}
          onClick={() => scrollByCard(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
      ) : null}
      <div
        ref={isGrid ? scrollerRef : undefined}
        className={isGrid ? `category-grid${marquee ? ' category-grid--marquee' : ''}` : 'category-strip'}
        onKeyDown={isGrid ? onGridKeyDown : undefined}
      >
        {!isGrid &&
          (asLinks ? (
            <Link
              to="/results"
              className={`category-pill ${activeType === '' ? 'is-active' : ''}`}
            >
              Vše
            </Link>
          ) : (
            <button
              type="button"
              className={`category-pill ${activeType === '' ? 'is-active' : ''}`}
              onClick={() => onSelect?.('')}
            >
              Vše
            </button>
          ))}

        {isGrid && marquee ? categories.map((category) => renderCard(category, 'a')) : null}
        {isGrid
          ? categories.map((category) => renderCard(category, ''))
          : categories.map((category) => {
              const { value, label, emoji } = category
              const className = `category-pill category-pill--${value} ${
                activeType === value ? 'is-active' : ''
              }`
              const content = (
                <>
                  <span className="category-pill-emoji" aria-hidden="true">
                    {emoji}
                  </span>
                  {label}
                </>
              )

              if (asLinks || isLoyaltyCategory(value)) {
                return (
                  <Link key={value} to={buildCategoryHref(value)} className={className}>
                    {content}
                  </Link>
                )
              }

              return (
                <button
                  key={value}
                  type="button"
                  className={className}
                  onClick={() => handleSelect(value)}
                >
                  {content}
                </button>
              )
            })}
        {isGrid && marquee ? categories.map((category) => renderCard(category, 'c')) : null}
      </div>
      {isGrid ? (
        <button
          type="button"
          className="category-scroll-btn category-scroll-btn--next"
          aria-label="Posunout kategorie doprava"
          disabled={!canScrollRight}
          onClick={() => scrollByCard(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      ) : null}
    </div>
  )
}
