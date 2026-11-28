import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HOME_CATEGORIES,
  STRIP_CATEGORIES,
  buildCategoryHref,
  isDealsCategory,
} from '../constants/filters'
import { categoryStripPhotosById } from '../data/categoryStripPhotos'
import { normalizeMarqueeOffset } from '../utils/marqueeOffset'

/** Ověřené snímky z místní Pixabay knihovny (Pixabay Content License). Slevy = CSS gradient. */
const CATEGORY_PHOTO_ID = {
  pizza: 10389335,
  burger: 4953465,
  // Sushi — v knihovně (5425611 chybělo v metadata → plain „%“).
  asijske: 354628,
  ceske: 2872112,
  // Zeleninové kari — jasně bez masa (ne burger / ne pečené maso).
  vegetarianske: 4407744,
  // Veggie burger + batátové hranolky — jiný snímek než beetroot wrap.
  veganske: 3746476,
  kebab: 6109976,
  cina: 6896277,
  mexiko: 5932654,
  kava: 756490,
  // Čokoládový dort — 1283822 chybělo v metadata → plain „%“.
  sladke: 1850011,
  zdrave: 1786327,
}

const CATEGORY_PHOTO_POSITION = {
  pizza: 'center 48%',
  burger: 'center 38%',
  asijske: 'center 40%',
  ceske: '46% 42%',
  vegetarianske: 'center 48%',
  veganske: 'center 42%',
  kebab: '16% 36%',
  cina: 'center 40%',
  mexiko: 'center 42%',
  kava: 'center 40%',
  sladke: 'center 38%',
  zdrave: 'center 44%',
}

function categoryPhoto(value) {
  const photo = categoryStripPhotosById[CATEGORY_PHOTO_ID[value]]
  if (!photo?.cardUrl?.startsWith('/food-illustrations/pixabay/')) return null
  return photo
}

function photoSrcForSoft(photo) {
  return photo.fallbackUrl || photo.cardUrl
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

function subscribeWideLayout(onChange) {
  const media = window.matchMedia('(min-width: 960px)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function wideLayoutNow() {
  return window.matchMedia('(min-width: 960px)').matches
}

function useWideLayout() {
  return useSyncExternalStore(subscribeWideLayout, wideLayoutNow, () => false)
}

export default function CategoryStrip({
  activeType = '',
  dealsActive = false,
  onSelect,
  asLinks = false,
  variant = 'pills',
  autoScroll = true,
  wideGrid = false,
}) {
  const navigate = useNavigate()
  const reducedMotion = usePrefersReducedMotion()
  const wide = useWideLayout()
  const scrollerRef = useRef(null)
  const loopRef = useRef(0)
  const wrapLockRef = useRef(false)
  const holdWrapRef = useRef(false)
  const markManualRef = useRef(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const categories = variant === 'grid' ? HOME_CATEGORIES : STRIP_CATEGORIES
  const isGrid = variant === 'grid'
  const fill = isGrid && wideGrid && wide
  const marquee = isGrid && autoScroll && !reducedMotion && !fill

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
    if (isDealsCategory(value) && !onSelect) {
      navigate('/results?deals=1')
      return
    }
    onSelect?.(value)
  }

  function isSelected(value) {
    if (isDealsCategory(value)) return Boolean(dealsActive)
    return activeType === value
  }

  function renderCard(category, cloneKey, photoPriority = 'lazy') {
    const { value, label } = category
    const clone = Boolean(cloneKey)
    const photo = categoryPhoto(value)
    const dealsTile = isDealsCategory(value)
    const selected = !clone && isSelected(value)
    const className = [
      'category-card',
      `category-card--${value}`,
      !photo && !dealsTile ? 'category-card--plain' : '',
      selected ? 'is-active' : '',
    ]
      .filter(Boolean)
      .join(' ')
    const chooseHere = Boolean(onSelect) && !asLinks
    const eager = !clone && (photoPriority === 'eager' || photoPriority === 'high')
    const softUrl = photo ? photoSrcForSoft(photo) : ''
    const shared = {
      className,
      'data-clone': clone ? cloneKey : undefined,
      tabIndex: clone ? -1 : undefined,
      'aria-hidden': clone ? true : undefined,
      style: photo
        ? { '--category-photo-pos': CATEGORY_PHOTO_POSITION[value] || 'center' }
        : undefined,
    }
    const body = (
      <>
        {photo ? (
          <picture>
            <source srcSet={photo.cardUrl} type="image/webp" />
            <img
              className="category-card-photo"
              src={photo.fallbackUrl || photo.cardUrl}
              alt=""
              width={photo.width}
              height={photo.height}
              draggable="false"
              decoding="async"
              loading={eager ? 'eager' : 'lazy'}
              fetchPriority={photoPriority === 'high' ? 'high' : eager ? 'auto' : 'low'}
              style={{ objectPosition: CATEGORY_PHOTO_POSITION[value] || 'center' }}
              title={clone ? undefined : `Foto: ${photo.user}, Pixabay`}
              onLoad={(event) => {
                // Soft blur až po load — CSS background by jinak stáhl vše hned.
                const card = event.currentTarget.closest('.category-card')
                card?.style.setProperty('--category-photo', `url(${softUrl})`)
              }}
            />
          </picture>
        ) : dealsTile ? null : (
          <span className="category-card-art" aria-hidden="true">
            %
          </span>
        )}
        <span className="category-card-shade" aria-hidden="true" />
        <span className="category-card-label">{label}</span>
      </>
    )

    if (chooseHere) {
      return (
        <button
          key={clone ? `${cloneKey}-${value}` : value}
          type="button"
          {...shared}
          aria-pressed={clone ? undefined : selected}
          onClick={clone ? undefined : () => onSelect(value)}
        >
          {body}
        </button>
      )
    }

    return (
      <Link
        key={clone ? `${cloneKey}-${value}` : value}
        to={buildCategoryHref(value)}
        {...shared}
        aria-current={selected ? 'page' : undefined}
        onMouseDown={
          clone
            ? (event) => {
                if (event.button === 0) event.preventDefault()
              }
            : undefined
        }
      >
        {body}
      </Link>
    )
  }

  return (
    <div className={isGrid ? `category-grid-wrap${fill ? ' category-grid-wrap--fill' : ''}` : 'category-strip-wrap'}>
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
        className={
          isGrid
            ? `category-grid${marquee ? ' category-grid--marquee' : ''}${fill ? ' category-grid--fill' : ''}`
            : 'category-strip'
        }
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
          ? categories.map((category, index) =>
              renderCard(category, '', index === 0 ? 'high' : index < 3 ? 'eager' : 'lazy'),
            )
          : categories.map((category) => {
              const { value, label, emoji } = category
              const selected = isSelected(value)
              const className = `category-pill category-pill--${value} ${selected ? 'is-active' : ''}`
              const content = (
                <>
                  <span className="category-pill-emoji" aria-hidden="true">
                    {emoji}
                  </span>
                  {label}
                </>
              )

              if (asLinks) {
                return (
                  <Link
                    key={value}
                    to={buildCategoryHref(value)}
                    className={className}
                    aria-current={selected ? 'page' : undefined}
                  >
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
