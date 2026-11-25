import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FOOD_CATEGORIES } from '../constants/filters.js'
import {
  buildResultsSearchParams,
  filterAndSortRestaurants,
  foldSearchText,
  parseResultsSearchParams,
  resolveEffectiveSort,
  wantsDistanceSort,
} from './filterRestaurants.js'

const SOURCE = 'https://example.com/menu'
const VERIFIED_AT = '2026-10-10'

function place(id, extra) {
  return {
    id,
    name: id,
    type: 'Test',
    category: 'pizza',
    description: '',
    address: 'Brno',
    ...extra,
  }
}

function menu(id, price) {
  return place(id, {
    price,
    priceKind: 'menu',
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
  })
}

function range(id, min, max) {
  return place(id, {
    price: min,
    priceMax: max,
    priceKind: 'range',
    priceEstimate: true,
    priceSource: SOURCE,
    priceVerifiedAt: VERIFIED_AT,
  })
}

function ids(list, budget) {
  return filterAndSortRestaurants(list, { maxBudget: String(budget), sortBy: 'name' }).map(
    (item) => item.id,
  )
}

describe('filtr maximální ceny', () => {
  const places = [
    range('range-under', 100, 140),
    range('range-over-max', 120, 300),
    range('range-over-min', 180, 300),
    range('range-edge', 120, 150),
    menu('menu-149', 149),
    menu('menu-150', 150),
    menu('menu-151', 151),
    place('estimate', {
      price: 90,
      priceMax: 140,
      priceKind: 'estimate',
    }),
    place('no-price', { description: 'hlavní jídlo od 100 Kč' }),
  ]

  it('rozmezí projde jen když horní mez je do limitu', () => {
    const matched = ids(places, 150)
    assert.ok(matched.includes('range-under'))
    assert.equal(matched.includes('range-over-max'), false)
    assert.equal(matched.includes('range-over-min'), false)
  })

  it('konkrétní cena 149 a 150 projde, 151 ne', () => {
    const matched = ids(places, 150)
    assert.ok(matched.includes('menu-149'))
    assert.ok(matched.includes('menu-150'))
    assert.equal(matched.includes('menu-151'), false)
  })

  it('horní mez přesně na limitu projde, nad limitem ne', () => {
    assert.ok(ids(places, 150).includes('range-edge'))
    assert.equal(ids(places, 149).includes('range-edge'), false)
  })

  it('samotný odhad ani text v popisu filtr nesplní', () => {
    const matched = ids(places, 150)
    assert.equal(matched.includes('estimate'), false)
    assert.equal(matched.includes('no-price'), false)
  })

  it('bez cenového filtru odhad v seznamu zůstane', () => {
    const matched = filterAndSortRestaurants(places, { maxBudget: '' }).map((item) => item.id)
    assert.ok(matched.includes('estimate'))
    assert.ok(matched.includes('no-price'))
  })

  it('řazení od nejlevnějšího bere u rozmezí dolní mez, filtr horní', () => {
    const list = [
      range('wide', 120, 360),
      range('tight', 130, 145),
      menu('exact', 140),
      place('estimate-cheap', { price: 80, priceMax: 100, priceKind: 'estimate' }),
      place('unknown', {}),
    ]
    const sorted = filterAndSortRestaurants(list, { sortBy: 'price-asc' }).map((item) => item.id)
    assert.deepEqual(sorted, ['wide', 'tight', 'exact', 'estimate-cheap', 'unknown'])
    const budgeted = ids(list, 150)
    assert.deepEqual(budgeted, ['exact', 'tight'])
  })
})

describe('hledání restaurace', () => {
  it('hledá název, adresu i kategorii kuchyně', () => {
    const places = [
      place('type-only', {
        name: 'La Strada',
        type: 'Pizza',
        category: 'pizza',
        description: 'nejlepší pizza',
        address: 'Česká',
      }),
      place('named', { name: 'Pizza Bistro', type: 'Burger', category: 'burger', address: 'Veveří' }),
      place('street', { name: 'U Lípy', type: 'Česká', category: 'ceske', address: 'Pekařská 12' }),
    ]
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'pizza' }).map((item) => item.id).sort(),
      ['named', 'type-only'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'pekařská' }).map((item) => item.id),
      ['street'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'pekarska' }).map((item) => item.id),
      ['street'],
    )
    assert.equal(foldSearchText('  Šťatl   Brno '), 'statl brno')
  })

  it('u víceslovného dotazu vyžaduje všechna významná slova a ignoruje stopslova', () => {
    const places = [
      place('match', {
        name: 'La Strada',
        category: 'pizza',
        address: 'Veveří 10, Brno',
        price: 110,
        priceKind: 'menu',
        priceSource: SOURCE,
        priceVerifiedAt: VERIFIED_AT,
      }),
      place('wrong-street', { name: 'Pizza Roma', category: 'pizza', address: 'Česká 1, Brno' }),
      place('burger', { name: 'Burger Veveří', category: 'burger', address: 'Veveří 2, Brno' }),
    ]
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'levná pizza veveří' }).map((item) => item.id),
      ['match'],
    )
  })
})

describe('filtry dohromady', () => {
  const places = [
    {
      ...menu('pizza-cheap', 140),
      name: 'Štatl',
      address: 'Pekařská 1',
      category: 'pizza',
      distanceKm: 1,
    },
    { ...menu('pizza-far', 140), name: 'Štatl', category: 'pizza', distanceKm: 4 },
    { ...menu('burger-cheap', 140), name: 'Štatl', category: 'burger', distanceKm: 1 },
    { ...range('pizza-high', 180, 300), name: 'Štatl', category: 'pizza', distanceKm: 1 },
    place('pizza-est', {
      name: 'Štatl',
      category: 'pizza',
      distanceKm: 1,
      price: 100,
      priceMax: 140,
      priceKind: 'estimate',
    }),
  ]

  it('hledání, kategorie, ověřená cena a vzdálenost platí najednou', () => {
    const matched = filterAndSortRestaurants(places, {
      search: 'statl',
      maxBudget: '150',
      cuisineType: 'pizza',
      maxDistance: '2',
      hasOrigin: true,
      sortBy: 'distance',
    }).map((item) => item.id)
    assert.deepEqual(matched, ['pizza-cheap'])
  })

  it('nečíselný rozpočet a vzdálenost v URL se ignorují', () => {
    const parsed = parseResultsSearchParams(new URLSearchParams('budget=abc&distance=daleko'))
    assert.equal(parsed.maxBudget, '')
    assert.equal(parsed.maxDistance, '')
  })

  it('neznámé řazení v URL spadne na automatické (prázdné)', () => {
    const parsed = parseResultsSearchParams(new URLSearchParams('sort=nahodne'))
    assert.equal(parsed.sortBy, '')
    assert.equal(parseResultsSearchParams(new URLSearchParams('')).sortBy, '')
    assert.equal(parseResultsSearchParams(new URLSearchParams('sort=rating')).sortBy, 'rating')
    assert.equal(parseResultsSearchParams(new URLSearchParams('sort=price-asc')).sortBy, 'price-asc')
    assert.equal(parseResultsSearchParams(new URLSearchParams('sort=distance')).sortBy, 'distance')
    assert.equal(parseResultsSearchParams(new URLSearchParams('sort=quality')).sortBy, 'quality')
  })

  it('výchozí řazení bez polohy je abecední a ignoruje ověřenou cenu', () => {
    const thin = place('thin', { name: 'Aaa', category: 'pizza' })
    const rich = place('rich', {
      name: 'Zzz',
      category: 'pizza',
      price: 169,
      priceKind: 'menu',
      priceSource: SOURCE,
      priceVerifiedAt: VERIFIED_AT,
      officialWebsite: 'https://example.com/',
    })
    const veganThin = place('vegan-thin', { name: 'Aaa', category: 'veganske', veganFriendly: true })
    const veganRich = place('vegan-rich', {
      name: 'Zzz',
      category: 'veganske',
      veganFriendly: true,
      vegetarianFriendly: true,
      officialWebsite: 'https://example.com/',
      description: 'Veganské bistro s burgery, wrapy a seitanovým kebabem v centru Brna.',
    })
    assert.deepEqual(
      filterAndSortRestaurants([thin, rich], { cuisineType: 'pizza' }).map((item) => item.id),
      ['thin', 'rich'],
    )
    assert.deepEqual(
      filterAndSortRestaurants([veganThin, veganRich], { veganOnly: true }).map((item) => item.id),
      ['vegan-thin', 'vegan-rich'],
    )
    assert.deepEqual(
      filterAndSortRestaurants([thin, rich], { cuisineType: 'pizza', sortBy: 'quality' }).map(
        (item) => item.id,
      ),
      ['rich', 'thin'],
    )
    const stars = place('stars', {
      name: 'Stars',
      category: 'pizza',
      googleRating: 4.9,
      googleRatingStatus: 'verified',
      googleReviewCount: 200,
    })
    assert.deepEqual(
      filterAndSortRestaurants([rich, stars], { sortBy: 'rating' }).map((item) => item.id),
      ['stars', 'rich'],
    )
    assert.deepEqual(
      filterAndSortRestaurants([stars, rich], { cuisineType: 'pizza' }).map((item) => item.id),
      ['stars', 'rich'],
    )
  })

  it('s polohou řadí automaticky podle vzdálenosti bez ohledu na ověřenou cenu', () => {
    const farVerified = place('far-verified', {
      name: 'Zzz Far',
      distanceKm: 3,
      price: 99,
      priceKind: 'menu',
      priceSource: SOURCE,
      priceVerifiedAt: VERIFIED_AT,
    })
    const nearUnverified = place('near-unverified', {
      name: 'Aaa Near',
      distanceKm: 0.4,
    })
    const mid = place('mid', { name: 'Mmm Mid', distanceKm: 1.1 })
    const noCoords = place('no-coords', { name: 'Bez', distanceKm: null })
    assert.deepEqual(
      filterAndSortRestaurants([farVerified, nearUnverified, mid, noCoords], {
        hasOrigin: true,
      }).map((item) => item.id),
      ['near-unverified', 'mid', 'far-verified', 'no-coords'],
    )
    assert.deepEqual(
      filterAndSortRestaurants([farVerified, nearUnverified], {
        hasOrigin: true,
        sortBy: 'quality',
      }).map((item) => item.id),
      ['far-verified', 'near-unverified'],
    )
  })

  it('ruční a URL řazení má přednost před automatikou', () => {
    const a = place('a', { name: 'Aaa', distanceKm: 5 })
    const b = place('b', { name: 'Bbb', distanceKm: 1 })
    assert.deepEqual(
      filterAndSortRestaurants([a, b], { hasOrigin: true, sortBy: 'name' }).map((item) => item.id),
      ['a', 'b'],
    )
    assert.deepEqual(
      filterAndSortRestaurants([a, b], { hasOrigin: true, sortBy: 'distance' }).map((item) => item.id),
      ['b', 'a'],
    )
    const fromUrl = parseResultsSearchParams(new URLSearchParams('sort=name'))
    assert.equal(fromUrl.sortBy, 'name')
    assert.equal(buildResultsSearchParams(fromUrl).get('sort'), 'name')
    assert.equal(buildResultsSearchParams({ sortBy: '' }).toString(), '')
    assert.equal(buildResultsSearchParams({ sortBy: 'quality' }).get('sort'), 'quality')
  })

  it('podobná vzdálenost má stabilní sekundární řazení podle názvu', () => {
    const twinB = place('twin-b', { name: 'Bistro B', distanceKm: 1.0 })
    const twinA = place('twin-a', { name: 'Bistro A', distanceKm: 1.0 })
    assert.deepEqual(
      filterAndSortRestaurants([twinB, twinA], { hasOrigin: true, sortBy: 'distance' }).map(
        (item) => item.id,
      ),
      ['twin-a', 'twin-b'],
    )
  })

  it('veganský filtr je přísnější než vegetariánská nabídka', () => {
    const places = [
      place('veg-options', { vegetarianFriendly: true, veganFriendly: false, category: 'burger' }),
      place('vegan-place', { vegetarianFriendly: true, veganFriendly: true, category: 'zdrave' }),
      place('meat', { category: 'pizza' }),
    ]
    assert.deepEqual(
      filterAndSortRestaurants(places, { veganOnly: true }).map((item) => item.id),
      ['vegan-place'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { vegetarianOnly: true }).map((item) => item.id),
      ['veg-options', 'vegan-place'],
    )
  })

  it('reset vrátí prázdnou adresu a kombinace filtrů se z adresy složí zpět', () => {
    const defaults = parseResultsSearchParams(new URLSearchParams(''))
    assert.equal(buildResultsSearchParams(defaults).toString(), '')
    const active = {
      search: 'pho',
      maxBudget: '120',
      cuisineType: 'asijske',
      maxDistance: '2',
      sortBy: 'price-asc',
      veganOnly: true,
      vegetarianOnly: true,
      verifiedPricesOnly: true,
    }
    const parsed = parseResultsSearchParams(buildResultsSearchParams(active))
    assert.equal(parsed.search, 'pho')
    assert.equal(parsed.maxBudget, '120')
    assert.equal(parsed.cuisineType, 'asijske')
    assert.equal(parsed.maxDistance, '2')
    assert.equal(parsed.sortBy, 'price-asc')
    assert.equal(parsed.veganOnly, true)
    assert.equal(parsed.vegetarianOnly, false)
    assert.equal(parsed.verifiedPricesOnly, true)
    assert.equal(parsed.dealsOnly, false)
    const withDeals = parseResultsSearchParams(buildResultsSearchParams({ ...active, dealsOnly: true }))
    assert.equal(withDeals.dealsOnly, true)
    assert.equal(buildResultsSearchParams({ ...defaults, dealsOnly: false }).toString(), '')
    const withOpen = parseResultsSearchParams(buildResultsSearchParams({ openNowOnly: true }))
    assert.equal(withOpen.openNowOnly, true)
    assert.equal(buildResultsSearchParams({ openNowOnly: true }).get('open'), '1')
  })

  it('relevance při stejném skóre upřednostní kvalitnější záznam', () => {
    const thin = place('thin-pizza', {
      name: 'Pizza Thin',
      description: 'Záznam z OpenStreetMap (restaurace).',
    })
    const rich = place('rich-pizza', {
      name: 'Pizza Rich',
      description: 'Ověřená pizzerie s denním menu a vlastní stránkou v Brně.',
      officialWebsite: 'https://example.com/pizza',
      price: 129,
      priceKind: 'menu',
      priceSource: SOURCE,
      priceVerifiedAt: VERIFIED_AT,
    })
    const ordered = filterAndSortRestaurants([thin, rich], {
      search: 'pizza',
      sortBy: 'relevance',
    }).map((item) => item.id)
    assert.equal(ordered[0], 'rich-pizza')
  })

  it('filtr mapBounds nechá jen body uvnitř výřezu', () => {
    const matched = filterAndSortRestaurants(
      [
        place('in', { lat: 49.2, lon: 16.6 }),
        place('out', { lat: 49.3, lon: 16.7 }),
        place('nocoords'),
      ],
      {
        mapBounds: { south: 49.15, north: 49.25, west: 16.55, east: 16.65 },
      },
    )
    assert.deepEqual(
      matched.map((item) => item.id),
      ['in'],
    )
  })

  it('bez čísla vzdálenosti limit nesplní', () => {
    const matched = filterAndSortRestaurants(
      [place('wait', { distanceKm: null, distanceState: 'locating' })],
      { maxDistance: '2', hasOrigin: true },
    )
    assert.equal(matched.length, 0)
  })

  it('vzdálenostní filtr bere Haversine i pěší trasu', () => {
    const matched = filterAndSortRestaurants(
      [place('air', { distanceKm: 0.4, distanceState: 'air-pending' })],
      { maxDistance: '1', hasOrigin: true },
    )
    assert.equal(matched.length, 1)
    const listed = filterAndSortRestaurants(
      [
        place('b', { name: 'Beta', distanceKm: 0.4, distanceState: 'air-pending' }),
        place('a', { name: 'Alfa', distanceKm: 1.2, distanceState: 'route' }),
      ],
      { sortBy: 'distance', hasOrigin: true },
    ).map((item) => item.id)
    assert.deepEqual(listed, ['b', 'a'])
  })

  it('stejná ověřená cena má stabilní pořadí podle názvu', () => {
    const ordered = filterAndSortRestaurants(
      [menu('b', 120), place('a', { name: 'Alfa', ...menu('a', 120) })],
      { sortBy: 'price-asc' },
    ).map((item) => item.id)
    assert.deepEqual(ordered, ['a', 'b'])
  })
})

describe('filtr a řazení vzdálenosti', () => {
  const places = [
    place('near', { distanceKm: 1.2 }),
    place('edge', { distanceKm: 2 }),
    place('far', { distanceKm: 2.4 }),
    place('unknown', { distanceKm: null }),
  ]

  it('při zapnuté poloze bere jen známou vzdálenost v limitu', () => {
    const matched = filterAndSortRestaurants(places, {
      maxDistance: '2',
      hasOrigin: true,
      sortBy: 'distance',
    }).map((item) => item.id)
    assert.deepEqual(matched, ['near', 'edge'])
  })

  it('bez polohy filtr vzdálenosti seznam neomezí', () => {
    const matched = filterAndSortRestaurants(places, { maxDistance: '2', hasOrigin: false }).map(
      (item) => item.id,
    )
    assert.equal(matched.length, 4)
  })

  it('neznámou vzdálenost řadí nakonec', () => {
    const matched = filterAndSortRestaurants(places, { sortBy: 'distance', hasOrigin: true }).map(
      (item) => item.id,
    )
    assert.deepEqual(matched, ['near', 'edge', 'far', 'unknown'])
  })
})

describe('filtr slev', () => {
  it('nechá jen podnik s veřejnou nabídkou a hledání bere text nabídky', () => {
    const places = [
      place('kfc-masarykova-39', { name: 'KFC Masarykova', address: 'Masarykova 39, Brno', category: 'fastfood' }),
      place('pizza-place', { name: 'Pizzerie', address: 'Česká 1, Brno', category: 'pizza' }),
    ]
    assert.deepEqual(
      filterAndSortRestaurants(places, { dealsOnly: true }).map((item) => item.id),
      ['kfc-masarykova-39'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { search: 'twister' }).map((item) => item.id),
      ['kfc-masarykova-39'],
    )
    assert.deepEqual(
      filterAndSortRestaurants(places, { dealsOnly: true, cuisineType: 'pizza' }).map((item) => item.id),
      [],
    )
  })

  it('sleva nemění výchozí řazení a ověřená cena ho sama o sobě neposune', () => {
    const thin = place('kfc-rasinova-2', { name: 'Aaa KFC', category: 'fastfood' })
    const rich = place('kfc-masarykova-39', {
      name: 'Zzz KFC',
      category: 'fastfood',
      officialWebsite: 'https://kfc.cz/',
      description: 'Kuřecí restaurace s oficiálním webem a ověřenou pobočkou v centru Brna.',
      address: 'Masarykova 39, 60200 Brno',
      lat: 49.195,
      lon: 16.608,
    })
    assert.deepEqual(
      filterAndSortRestaurants([thin, rich], { dealsOnly: true }).map((item) => item.id),
      ['kfc-rasinova-2', 'kfc-masarykova-39'],
    )
    assert.deepEqual(
      filterAndSortRestaurants([thin, rich], { dealsOnly: true, sortBy: 'quality' }).map(
        (item) => item.id,
      ),
      ['kfc-masarykova-39', 'kfc-rasinova-2'],
    )
  })
})

describe('kategorie', () => {
  const places = [
    place('pizza', { category: 'pizza', name: 'Pizzerie' }),
    place('burger', { category: 'burger', name: 'Burger bar' }),
    place('veganske', { category: 'veganske', name: 'Vegan bistro' }),
  ]

  it('každá kategorie vrátí jen své podniky', () => {
    for (const value of ['pizza', 'burger', 'veganske']) {
      const matched = filterAndSortRestaurants(places, { cuisineType: value }).map((item) => item.id)
      assert.deepEqual(matched, [value])
    }
  })

  it('filtruje všechna tlačítka kategorií', () => {
    const all = FOOD_CATEGORIES.map((category) =>
      place(category.value, { category: category.value, name: category.label }),
    )
    for (const category of FOOD_CATEGORIES) {
      const matched = filterAndSortRestaurants(all, { cuisineType: category.value }).map((item) => item.id)
      assert.deepEqual(matched, [category.value])
    }
  })
})

describe('výchozí řazení Nejblíž ke mně', () => {
  it('resolveEffectiveSort bere vzdálenost jen s polohou', () => {
    assert.equal(resolveEffectiveSort('', { hasOrigin: true }), 'distance')
    assert.equal(resolveEffectiveSort('distance', { hasOrigin: true }), 'distance')
    assert.equal(resolveEffectiveSort('', { hasOrigin: false }), 'name')
    assert.equal(resolveEffectiveSort('distance', { hasOrigin: false }), 'name')
    assert.equal(resolveEffectiveSort('quality', { hasOrigin: true }), 'quality')
    assert.equal(wantsDistanceSort(''), true)
    assert.equal(wantsDistanceSort('distance'), true)
    assert.equal(wantsDistanceSort('name'), false)
  })

  it('bez polohy explicitní distance neřadí podle fiktivních km', () => {
    const far = place('zzz', { distanceKm: 0.1 })
    const near = place('aaa', { distanceKm: 9 })
    assert.deepEqual(
      filterAndSortRestaurants([far, near], { sortBy: 'distance', hasOrigin: false }).map((item) => item.id),
      ['aaa', 'zzz'],
    )
  })
})

