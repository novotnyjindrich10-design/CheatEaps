import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { pixabayPhotosById } from '../data/pixabayLibrary.js'

const stripSource = () => readFileSync(new URL('./CategoryStrip.jsx', import.meta.url), 'utf8')

describe('fotka kategorie Bez masa', () => {
  it('CategoryStrip bere zeleninové kari 4407744 z Pixabay knihovny', () => {
    const source = stripSource()
    assert.match(source, /vegetarianske:\s*4407744/)
    assert.equal(source.includes('vegetarianske: 2206601'), false)
    assert.equal(source.includes('vegetarianske: 1819752'), false)

    const photo = pixabayPhotosById[4407744]
    assert.ok(photo)
    assert.match(photo.pageUrl, /curry|vegan|vegetarian/i)
    assert.match(photo.cardUrl, /^\/food-illustrations\/pixabay\/4407744\.jpg$/)
    assert.equal(
      existsSync(new URL('../../public/food-illustrations/pixabay/4407744.jpg', import.meta.url)),
      true,
    )
    assert.equal(
      existsSync(new URL('../../public/food-illustrations/pixabay/category/4407744-640.webp', import.meta.url)),
      true,
    )
  })
})

describe('fotka kategorie Vegan', () => {
  it('CategoryStrip bere veggie burger 3746476 z Pixabay knihovny', () => {
    const source = stripSource()
    assert.match(source, /veganske:\s*3746476/)
    assert.equal(source.includes('veganske: 4783972'), false)

    const photo = pixabayPhotosById[3746476]
    assert.ok(photo)
    assert.match(photo.pageUrl, /burger|veggie|vegetarian|vegan/i)
    assert.match(photo.cardUrl, /^\/food-illustrations\/pixabay\/3746476\.jpg$/)
    assert.equal(
      existsSync(new URL('../../public/food-illustrations/pixabay/3746476.jpg', import.meta.url)),
      true,
    )
    assert.equal(
      existsSync(new URL('../../public/food-illustrations/pixabay/category/3746476-640.webp', import.meta.url)),
      true,
    )
  })
})

describe('fotka kategorie Slevy', () => {
  it('Slevy mají oranžový CSS gradient u nápisu, ne fotku ani „%“', () => {
    const source = stripSource()
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    assert.equal(/\bslevy:\s*\d+/.test(source), false)
    assert.match(source, /dealsTile \? null/)
    assert.match(css, /\.category-card--slevy\s*\{/)
    assert.match(css, /radial-gradient/)
    assert.match(css, /#ffe7c4|#ffd19a/)
  })
})

describe('fotka kategorie Asie', () => {
  it('CategoryStrip bere sushi 354628 z Pixabay knihovny', () => {
    const source = stripSource()
    assert.match(source, /asijske:\s*354628/)
    assert.equal(source.includes('asijske: 5425611'), false)

    const photo = pixabayPhotosById[354628]
    assert.ok(photo)
    assert.match(photo.pageUrl, /sushi|japanese|asian/i)
    assert.match(photo.cardUrl, /^\/food-illustrations\/pixabay\/354628\.jpg$/)
    assert.equal(
      existsSync(new URL('../../public/food-illustrations/pixabay/354628.jpg', import.meta.url)),
      true,
    )

    // Asie nesdílí fotku s kategorií Čína.
    assert.match(source, /cina:\s*6896277/)
    assert.notEqual(354628, 6896277)
  })
})

describe('fotka kategorie Sladké', () => {
  it('CategoryStrip bere čokoládový dort 1850011 z Pixabay knihovny', () => {
    const source = stripSource()
    assert.match(source, /sladke:\s*1850011/)
    assert.equal(source.includes('sladke: 1283822'), false)

    const photo = pixabayPhotosById[1850011]
    assert.ok(photo)
    assert.match(photo.pageUrl, /cake|chocolate|dessert|sweet/i)
    assert.match(photo.cardUrl, /^\/food-illustrations\/pixabay\/1850011\.jpg$/)
    assert.equal(
      existsSync(new URL('../../public/food-illustrations/pixabay/1850011.jpg', import.meta.url)),
      true,
    )
  })
})
