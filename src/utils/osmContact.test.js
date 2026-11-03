import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractOsmContact,
  formatOpeningHoursForDisplay,
  isReadableOpeningHours,
  normalizeOsmPhone,
  presentOsmContact,
  rawOsmPhone,
} from './osmContact.js'

describe('telefon z OSM', () => {
  it('preferuje phone před contact:phone', () => {
    assert.equal(rawOsmPhone({ phone: '+420 777 111 222', 'contact:phone': '+420 111' }), '+420 777 111 222')
    assert.equal(rawOsmPhone({ 'contact:phone': '+420 604 460 660' }), '+420 604 460 660')
  })

  it('normalizuje české formáty na tel: odkaz', () => {
    assert.deepEqual(normalizeOsmPhone('+420 736 776 728'), {
      display: '+420 736 776 728',
      tel: '+420736776728',
    })
    assert.deepEqual(normalizeOsmPhone('+420604460660'), {
      display: '+420 604 460 660',
      tel: '+420604460660',
    })
    assert.deepEqual(normalizeOsmPhone('777 516 639'), {
      display: '+420 777 516 639',
      tel: '+420777516639',
    })
  })

  it('odmítne nečitelné nebo neúplné hodnoty', () => {
    assert.equal(normalizeOsmPhone(''), null)
    assert.equal(normalizeOsmPhone('123'), null)
    assert.equal(normalizeOsmPhone('https://example.cz'), null)
    assert.equal(normalizeOsmPhone('info@example.cz'), null)
  })
})

describe('otevírací doba z OSM', () => {
  it('přijme běžné OSM zápisy a odmítne nečitelné', () => {
    assert.equal(isReadableOpeningHours('Mo-Fr 11:00-19:00; Sa 11:00-18:00'), true)
    assert.equal(isReadableOpeningHours('24/7'), true)
    assert.equal(isReadableOpeningHours('Tu-Su 14:00-19:00'), true)
    assert.equal(isReadableOpeningHours('closed'), false)
    assert.equal(isReadableOpeningHours('unknown'), false)
    assert.equal(isReadableOpeningHours('viz web'), false)
    assert.equal(isReadableOpeningHours('by appointment'), false)
    assert.equal(isReadableOpeningHours(''), false)
  })

  it('přeloží zkratky dnů a nerozhoduje o otevření', () => {
    assert.equal(
      formatOpeningHoursForDisplay('Mo-Fr 11:00-19:00; Sa 11:00-18:00'),
      'Po–Pá 11:00–19:00\nSo 11:00–18:00',
    )
    assert.equal(formatOpeningHoursForDisplay('24/7'), 'Nonstop (24/7)')
    assert.equal(formatOpeningHoursForDisplay('closed'), null)
  })
})

describe('extract a present', () => {
  it('složí kontakt jen z čitelných tagů', () => {
    const contact = extractOsmContact({
      opening_hours: 'Mo-Th 11:00-22:00; Fr-Sa 11:00-00:00; Su 11:00-22:00',
      phone: '+420 533 316 443',
    })
    assert.equal(contact.source, 'openstreetmap')
    assert.match(contact.osmOpeningHoursDisplay, /Po–Čt/)
    assert.equal(contact.osmPhone, '+420 533 316 443')
    assert.equal(contact.osmPhoneTel, '+420533316443')
  })

  it('u chybějících údajů nepadá a nevrací odznak otevření', () => {
    const empty = presentOsmContact({})
    assert.equal(empty.hasHours, false)
    assert.equal(empty.hasPhone, false)
    assert.equal(empty.hoursDisplay, null)
    assert.equal(empty.phoneTel, null)
    assert.match(empty.unverifiedNote, /OpenStreetMap/)
  })
})
