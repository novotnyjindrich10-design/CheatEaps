import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { curatedPlaces } from '../data/curatedPlaces.js'
import { osmPlaces } from '../data/osmPlaces.js'
import { osmFacts } from '../data/osmFacts.js'
import { extractOsmContact, presentOsmContact } from './osmContact.js'

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/nám\./g, 'namesti')
    .replace(/[^a-z0-9]+/g, '')
}

function parseStreetHouse(address) {
  const first = String(address || '').split(',')[0] || ''
  const match = first.match(/^(.+?)\s+(\d[\w/-]*)/u)
  if (!match) return { street: first, house: '' }
  return { street: match[1], house: match[2] }
}

function addrKey(street, house) {
  return `${fold(street)}|${fold(house)}`
}

describe('přiřazení OSM kontaktu ke katalogu', () => {
  it('dump existuje a páruje se podle názvu a adresy', () => {
    const dumpPath = new URL('../../osm-brno-food.json', import.meta.url)
    assert.equal(existsSync(dumpPath), true)

    const dump = JSON.parse(readFileSync(dumpPath, 'utf8'))
    const osmByKey = new Map()
    for (const el of dump.elements || []) {
      const t = el.tags || {}
      const street = (t['addr:street'] || '').trim()
      const house = (t['addr:housenumber'] || '').trim()
      const name = (t.name || '').trim()
      if (!name || !street || !house) continue
      const key = `${fold(name)}|${addrKey(street, house)}`
      if (!osmByKey.has(key)) osmByKey.set(key, t)
    }

    const seen = new Set()
    const places = []
    for (const place of [...curatedPlaces, ...osmPlaces]) {
      if (seen.has(place.id)) continue
      seen.add(place.id)
      places.push(place)
    }

    assert.equal(places.length, 775)

    let matched = 0
    let withHours = 0
    let withPhone = 0
    for (const place of places) {
      const { street, house } = parseStreetHouse(place.address)
      const tags = osmByKey.get(`${fold(place.name)}|${addrKey(street, house)}`)
      if (!tags) continue
      matched += 1
      const contact = extractOsmContact(tags)
      if (contact.osmOpeningHours) withHours += 1
      if (contact.osmPhone) withPhone += 1
    }

    assert.ok(matched > 700, `očekávám silné párování, bylo ${matched}`)
    assert.ok(withHours > 400, `očekávám stovky otevíracích dob, bylo ${withHours}`)
    assert.ok(withPhone > 200, `očekávám stovky telefonů, bylo ${withPhone}`)
  })

  it('osmFacts drží kontakt jen u známých ID a present nespadne bez údajů', () => {
    for (const id of Object.keys(osmFacts)) {
      assert.ok([...curatedPlaces, ...osmPlaces].some((place) => place.id === id))
    }
    const sample = Object.entries(osmFacts).find(([, facts]) => facts.osmOpeningHours || facts.osmPhone)
    assert.ok(sample)
    const [id, facts] = sample
    const view = presentOsmContact({ id, ...facts })
    if (facts.osmOpeningHours) assert.equal(view.hasHours, true)
    if (facts.osmPhone) {
      assert.equal(view.hasPhone, true)
      assert.match(view.phoneTel, /^\+?\d+/)
    }
    assert.equal(presentOsmContact({ id: 'neexistuje' }).hasHours, false)
  })
})
