import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  listSecondaryAssignments,
  secondaryCategoryByPlaceId,
} from '../data/secondaryCategories.js'
import { filterAndSortRestaurants } from './filterRestaurants.js'
import { categoryMatchTier } from './restaurantTags.js'
import { matchRestaurantQuery, interpretSearchQuery } from './smartSearch.js'

function place(id, fields = {}) {
  const info = secondaryCategoryByPlaceId[id] || {}
  return {
    id,
    name: fields.name || id,
    address: 'Brno',
    category: fields.category || 'neuvedeno',
    cuisineType: fields.category || 'neuvedeno',
    secondaryCategories: (info.secondary || []).filter((value) => value !== fields.category),
    verifiedProducts: info.products || [],
    foodIllustrationTheme: fields.foodIllustrationTheme || fields.category || '',
    ...fields,
  }
}

const catalog = [
  place('forkys-vankovka', {
    name: "Forky's Galerie Vaňkovka",
    category: 'veganske',
    foodIllustrationTheme: 'veganske',
  }),
  place('vegan-af-ramen-maresova-14', {
    name: 'Vegan AF Ramen',
    category: 'asijske',
    foodIllustrationTheme: 'ramen',
  }),
  place('haribol-luzanecka-4', { name: 'Haribol', category: 'veganske' }),
  place('amici-pizza-burgers-palackeho-trida-82', {
    name: 'Amici Pizza & Burgers',
    category: 'pizza',
  }),
  place('burger-king-ceska-142-29', { name: 'Burger King', category: 'burger' }),
  place('pho-43-trida-kpt-jarose-20', { name: 'PHO 43', category: 'asijske' }),
  place('pho-ha-noi-jakubske-namesti-1', { name: 'Pho Ha Noi', category: 'asijske' }),
  place('monogram-espresso-bar', { name: 'Monogram Espresso Bar', category: 'kava' }),
  place('pizza-bombastica-teyschlova-38a', {
    name: 'Pizza Bombastica',
    category: 'pizza',
    description: 'Pizza a saláty. Espresso na jídelním lístku jako poznámka.',
  }),
  place('new-era-restaurace', { name: 'New Era Restaurace', category: 'cina' }),
]

describe('secondary categories + search relevance', () => {
  it('má doložená vedlejší přiřazení', () => {
    const rows = listSecondaryAssignments()
    assert.ok(rows.length >= 20)
    for (const row of rows) {
      assert.ok(row.evidence, row.id)
      assert.ok(row.confidence === 'high' || row.confidence === 'medium', row.id)
    }
  })

  it('Forky’s zůstane veganský a ve filtru burger je sekundární po primárních', () => {
    const forkys = catalog.find((item) => item.id === 'forkys-vankovka')
    assert.equal(forkys.category, 'veganske')
    assert.deepEqual(forkys.secondaryCategories, ['burger'])
    assert.equal(categoryMatchTier(forkys, 'burger'), 'secondary')
    assert.equal(forkys.foodIllustrationTheme, 'veganske')

    const burgerHits = filterAndSortRestaurants(catalog, {
      cuisineType: 'burger',
      sortBy: 'relevance',
    })
    assert.ok(burgerHits.some((item) => item.id === 'forkys-vankovka'))
    assert.equal(burgerHits[0].category, 'burger')
  })

  it('Vegan AF Ramen je ve veganském filtru jako sekundární', () => {
    const hits = filterAndSortRestaurants(catalog, {
      cuisineType: 'veganske',
      sortBy: 'relevance',
    }).map((item) => item.id)
    assert.ok(hits.includes('vegan-af-ramen-maresova-14'))
    assert.ok(hits.includes('forkys-vankovka'))
    assert.ok(hits.includes('haribol-luzanecka-4'))
  })

  it('hledání pho preferuje ověřené pho podniky', () => {
    const hits = filterAndSortRestaurants(catalog, {
      search: 'pho',
      sortBy: 'relevance',
    }).map((item) => item.id)
    assert.ok(hits.includes('pho-43-trida-kpt-jarose-20'))
    assert.ok(hits.includes('pho-ha-noi-jakubske-namesti-1'))
  })

  it('hledání espresso neřadí pizzerii jen kvůli zmínce v popisu', () => {
    const intent = interpretSearchQuery('espresso')
    assert.equal(intent.cuisineType, '')
    const pizza = catalog.find((item) => item.id === 'pizza-bombastica-teyschlova-38a')
    const mono = catalog.find((item) => item.id === 'monogram-espresso-bar')
    assert.equal(matchRestaurantQuery(pizza, intent), null)
    assert.ok(matchRestaurantQuery(mono, intent) > 0)
  })

  it('jeden podnik se ve výsledcích neopakuje', () => {
    const hits = filterAndSortRestaurants(catalog, {
      cuisineType: 'burger',
      search: 'burger',
      sortBy: 'relevance',
    }).map((item) => item.id)
    assert.equal(hits.length, new Set(hits).size)
  })

  it('New Era je dostupná pod Asie jako sekundární kategorie', () => {
    const hits = filterAndSortRestaurants(catalog, {
      cuisineType: 'asijske',
      sortBy: 'relevance',
    }).map((item) => item.id)
    assert.ok(hits.includes('new-era-restaurace'))
  })
})
