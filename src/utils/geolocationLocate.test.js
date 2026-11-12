import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyGeolocationError,
  FAST_GEO_OPTIONS,
  geolocationOptions,
  isStoredOriginFresh,
  requestGeolocationPosition,
  UI_LOCATE_DEADLINE_MS,
  sameCoordinates,
} from './geolocationLocate.js'

describe('geolocationLocate options', () => {
  it('první pokus je rychlý s cache a bez high accuracy', () => {
    assert.deepEqual(FAST_GEO_OPTIONS, {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300_000,
    })
    assert.equal(geolocationOptions().enableHighAccuracy, false)
    assert.equal(geolocationOptions({ highAccuracy: true }).enableHighAccuracy, true)
    assert.equal(UI_LOCATE_DEADLINE_MS, 15_000)
    assert.equal(geolocationOptions({ forceRefresh: true }).maximumAge, 0)
    assert.equal(geolocationOptions({ forceRefresh: true }).enableHighAccuracy, true)
  })

  it('rozliší čerstvou a zastaralou uloženou polohu', () => {
    const now = Date.parse('2026-11-04T12:00:00.000Z')
    assert.equal(
      isStoredOriginFresh({ updatedAt: '2026-11-04T11:58:00.000Z' }, now),
      true,
    )
    assert.equal(
      isStoredOriginFresh({ updatedAt: '2026-11-04T10:00:00.000Z' }, now),
      false,
    )
    assert.equal(isStoredOriginFresh({}, now), false)
  })

  it('pozná stejné souřadnice', () => {
    assert.equal(sameCoordinates({ lat: 49.2, lon: 16.6 }, { lat: 49.2, lon: 16.6 }), true)
    assert.equal(sameCoordinates({ lat: 49.2, lon: 16.6 }, { lat: 49.21, lon: 16.6 }), false)
  })

  it('klasifikuje chyby Geolocation API', () => {
    assert.equal(classifyGeolocationError({ code: 1 }), 'denied')
    assert.equal(classifyGeolocationError({ code: 2 }), 'unavailable')
    assert.equal(classifyGeolocationError({ code: 3 }), 'timeout')
    assert.equal(classifyGeolocationError({}), 'error')
  })
})

describe('requestGeolocationPosition', () => {
  it('okamžitě selže bez podpory geolokace', () => {
    let reason = null
    requestGeolocationPosition({
      geolocation: null,
      onError: (payload) => {
        reason = payload.reason
      },
    })
    assert.equal(reason, 'unsupported')
  })

  it('okamžitě selže mimo zabezpečený kontext', () => {
    let reason = null
    requestGeolocationPosition({
      geolocation: { getCurrentPosition() {} },
      isSecureContext: false,
      onError: (payload) => {
        reason = payload.reason
      },
    })
    assert.equal(reason, 'insecure')
  })

  it('předá úspěch a použije rychlé options', () => {
    let seenOptions = null
    let success = null
    const geo = {
      getCurrentPosition(ok, _err, options) {
        seenOptions = options
        ok({ coords: { latitude: 49.2, longitude: 16.6 } })
      },
    }
    requestGeolocationPosition({
      geolocation: geo,
      onSuccess: (pos) => {
        success = pos
      },
    })
    assert.deepEqual(seenOptions, FAST_GEO_OPTIONS)
    assert.equal(success.coords.latitude, 49.2)
  })

  it('při odmítnutí nastaví denied', () => {
    let reason = null
    const geo = {
      getCurrentPosition(_ok, err) {
        err({ code: 1 })
      },
    }
    requestGeolocationPosition({
      geolocation: geo,
      onError: (payload) => {
        reason = payload.reason
      },
    })
    assert.equal(reason, 'denied')
  })

  it('UI timeout ukončí čekání i když API neodpoví', () => {
    const timers = []
    let reason = null
    const geo = {
      getCurrentPosition() {
        /* nikdy neodpoví */
      },
    }
    requestGeolocationPosition({
      geolocation: geo,
      uiDeadlineMs: 100,
      setTimeoutFn: (fn, ms) => {
        timers.push({ fn, ms })
        return timers.length
      },
      clearTimeoutFn: () => {},
      onError: (payload) => {
        reason = payload.reason
      },
    })
    assert.equal(timers.length, 1)
    assert.equal(timers[0].ms, 100)
    timers[0].fn()
    assert.equal(reason, 'timeout')
  })

  it('opožděná odpověď starého požadavku se ignoruje', () => {
    let current = 1
    let successCount = 0
    let errorCount = 0
    let lateOk = null
    const geo = {
      getCurrentPosition(ok) {
        lateOk = ok
      },
    }
    requestGeolocationPosition({
      geolocation: geo,
      isCurrent: () => current === 1,
      onSuccess: () => {
        successCount += 1
      },
      onError: () => {
        errorCount += 1
      },
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => {},
    })
    current = 2
    lateOk({ coords: { latitude: 1, longitude: 2 } })
    assert.equal(successCount, 0)
    assert.equal(errorCount, 0)
  })

  it('opakovaný požadavek: cancel zabrání starému callbacku', () => {
    let successCount = 0
    let firstOk = null
    const geo = {
      getCurrentPosition(ok) {
        firstOk = firstOk || ok
      },
    }
    const first = requestGeolocationPosition({
      geolocation: geo,
      onSuccess: () => {
        successCount += 1
      },
      setTimeoutFn: () => 1,
      clearTimeoutFn: () => {},
    })
    first.cancel()
    firstOk({ coords: { latitude: 49.2, longitude: 16.6 } })
    assert.equal(successCount, 0)
  })
})
