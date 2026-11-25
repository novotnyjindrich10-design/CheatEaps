/**
 * Ověřené vedlejší kategorie a konkrétní produkty.
 * Primární kategorii nepřepisují — jen rozšiřují filtr/search.
 * confidence: high | medium
 * secondary: FOOD_CATEGORIES values (významná ověřená vedlejší nabídka)
 * products: konkrétní jídla/služby (espresso, brunch, pho…) — nestačí na celou kategorii
 */
export const secondaryCategoryByPlaceId = {
  'amici-pizza-burgers-palackeho-trida-82': {
    secondary: ['burger'],
    products: ['burger', 'pizza'],
    confidence: 'high',
    evidence: 'Název Amici Pizza & Burgers; OSM cuisine=pizza;burger; oficiální web amici.cz.',
    sourceUrl: 'https://www.amici.cz/',
  },
  'don-antonio-pizza-burger-taborska-3216-78': {
    secondary: ['burger'],
    products: ['burger', 'pizza'],
    confidence: 'high',
    evidence: 'Název Don Antonio Pizza & Burger; OSM cuisine=pizza;burger; web donantonio.cz.',
    sourceUrl: 'https://www.donantonio.cz',
  },
  'forkys-vankovka': {
    secondary: ['burger'],
    products: ['burger', 'wrap', 'bowl'],
    confidence: 'high',
    evidence: 'Oficiální popis/menu Forky’s: veganské burgery, wrapy a bowl (burger od 169 Kč).',
    sourceUrl: 'https://www.forkys.cz/pobocka/oc-vankovka/',
  },
  'vegan-af-ramen-maresova-14': {
    secondary: ['veganske'],
    products: ['ramen'],
    confidence: 'high',
    evidence: 'Oficiální web: první 100% veganská ramen restaurace v Brně; celé menu vegan.',
    sourceUrl: 'https://veganaframen.cz/',
  },
  'new-era-restaurace': {
    secondary: ['asijske'],
    products: ['sushi', 'pho'],
    confidence: 'high',
    evidence: 'Web newerafood.cz + OSM cuisine=sushi;chinese;asian — knedlíčky, kari, pho a sushi.',
    sourceUrl: 'https://newerafood.cz/',
  },
  'lokofu': {
    secondary: ['asijske'],
    products: [],
    confidence: 'high',
    evidence: 'OSM cuisine=asian;chinese;thai; oficiální web lokofu.cz — širší asijská nabídka vedle čínské.',
    sourceUrl: 'https://www.lokofu.cz/cs/',
  },
  'aida-cafe-restaurant-josefska-21': {
    secondary: ['kava'],
    products: ['espresso', 'kava'],
    confidence: 'medium',
    evidence: 'Název AIDA Cafe & Restaurant; cukrárenská kavárna La Dolce Vita AIDA.',
    sourceUrl: 'https://www.ladolcevita-aida.cz/',
  },
  'brana-ke-zdravi-orli-17': {
    secondary: ['zdrave'],
    products: [],
    confidence: 'high',
    evidence: 'Název Brána ke zdraví; oficiální web branakezdravi.cz — zdravé stravování / kavárna.',
    sourceUrl: 'https://branakezdravi.cz/',
  },
  'fresh-fitpeople-videnska-132-100': {
    secondary: ['zdrave'],
    products: ['bowl', 'salad'],
    confidence: 'high',
    evidence: 'Fresh FitPeople — fitness / fresh stravování (freshfitpeople.cz).',
    sourceUrl: 'https://freshfitpeople.cz/',
  },
  'ugo-cimburkova-4': {
    secondary: ['zdrave'],
    products: ['juice', 'salad'],
    confidence: 'medium',
    evidence: 'UGO freshbar — džusy a saláty (ugo.cz); primárně fastfood, vedlejší zdravé.',
    sourceUrl: 'https://www.ugo.cz/kde-koupim-ugo/75-ugo-freshbar-oc-kralovo-pole-brno',
  },
  'pokecz-basty-414': {
    secondary: [],
    products: ['poke', 'bowl'],
    confidence: 'high',
    evidence: 'Poké bistro — menu poke bowls včetně vegan variant (pokecz.cz). Není veganský podnik ani plošně „zdravé“.',
    sourceUrl: 'https://www.pokecz.cz/menu?menu=dinner-menu',
  },
  'yakitori-sushi-poke-bar-netroufalky-770': {
    secondary: [],
    products: ['poke', 'sushi'],
    confidence: 'high',
    evidence: 'Yakitori Sushi Poke Bar — poke + sushi (ykf.cz / OSM sushi;poke).',
    sourceUrl: 'https://www.ykf.cz/poke-bar-oc-campus-square/poke-bar-campus-square-poke',
  },
  'break-feast-dvorakova-43-12': {
    secondary: [],
    products: ['brunch', 'snidane'],
    confidence: 'high',
    evidence: 'OSM cuisine=brunch; web eggofoodtruck.cz (Break Feast).',
    sourceUrl: 'https://www.eggofoodtruck.cz/',
  },
  'coffee-bar-story-lidicka-15': {
    secondary: [],
    products: ['brunch', 'espresso', 'kava'],
    confidence: 'high',
    evidence: 'OSM cuisine=coffee_shop;brunch; web cbstory.cz.',
    sourceUrl: 'https://cbstory.cz',
  },
  'omni-cafe-brunch-pekarska-56': {
    secondary: [],
    products: ['brunch', 'snidane', 'kava'],
    confidence: 'medium',
    evidence: 'Název omni café brunch — kavárna se zaměřením na brunch.',
    sourceUrl: '',
  },
  'le-brunch-smetanova-284-13': {
    secondary: [],
    products: ['brunch', 'snidane'],
    confidence: 'medium',
    evidence: 'Název Le Brunch; primárně kavárna s brunch nabídkou.',
    sourceUrl: '',
  },
  'brunche-s-vodova-63': {
    secondary: [],
    products: ['brunch', 'snidane'],
    confidence: 'medium',
    evidence: 'Název Brunche’s; kavárna zaměřená na brunch.',
    sourceUrl: '',
  },
  'monogram-espresso-bar': {
    secondary: [],
    products: ['espresso', 'kava'],
    confidence: 'high',
    evidence: 'Název Monogram Espresso Bar; oficiální web monogramespressobar.cz.',
    sourceUrl: 'https://www.monogramespressobar.cz/kontakt',
  },
  'monogram-espresso-bar-kapucinske-namesti-12': {
    secondary: [],
    products: ['espresso', 'kava'],
    confidence: 'high',
    evidence: 'Monogram Espresso Bar Kapucínské — espresso bar (monogramespressobar.cz).',
    sourceUrl: 'https://www.monogramespressobar.cz/',
  },
  'au-lait-espresso-bar-gorkeho-96-54': {
    secondary: [],
    products: ['espresso', 'kava'],
    confidence: 'medium',
    evidence: 'Název Au Lait espresso bar.',
    sourceUrl: 'https://www.instagram.com/aulait_espressobar/',
  },
  'gill-s-espresso-bar-veveri-9': {
    secondary: [],
    products: ['espresso', 'kava'],
    confidence: 'medium',
    evidence: 'Název Gill’s Espresso Bar.',
    sourceUrl: '',
  },
  'pho-43-trida-kpt-jarose-20': {
    secondary: [],
    products: ['pho'],
    confidence: 'high',
    evidence: 'Název PHO 43; OSM asian;vietnamese.',
    sourceUrl: '',
  },
  'pho-ha-noi-jakubske-namesti-1': {
    secondary: [],
    products: ['pho'],
    confidence: 'high',
    evidence: 'Název Pho Ha Noi; OSM vietnamese.',
    sourceUrl: '',
  },
  'pho-viet-nam-divadelni-6': {
    secondary: [],
    products: ['pho'],
    confidence: 'high',
    evidence: 'Název Pho Viet nam; asijské vietnamské bistro.',
    sourceUrl: '',
  },
  'toppu-ramen-behounska-129-13': {
    secondary: [],
    products: ['ramen'],
    confidence: 'high',
    evidence: 'Název TOPPU RAMEN; web toppuramen.cz.',
    sourceUrl: 'https://www.toppuramen.cz/',
  },
}

export function getSecondaryCategoryInfo(placeId) {
  return secondaryCategoryByPlaceId[placeId] || null
}

export function listSecondaryAssignments() {
  return Object.entries(secondaryCategoryByPlaceId).map(([id, row]) => ({
    id,
    secondary: row.secondary || [],
    products: row.products || [],
    confidence: row.confidence,
    evidence: row.evidence,
    sourceUrl: row.sourceUrl || '',
  }))
}
