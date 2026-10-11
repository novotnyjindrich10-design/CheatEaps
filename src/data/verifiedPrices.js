import { derivePriceCategory, PRICE_KIND_MENU, PRICE_KIND_RANGE } from '../utils/price.js'

const VERIFIED_AT = '2026-10-10'

function menu({ price, item, source, channel = 'venue', sourceType = 'official' }) {
  return {
    price,
    priceKind: PRICE_KIND_MENU,
    priceItem: item,
    priceSource: source,
    priceSourceType: sourceType,
    priceChannel: channel,
    priceVerifiedAt: VERIFIED_AT,
    priceCategory: derivePriceCategory(price),
  }
}

function range({ min, max, item, source, channel = 'venue', sourceType = 'official' }) {
  return {
    price: min,
    priceMax: max,
    priceKind: PRICE_KIND_RANGE,
    priceEstimate: true,
    priceItem: item,
    priceSource: source,
    priceSourceType: sourceType,
    priceChannel: channel,
    priceVerifiedAt: VERIFIED_AT,
    priceCategory: derivePriceCategory(max),
  }
}

/**
 * Doložené ceny jednoho běžného hlavního jídla, klíč = id provozovny.
 * Overlay se sloučí v demoRestaurants.js. OSM soubor se nemění.
 */
export const verifiedPrices = {
  'forkys-vankovka': menu({
    price: 169,
    item: 'Forky’s burger',
    source: 'https://www.forkys.cz/pobocka/oc-vankovka/',
  }),
  'forky-s-cimburkova-593-4': menu({
    price: 149,
    item: 'Forky’s burger',
    source: 'https://www.forkys.cz/pobocka/nc-kralovo-pole/',
  }),
  'forky-s-technicka-17': menu({
    price: 149,
    item: 'Forky’s burger',
    source: 'https://www.forkys.cz/pobocka/technologicky-park-brno/',
  }),
  'prova-bistro-pizza': menu({
    price: 249,
    item: 'Pizza Margherita',
    source: 'https://provapizza.cz/menu/',
  }),
  'lokofu': menu({
    price: 145,
    item: 'Kuřecí Kung-pao s rýží',
    source: 'https://www.lokofu.cz/cs/',
  }),
  'stopkova-plzenska-pivnice': menu({
    price: 239,
    item: 'Plzeňský guláš',
    source: 'https://stopkova.kolkovna.cz/',
  }),
  'mcdonald-s-masarykova-32': menu({
    price: 115,
    item: 'Big Mac',
    source: 'https://ceniky.mcdonalds.cz/cenik/cenik.jsp?podtyp=11&restaurace=066',
  }),
  'roburrito-pekarska': menu({
    price: 205,
    item: 'Basic burrito',
    source: 'https://roburrito.cz/menu/',
  }),
  'new-era-restaurace': menu({
    price: 279,
    item: 'Beef Noodle Soup',
    source: 'https://newerafood.cz/',
  }),
  'uvozna-burger': menu({
    price: 289,
    item: 'Really Cheeseburger',
    source: 'https://www.uvozna.cz/jidelni-listek',
  }),
  'ilegal-restaurant': range({
    min: 179,
    max: 189,
    item: 'polední hlavní jídlo',
    source: 'https://www.ilegalrestaurant.cz/',
  }),

  'bistro-franz': menu({
    price: 245,
    item: 'Anglická snídaně',
    source: 'https://www.bistrofranz.cz/',
  }),
  'bistro-franz-veveri-461-14': menu({
    price: 245,
    item: 'Anglická snídaně',
    source: 'https://www.bistrofranz.cz/',
  }),
  'gopal-trida-kpt-jarose-10': menu({
    price: 145,
    item: 'Classic menu 500 g',
    source: 'https://gopal.menu/',
  }),
  'pauzza-turanka-115': menu({
    price: 132,
    item: 'Vepřový přírodní řízek, sázené vejce, hranolky',
    source: 'https://www.pauzza.cz/',
  }),
  'il-capo-merhautova-977-101': menu({
    price: 175,
    item: 'polední hlavní jídlo',
    source: 'https://www.ilcapo.cz/',
  }),
  'potrefena-husa-jirova-2': menu({
    price: 169,
    item: 'Mexický vepřový guláš s rýží',
    source: 'https://www.husalisen.cz/menu',
  }),
  'the-himalaya-nadrazni-8': menu({
    price: 170,
    item: 'polední menu',
    source: 'https://www.himalayarestaurace.cz/',
  }),
  'veg8cafe-krenova-45': menu({
    price: 165,
    item: 'hlavní chod obědového menu',
    source: 'https://www.veg8cafe.cz/',
  }),
  'taiyo-solnicni-636-3a': menu({
    price: 159,
    item: 'rizoto a polévka',
    source: 'https://taiyo-restaurant-cz.webnode.page',
  }),
  'no-gluten-no-problem-zamecnicka-181-3': menu({
    price: 280,
    item: 'sýrové placky, batátové hranolky',
    source: 'https://nogluten-noproblem.cz/',
  }),
  'pivni-opice-jostova-138-4': menu({
    price: 189,
    item: 'Menu č. 2',
    source: 'https://www.pivniopice.cz/',
  }),
  'roburrito-foodtruck-purkynova-647-111': menu({
    price: 215,
    item: 'Roburrito',
    source: 'https://roburrito.cz/foodtruck/',
  }),
  'restaurace-our-story-masarova-2407-7': menu({
    price: 187,
    item: 'obědové menu',
    source: 'https://our-story.cz/',
  }),
  'padowetz-masarykova-34': menu({
    price: 389,
    item: 'Zebří guláš na ovocném bourbonu',
    source: 'https://www.restaurant-padowetz.cz/',
  }),
  'pizza-bombastica-jilkova-2301-165': menu({
    price: 229,
    item: 'pizza (stálá nabídka)',
    source: 'https://www.bombasticapub.cz/menu',
  }),
  'zlata-lod-namesti-svobody-5': menu({
    price: 169,
    item: 'smažený sýr s hranolky',
    source: 'https://www.zlatalod.com/',
  }),

  'cat-cafe-martinkova-7': range({
    min: 120,
    max: 199,
    item: 'hlavní jídlo (risotto, těstoviny)',
    source: 'https://thecatcafe.cz/',
  }),
  'curry-house-jiraskova-248-48': range({
    min: 189,
    max: 270,
    item: 'curry (Tikka Masala a další)',
    source: 'https://nepalbrno.cz/CurryHouse/',
  }),
  'don-antonio-pizza-burger-taborska-3216-78': range({
    min: 179,
    max: 339,
    item: 'pizza',
    source: 'https://www.donantonio.cz',
  }),
  'gusto-plzenka-husova-16': range({
    min: 170,
    max: 380,
    item: 'hlavní jídlo (řízek, asijská jídla)',
    source: 'https://gustoplzenka.cz/menu',
  }),
  'hatsu-udolni-33': range({
    min: 185,
    max: 395,
    item: 'korejské hlavní jídlo',
    source: 'https://www.hatsurestaurant.cz/',
  }),
  'hladovy-vlk-jiraskova-51': range({
    min: 139,
    max: 330,
    item: 'pizza',
    source: 'https://www.pizzavlk-brno.cz/',
  }),
  'charlie-s-mill-restaurant-palackeho-trida-91': range({
    min: 149,
    max: 209,
    item: 'polední menu',
    source: 'https://www.charliesmill.cz/',
  }),
  'chutne-stesti-lidicka-1874-38': range({
    min: 139,
    max: 209,
    item: 'čínské hlavní jídlo',
    source: 'https://chutnestesti.cz/',
  }),
  'india-thali-trida-kpt-jarose-13': range({
    min: 125,
    max: 180,
    item: 'indické hlavní jídlo',
    source: 'https://www.indiathali.cz/menu',
  }),
  'manya-pruchodni-2': range({
    min: 219,
    max: 349,
    item: 'asijské hlavní jídlo',
    source: 'https://www.manyabrno.cz',
  }),
  'marmite-cafe-hrncirska-891-17': range({
    min: 95,
    max: 169,
    item: 'polední jídlo',
    source: 'https://marmite.cz/',
  }),
  'na-knofliku-behounska-9': range({
    min: 169,
    max: 219,
    item: 'české polední jídlo',
    source: 'http://www.naknofliku.cz',
  }),
  'na-trati-libusina-trida-880-25': range({
    min: 159,
    max: 265,
    item: 'pizza',
    source: 'https://www.restauracenatrati.cz/',
  }),
  'padthai-palackeho-trida-124': range({
    min: 99,
    max: 229,
    item: 'thajské hlavní jídlo',
    source: 'https://www.padthairestaurace.cz/menu',
  }),
  'pivovarska-brno-mendlovo-namesti-158-20': range({
    min: 179,
    max: 229,
    item: 'polední menu',
    source: 'https://www.pivovarska-starobrno.cz/menu',
  }),
  'pivovarska-restaurace-moravia-kytnerova-6': range({
    min: 179,
    max: 269,
    item: 'smažené / české hlavní jídlo',
    source: 'https://www.pivovarskarestauracemoravia.cz/',
  }),
  'pizzeria-al-capone-hrncirska-6': range({
    min: 119,
    max: 159,
    item: 'polední jídlo',
    source: 'https://www.pizzaalcapone.cz/menu',
  }),
  'plzensky-dvur-sumavska-29a': range({
    min: 159,
    max: 279,
    item: 'hlavní jídlo',
    source: 'https://www.plzenskydvur.cz/menu',
  }),
  'poupe-dominikanska-342-15': range({
    min: 185,
    max: 225,
    item: 'hlavní jídlo',
    source: 'https://www.pivovar-poupe.cz/',
  }),
  'restaurace-globus-hradecka-40': range({
    min: 109,
    max: 239,
    item: 'polední jídlo (svíčková a další)',
    source: 'https://www.globus.cz/brno/sluzby-a-produkty/restaurace',
  }),
  'restaurace-rubin-makovskeho-namesti-2574-1': range({
    min: 219,
    max: 319,
    item: 'hlavní jídlo',
    source: 'https://www.restauracerubin.cz/',
  }),
  'ristorante-piazza-namesti-svobody-9': range({
    min: 172,
    max: 272,
    item: 'pizza',
    source: 'https://www.piazza.cz/menu',
  }),
  'rud-s-pizza-cimburkova-593-4': range({
    min: 219,
    max: 279,
    item: 'pizza',
    source: 'https://rudspizza.cz/menu',
  }),
  'slatina-bistro-turanka-1519-115a': range({
    min: 130,
    max: 195,
    item: 'pizza',
    source: 'https://www.slatinabistro.cz',
  }),
  'terasa-hnevkovskeho-26': range({
    min: 139,
    max: 220,
    item: 'pizza',
    source: 'https://www.terasabrno.cz/',
  }),
  'turanska-beseda-podlipna-140-25': range({
    min: 189,
    max: 289,
    item: 'burger',
    source: 'https://turanskabeseda.cz/',
  }),
  'u-richarda-risova-12': range({
    min: 175,
    max: 215,
    item: 'polední jídlo',
    source: 'http://www.uricharda.eu/',
  }),
  'vegan-af-ramen-maresova-14': range({
    min: 139,
    max: 259,
    item: 'ramen / bowl',
    source: 'https://www.veganaframen.cz/menu',
  }),
  'cartel-grohova-19': range({
    min: 180,
    max: 239,
    item: 'pizza 33 cm',
    source: 'https://www.cartelpizza.cz',
  }),
  'colatransport-pisniky-409': range({
    min: 120,
    max: 360,
    item: 'hlavní jídlo',
    source: 'https://colatransport.cz/',
  }),
  'havana-restaurant-masarova-9': range({
    min: 119,
    max: 170,
    item: 'hlavní jídlo',
    source: 'https://www.havana-restaurant.cz/',
  }),
  'leonardo-stefanikova-12': range({
    min: 138,
    max: 188,
    item: 'hlavní jídlo',
    source: 'https://www.sanatoriumhelios.cz/restaurace-leonardo/',
  }),
  'mori-sportovni-559-2a': range({
    min: 125,
    max: 235,
    item: 'sushi / asijské jídlo',
    source: 'https://www.themori.cz/',
  }),
  'mr-sushito-janska-10': range({
    min: 189,
    max: 229,
    item: 'sushi sada',
    source: 'http://mrsushito.cz',
  }),
  'nok-nok-restaurant-zamecnicka-1': range({
    min: 139,
    max: 199,
    item: 'hlavní jídlo s noky',
    source: 'https://www.noknokrestaurant.cz/nok-nok-restaurant-brno/',
  }),
  'park-lane-luzanecka-4a': range({
    min: 129,
    max: 199,
    item: 'snídaně / quiche',
    source: 'http://www.parklanecafe.cz/',
  }),
  'u-trech-certu-dvorakova-8': range({
    min: 149,
    max: 269,
    item: 'hlavní jídlo',
    source: 'http://ucertu.cz/dvorakova/',
  }),
  'sabaidy-trida-kpt-jarose-29': range({
    min: 120,
    max: 210,
    item: 'thajské hlavní jídlo',
    source: 'https://www.amphone.eu/restaurace',
  }),
  'vosime-cz-stefanikova-93-22': range({
    min: 229,
    max: 359,
    item: 'pizza',
    source: 'https://vosime.cz/pobocka/brno-sever',
  }),
  'kometa-pub-miki-makovskeho-namesti-3166-2': range({
    min: 169,
    max: 199,
    item: 'polední menu',
    source: 'https://www.kometapub.cz/miki',
  }),
  'fako-club-hasicska-16-18': range({
    min: 140,
    max: 160,
    item: 'polední menu',
    source: 'https://fako-club.cz/',
  }),
}
