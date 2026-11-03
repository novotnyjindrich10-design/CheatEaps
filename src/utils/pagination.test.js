import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pageCount, parsePageParam, slicePage } from './pagination.js'

describe('stránkování výsledků', () => {
  it('neplatnou stránku vrátí na 1', () => {
    assert.equal(parsePageParam(undefined), 1)
    assert.equal(parsePageParam('0'), 1)
    assert.equal(parsePageParam('-2'), 1)
    assert.equal(parsePageParam('abc'), 1)
    assert.equal(parsePageParam('3'), 3)
  })

  it('ořízne stránku a nevrátí prázdný seznam při přehnaném čísle', () => {
    const items = Array.from({ length: 50 }, (_, index) => index + 1)
    const first = slicePage(items, 1, 24)
    assert.equal(first.page, 1)
    assert.equal(first.totalPages, 3)
    assert.deepEqual(first.items, items.slice(0, 24))
    assert.equal(first.startIndex, 1)
    assert.equal(first.endIndex, 24)

    const last = slicePage(items, 99, 24)
    assert.equal(last.page, 3)
    assert.equal(last.items.length, 2)
    assert.equal(last.startIndex, 49)
    assert.equal(last.endIndex, 50)
  })

  it('prázdný seznam má jednu stránku', () => {
    assert.equal(pageCount(0), 1)
    const empty = slicePage([], 5)
    assert.equal(empty.page, 1)
    assert.deepEqual(empty.items, [])
  })
})
