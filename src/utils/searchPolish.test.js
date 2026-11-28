import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyResultSuggestions, interpretSearchQuery } from './smartSearch.js'

describe('chytřejší hledání', () => {
  it('anglické synonymum a množné číslo mapuje na kategorii', () => {
    assert.equal(interpretSearchQuery('coffee').cuisineType, 'kava')
    assert.equal(interpretSearchQuery('burgers').cuisineType, 'burger')
    assert.equal(interpretSearchQuery('kebaby').cuisineType, 'kebab')
    assert.equal(interpretSearchQuery('pizzy').cuisineType, 'pizza')
  })

  it('prázdný výsledek navrhne jen odpovídající kategorii', () => {
    const hints = emptyResultSuggestions('mexican taco')
    assert.ok(hints.some((item) => item.id === 'mexiko'))
    assert.equal(emptyResultSuggestions('zzzz-neexistuje').length, 0)
  })

  it('našeptávání ověřeného jídla bere přesný název, ne podobné slovo', async () => {
    const { buildSearchSuggestions } = await import('./smartSearch.js')
    const suggestions = buildSearchSuggestions(
      [
        { id: 'a', name: 'Bistro', address: 'Orlí, Brno', verifiedProducts: ['Pho bo'] },
        { id: 'b', name: 'Telefon', address: 'Česká, Brno', verifiedProducts: ['řízek'] },
      ],
      'pho',
    )
    assert.ok(suggestions.some((item) => item.kind === 'dish' && item.label === 'Pho bo'))
    assert.equal(suggestions.some((item) => item.label === 'Telefon'), false)
  })
})
