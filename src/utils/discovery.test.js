import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { suggestKeyAction } from './searchSuggest.js'
import { geolocationErrorMessage } from './geo.js'
import { filterAndSortRestaurants, parseResultsSearchParams, buildResultsSearchParams } from './filterRestaurants.js'
import { buildSearchSuggestions, interpretSearchQuery, searchWithoutIntent, withinOneEdit } from './smartSearch.js'
import { similarRestaurants } from './similarPlaces.js'
import { nextCompareIds } from './compareSelection.js'
import { sharePlaceLink } from './sharePlace.js'

const SOURCE = 'https://example.com/menu'
const VERIFIED_AT = '2026-10-10'

function place(id, extra) {
  return { id, name: id, type: 'Test', category: 'pizza', description: '', address: 'Brno', ...extra }
}

function menu(id, price, extra) {
  return place(id, {
    price,
    priceKind: 'menu',
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
    ...extra,
  })
}

describe('chytré hledání', () => {
  const places = [
    menu('alfa', 180, { name: 'Pizza Alfa', category: 'pizza', address: 'Veveří 1, Brno' }),
    menu('draha', 260, { name: 'Pizza Draha', category: 'pizza', address: 'Česká 2, Brno' }),
    place('odhad', {
      name: 'Pizza Odhad',
      category: 'pizza',
      price: 90,
      priceMax: 140,
      priceKind: 'estimate',
    }),
    place('asia', { name: 'Asia Bistro', category: 'asijske', address: 'Kounicova 3, Brno' }),
    place('sushi', {
      name: 'Asia Sushi',
      category: 'asijske',
      osmCuisine: 'sushi',
      address: 'Kounicova 9, Brno',
    }),
    menu('obed', 99, { name: 'Polední stůl', category: 'ceske', lunchMenu: true, address: 'Pekařská 4' }),
    place('vegan-burger', { name: 'Green Burger', category: 'burger', veganFriendly: true }),
    place('kebab', { name: 'Gyros Krpole', category: 'kebab', address: 'Královo Pole, Brno' }),
  ]

  it('hledá bez diakritiky a složí pizza do 200 jen z ověřené ceny', () => {
    assert.equal(withinOneEdit('piza', 'pizza'), true)
    const ids = filterAndSortRestaurants(places, { search: 'pizza do 200', sortBy: 'relevance' }).map(
      (item) => item.id,
    )
    assert.deepEqual(ids, ['alfa'])
    assert.equal(ids.includes('odhad'), false)
    assert.equal(ids.includes('draha'), false)
  })

  it('složený dotaz a překlep najdou kebab v lokalitě a pizzu', () => {
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'kebab Královo Pole' }).map((item) => item.id),
      ['kebab'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'piza' }).map((item) => item.id).sort(),
      ['alfa', 'draha', 'odhad'].sort(),
    )
  })

  it('sushi nebere z obecné asijské kategorie', () => {
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'sushi' }).map((item) => item.id),
      ['sushi'],
    )
  })

  it('vegan a levný oběd používají jen doložené příznaky', () => {
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'vegan' }).map((item) => item.id),
      ['vegan-burger'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'levný oběd' }).map((item) => item.id),
      ['obed'],
    )
  })

  it('neznámá kategorie v URL se zahodí a otevírací doba se dá kombinovat', () => {
    const parsed = parseResultsSearchParams(new URLSearchParams('type=nesmysl&hours=1&sort=name'))
    assert.equal(parsed.cuisineType, '')
    assert.equal(parsed.hoursOnly, true)
    assert.equal(parsed.sortBy, 'name')
    const round = parseResultsSearchParams(buildResultsSearchParams(parsed))
    assert.equal(round.hoursOnly, true)
    assert.equal(round.sortBy, 'name')
  })

  it('našeptávání vrátí nejvýš 8 návrhů a umí šipky', () => {
    const suggestions = buildSearchSuggestions(places, 'pi')
    assert.ok(suggestions.length > 0)
    assert.ok(suggestions.length <= 8)
    assert.ok(suggestions.some((item) => item.kind === 'category' && item.id === 'pizza'))
    assert.equal(buildSearchSuggestions(places, 'p').length, 0)
    const event = { key: 'ArrowDown', preventDefault() {} }
    const action = suggestKeyAction(event, { open: true, suggestions, activeIndex: -1 })
    assert.equal(action.type, 'move')
    assert.equal(action.index, 0)
    assert.equal(suggestKeyAction({ key: 'Escape' }, { open: true, suggestions, activeIndex: 0 }).type, 'close')
  })

  it('zrušení cenového limitu z dotazu nechá zbytek hledání', () => {
    const intent = interpretSearchQuery('pizza do 200 Veveří')
    assert.equal(intent.maxBudget, '200')
    assert.equal(intent.cuisineType, 'pizza')
    assert.match(searchWithoutIntent('pizza do 200 Veveří', 'budget'), /pizza/)
    assert.doesNotMatch(searchWithoutIntent('pizza do 200 Veveří', 'budget'), /200/)
  })
})

describe('podobné podniky a porovnání', () => {
  it('vynechá stejné ID a podniky jiné kategorie', () => {
    const current = menu('self', 150, { name: 'Self', category: 'pizza', lat: 49.2, lon: 16.61 })
    const near = menu('near', 160, { name: 'Near', category: 'pizza', lat: 49.201, lon: 16.611 })
    const far = menu('far', 400, { name: 'Far', category: 'pizza', lat: 49.29, lon: 16.7 })
    const burger = place('burger', { name: 'Burger', category: 'burger', lat: 49.2, lon: 16.61 })
    const list = similarRestaurants([current, burger, far, near], current, 6).map((item) => item.id)
    assert.deepEqual(list, ['near', 'far'])
    assert.equal(similarRestaurants([burger], current, 6).length, 0)
  })

  it('porovnání drží nejvýš tři unikátní podniky', () => {
    let state = nextCompareIds([], 'a')
    state = nextCompareIds(state.ids, 'b')
    state = nextCompareIds(state.ids, 'a')
    state = nextCompareIds(state.ids, 'a')
    state = nextCompareIds(state.ids, 'c')
    const blocked = nextCompareIds(state.ids, 'd')
    assert.deepEqual(blocked.ids, ['b', 'a', 'c'])
    assert.match(blocked.notice, /3/)
  })

  it('sdílení zkopíruje odkaz, když prohlížeč sdílení nemá', async () => {
    let copied = ''
    const result = await sharePlaceLink({
      title: 'Podnik',
      url: 'https://example.com/restaurant/a',
      clipboard: { writeText: async (value) => { copied = value } },
    })
    assert.equal(result.method, 'copy')
    assert.equal(copied, 'https://example.com/restaurant/a')
    const denied = geolocationErrorMessage('denied')
    assert.match(denied, /zakázaná/)
  })
})
