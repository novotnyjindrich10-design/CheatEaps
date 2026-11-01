/**
 * Ověřené opravy kategorií podniků.
 * Aplikace: demoRestaurants.js bere override před category ze zdroje.
 * Synchronizace do osmPlaces: node scripts/apply-category-overrides.mjs
 *
 * confidence: high | medium
 * evidence: stručný důvod + zdroj
 */
export const categoryOverrides = {
  "hostinec-u-ferdinanda-karaskovo-namesti-2457-17": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Tradiční hostinec s českou/staročeskou kuchyní (řízek, tatarák, hermelín).",
    "sourceUrl": "https://uferdinanda.cz/poledni-menu/"
  },
  "pellegrini-namesti-svobody-18": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "medium",
    "evidence": "Italská restaurace s výraznou sekcí pizzy (32 cm) na jídelním lístku.",
    "sourceUrl": "https://www.pellegrini.cz/jidelni-listek"
  },
  "u-lucerny-slovakova-2": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Oficiální jídelní lístek: řízek, žebírka a česká denní nabídka.",
    "sourceUrl": "https://www.u-lucerny.cz/jidelni-listek"
  },
  "ctyri-ruze-veveri-32": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Pivní šenk Čtyři růže: poctivá česká kuchyně, žebra, koleno.",
    "sourceUrl": "https://ctyriruze.restaurace-laguna.cz/"
  },
  "nase-vase-bistro-jaselska-8": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Denní menu: knedlíky, kyselica, smažený sýr a další česká jídla.",
    "sourceUrl": "https://nasevasebistro.cz/denni-menu-2/"
  },
  "skolni-jidelna-brno-horni-16": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Veřejné jídelníčky školní jídelny Horní: řízek, halušky, vepřové pokrmy.",
    "sourceUrl": "https://strav.nasejidelna.cz/0376/index.jsp",
    "removeIllustration": true
  },
  "bystrcka-oaza-lyskova-1031-2": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Oficiální web: restaurace s poctivou českou kuchyní.",
    "sourceUrl": "https://bystrckaoaza.cz/"
  },
  "na-halach-stredni-26": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Týdenní obědy Sportcentrum Lužánky: guláš, kotleta, játra.",
    "sourceUrl": "https://www.sportcentrumluzanky.cz/restaurace/"
  },
  "alvin-hudcova-2": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "medium",
    "evidence": "Jídelní lístek má rozsáhlou sekci pizza 33 cm.",
    "sourceUrl": "https://www.alvinrestaurace.cz/cenik/"
  },
  "restaurace-u-badinu-tomaskova-2": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Pivnice U Badinů: svíčková, koleno, žebra a česká pivní kuchyně.",
    "sourceUrl": "https://www.ubadinu.cz/"
  },
  "buffalo-express-nadrazni-4": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "medium",
    "evidence": "Menu: pho xao, pad thai, panang kari (vietnamská/thajská nabídka).",
    "sourceUrl": "https://menunet.cz/place/WU8K5O3TN7OoUzvziPKens/menu/"
  },
  "slatinsky-senk-zlinska-12": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "high",
    "evidence": "Stálý lístek dominuje sekcemi pizza Pomodoro/Bianco.",
    "sourceUrl": "https://www.slatinskysenk.cz/soubor/jidelni-a-napojovy-listek/"
  },
  "kometa-pub-kridlovicka-34": {
    "category": "fastfood",
    "type": "Fast food",
    "confidence": "medium",
    "evidence": "Zápasové menu: burgery, cibulové kroužky, řízečky, žebra (stadionový fast service).",
    "sourceUrl": "http://arena.kometapub.cz/"
  },
  "restaurace-v-zatacce-absolonova-836-10a": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Oficiální text: české kulinářské dobrodružství / tradiční kuchyně.",
    "sourceUrl": "https://restaurace-v-zatacce.eatbu.com/"
  },
  "aida-cafe-restaurant-josefska-21": {
    "category": "sladke",
    "type": "Sladké",
    "confidence": "high",
    "evidence": "Cukrárna: zákusky, dorty, zmrzlina.",
    "sourceUrl": "https://www.ladolcevita-aida.cz/"
  },
  "an-wok-grill-krizova-55-5": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "high",
    "evidence": "Vietnamský wok a grill.",
    "sourceUrl": "https://wolt.com/cs/cze/brno/restaurant/an-wok-grill"
  },
  "bar-gril-u-nas-masarova-11a": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Specializace na českou klasiku.",
    "sourceUrl": "https://www.baragrilunas.cz/kontakt/"
  },
  "baroko-orli-17": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Svíčková, řízek, španělský ptáček, kachna.",
    "sourceUrl": "https://baroko.org/jidelni-listek/"
  },
  "bep-vietnamese-village-cuisine-koblizna-9": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "high",
    "evidence": "Vietnamese Village Cuisine – vietnamská kuchyně.",
    "sourceUrl": "https://bepbrno.cz/"
  },
  "bon-ami-restaurant-komarovska-352-7": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Poctivá domácí kuchyně, rodinná restaurace.",
    "sourceUrl": "https://www.bonamirestaurant.cz/"
  },
  "borgeska-palackeho-trida-47": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Česká pivní kuchyně: guláš, řízek, kachna, tatarák.",
    "sourceUrl": "https://borgeska.proweb.cz/jidelni-listek"
  },
  "bun-dvorakova-16": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "high",
    "evidence": "Vietnamská kuchyně (bún, pho).",
    "sourceUrl": "https://wolt.com/en/cze/brno/restaurant/bun"
  },
  "cafe-rudolf-namesti-svobody-17": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Kávový nápojový lístek Café Rudolf.",
    "sourceUrl": "https://rudolfcafe.cz/"
  },
  "coffee-trail-lidicka-lidicka-46": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Kavárna s výběrovou kávou.",
    "sourceUrl": "https://www.coffeetrail.cz/"
  },
  "nihao-stefanikova-15": {
    "category": "cina",
    "type": "Čína",
    "confidence": "high",
    "evidence": "Čínská restaurace (sekce čínských jídel); dříve asijske.",
    "sourceUrl": "https://wolt.com/cs/cze/brno/restaurant/n-hao"
  },
  "cha-do-zelny-trh-10": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Čajovna / matcha – nápojový podnik, ne čínská restaurace.",
    "sourceUrl": "https://www.chadobrno.com/"
  },
  "panda-netroufalky-770": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "medium",
    "evidence": "Asijský food-court pult (nudle, wok); ne čistá čínská restaurace.",
    "sourceUrl": "http://www.campusbrno.cz/en/panda-1"
  },
  "pokecz-basty-414": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "high",
    "evidence": "Poké bowls – asijská nabídka, ne obecný fast food.",
    "sourceUrl": "https://www.pokecz.cz/menu"
  },
  "globus-bistro-reckovicka-555-3": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Globus bistro / teplý pult s českými hotovými jídly.",
    "sourceUrl": "https://www.firmy.cz/detail/13819097-globus-bistro-brno-ivanovice.html"
  },
  "spaghetti-parmigiano-videnska-132-100": {
    "category": "neuvedeno",
    "type": "Restaurace",
    "confidence": "medium",
    "evidence": "Italské těstoviny/rizoto – v aplikaci není kategorie pasta; fast food byl chybný.",
    "sourceUrl": "https://menunet.cz/restaurace/ChIJzU5Dw8CVEkcRTlKQYO0Aj_I/delivery-menu-id/"
  },
  "spaghetti-parmigiano-cimburkova-593-4": {
    "category": "neuvedeno",
    "type": "Restaurace",
    "confidence": "medium",
    "evidence": "Stejný koncept těstovin jako Vídeňská; fast food byl chybný.",
    "sourceUrl": "https://menunet.cz/restaurace/ChIJzU5Dw8CVEkcRTlKQYO0Aj_I/delivery-menu-id/"
  },
  "spaghetti-d-amore-panska-2": {
    "category": "neuvedeno",
    "type": "Restaurace",
    "confidence": "medium",
    "evidence": "Italské těstoviny (OSM italian); není pizza-only – bez kategorie pasta zůstává neuvedeno.",
    "sourceUrl": "https://menunet.cz/restaurace/ChIJ4Z2dQsiVEkcR7mTyL5b7sKE/delivery-menu-id/"
  },
  "bubblify-ceska-26": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Bubble tea řetězec – nápoje, ne fast food.",
    "sourceUrl": "https://www.slevomat.cz/podnik/185592-bubblify"
  },
  "moravanska-rychta-stredni-55-9": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "high",
    "evidence": "Pizza & Pub Bombastica – vyhlášená pizza z trouby.",
    "sourceUrl": "https://www.moravanyubrna.cz/volny-cas/restaurace-a-obcerstveni/moravanska-rychta-pizza-pub-bombastica"
  },
  "vesela-cajovna-koblizna-5": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "high",
    "evidence": "Indická kuchyně (butter chicken, tikka, tandoor) – už asijske, potvrzeno.",
    "sourceUrl": "https://www.veselacajovna.cz/menu/"
  },
  "don-miguel-s-palackeho-trida-35": {
    "category": "mexiko",
    "type": "Mexiko",
    "confidence": "high",
    "evidence": "Mexická restaurace (Chuť Mexika).",
    "sourceUrl": "https://www.donmiguels.cz/"
  },
  "gusto-plzenka-husova-16": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Česká a moravská kuchyně.",
    "sourceUrl": "https://gustoplzenka.cz/"
  },
  "pizzeria-la-gamba-okruzni-9b": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "medium",
    "evidence": "Pizzerie – pizza dle milánské receptury.",
    "sourceUrl": "https://www.pizzeria-lagamba.com/"
  },
  "pivni-opice-jostova-138-4": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Restaurace & pub s poledním menu.",
    "sourceUrl": "https://www.pivniopice.cz/"
  },
  "pivnice-masny-ruzek-krenova-70": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Pivnice se zaměřením na maso a plzeňské pivo.",
    "sourceUrl": "https://www.pivnicemasnyruzek.cz/o-nas"
  },
  "pivnice-u-tygra-vrchlickeho-sad-3": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Pivnice: české pochutiny k pivu.",
    "sourceUrl": "https://www.pivniceutygra.cz/"
  },
  "kominska-rychta-kristenova-14": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Hospoda: dršťková, řízečky, kotleta, tatarák.",
    "sourceUrl": "https://www.kominskarychta.cz/"
  },
  "na-ruzku-stefanikova-25": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Restaurace a pivnice s poledním menu.",
    "sourceUrl": "https://www.naruzkubrno.cz/"
  },
  "u-dvoraku-hlavni-119": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Tradiční hospoda: škopek a maso.",
    "sourceUrl": "https://www.udvoraku-brno.cz/"
  },
  "u-dreveneho-vlka-zelny-trh-1": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Pivní bar s denním menu.",
    "sourceUrl": "https://www.drevenyvlk.cz/"
  },
  "laguna-smetanova-2": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Tradiční brněnská restaurace s denním menu.",
    "sourceUrl": "https://restaurace-laguna.cz/"
  },
  "haribol-luzanecka-4": {
    "category": "veganske",
    "type": "Vegan",
    "confidence": "high",
    "evidence": "Veganská jídelna – pouze veganské pokrmy.",
    "sourceUrl": "https://www.haribol.cz/"
  },
  "vegalite-slovakova-10": {
    "category": "vegetarianske",
    "type": "Bez masa",
    "confidence": "medium",
    "evidence": "Veganská a vegetariánská kuchyně.",
    "sourceUrl": "https://vegalite.cz/"
  },
  "jidelna-100-chuti-kolejni-14": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Denní menu: guláš, kotleta, řízečky.",
    "sourceUrl": "https://jidelna100chuti.cz/"
  },
  "jidelna-sindelar-a-syn-cejl-60": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Obědové menu s českými hotovkami.",
    "sourceUrl": "https://www.sindelar.cz/"
  },
  "jidelna-kocourek-hlinky-105": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Tradiční české jídlo (svíčková, řízek, guláše).",
    "sourceUrl": "http://www.jidelnakocourek.cz/"
  },
  "faircafe-rybarska-202-19": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Restaurace: svíčková, řízek, výpečky.",
    "sourceUrl": "https://www.fairhotel.cz/restaurace"
  },
  "tivoli-konecneho-namesti-539-6": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "TIVOLI Caffé – kavárna.",
    "sourceUrl": "http://tivolicafe.cz/"
  },
  "padowetz-masarykova-34": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Hospodská kuchyně: guláše.",
    "sourceUrl": "https://www.restaurant-padowetz.cz/"
  },
  "restaurace-our-story-masarova-2407-7": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "medium",
    "evidence": "Denní menu s pizzou; sekce Pizza.",
    "sourceUrl": "https://our-story.cz/"
  },
  "no-gluten-no-problem-zamecnicka-181-3": {
    "category": "zdrave",
    "type": "Zdravé",
    "confidence": "high",
    "evidence": "Bezlepková / zdravá kuchyně.",
    "sourceUrl": "https://nogluten-noproblem.cz/"
  },
  "sesamo-purkynova-97c": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "high",
    "evidence": "SESAMO BAKERY PIZZA.",
    "sourceUrl": "https://sesamobrno.cz/"
  },
  "charlie-s-park-kolejni-3015": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Denní menu s českými jídly.",
    "sourceUrl": "https://charliespark.cz/"
  },
  "u-richarda-risova-12": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Pivovarská restaurace s českým menu.",
    "sourceUrl": "http://www.uricharda.eu/"
  },
  "pub-pred-zrcadlem-jaselska-17": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Čajovna Za Zrcadlem – čaje a káva.",
    "sourceUrl": "https://cajovnazazrcadlem.cz/"
  },
  "turanska-beseda-podlipna-140-25": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Svíčková, řízek, gulášová – česká kuchyně.",
    "sourceUrl": "https://turanskabeseda.cz/"
  },
  "svatovavrinecky-dvur-tukan-palackeho-namesti-2050-9a": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Poctivá domácí / česká klasika.",
    "sourceUrl": "https://www.svatovavrineckydvur.cz/"
  },
  "slatina-bistro-turanka-1519-115a": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "medium",
    "evidence": "Stálá nabídka včetně sekce Pizza.",
    "sourceUrl": "https://www.slatinabistro.cz"
  },
  "naber-si-rosickeho-namesti-196-9": {
    "category": "zdrave",
    "type": "Zdravé",
    "confidence": "medium",
    "evidence": "Bistro se zdravější / čerstvou nabídkou.",
    "sourceUrl": "https://nabersi.cz/"
  },
  "portoriko-srbska-2653-51": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Klasika: řízky, svíčková, kachna.",
    "sourceUrl": "https://restauraceportoriko.cz/jidelni-listek"
  },
  "poupe-dominikanska-342-15": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Pivovarský dům: svíčková, řízek, guláš.",
    "sourceUrl": "https://www.pivovar-poupe.cz/"
  },
  "fako-club-hasicska-16-18": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Denní menu: sekaná, řízek, svíčková.",
    "sourceUrl": "https://fako-club.cz/"
  },
  "thalie-rooseveltova-14": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Klasická staročeská jídla.",
    "sourceUrl": "https://www.thalie.cz/"
  },
  "dukat-loosova-1": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Teplá kuchyně, řízkový talíř, žebra.",
    "sourceUrl": "https://www.restauracedukat.cz/"
  },
  "restaurace-rubin-makovskeho-namesti-2574-1": {
    "category": "mexiko",
    "type": "Mexiko",
    "confidence": "high",
    "evidence": "Fajitas, enchiladas, burrito, nachos.",
    "sourceUrl": "https://www.restauracerubin.cz/"
  },
  "kometa-pub-miki-makovskeho-namesti-3166-2": {
    "category": "fastfood",
    "type": "Fast food",
    "confidence": "medium",
    "evidence": "Stadionové menu (guláš, řízek, burger).",
    "sourceUrl": "https://www.kometapub.cz/miki"
  },
  "tackarna-turanka-turanka-1387-100": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "high",
    "evidence": "Neapolská pizza z kamenné pece.",
    "sourceUrl": "https://turanka.tackarna.cz/"
  },
  "eatology-holandska-6": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Polední menu: tradiční česká kuchyně.",
    "sourceUrl": "http://www.iqrestaurant.cz/brno/home.html"
  },
  "pivnice-pegas-jakubska-120-4": {
    "category": "ceske",
    "type": "České",
    "confidence": "high",
    "evidence": "Moravská a česká kuchyně v pivnici Pegas.",
    "sourceUrl": "https://brnorestauracepivnice.hotelpegas.com/"
  },
  "pegas-jiraskova-44": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Koncept Pegas – česká/moravská kuchyně.",
    "sourceUrl": "https://brnorestauracepivnice.hotelpegas.com/"
  },
  "u-kormidla-kounicova-43": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Restaurace s denním obědovým menu.",
    "sourceUrl": "https://www.ukormidla.cz/"
  },
  "u-tesare-grmelova-9": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Hostinec s denní nabídkou.",
    "sourceUrl": "http://www.utesare.cz"
  },
  "restaurace-valoria-bohunicka-2": {
    "category": "ceske",
    "type": "České",
    "confidence": "medium",
    "evidence": "Česká kuchyně (s francouzskými prvky).",
    "sourceUrl": "https://www.valoria.cz/"
  },
  "rebio-holandska-1": {
    "category": "zdrave",
    "type": "Zdravé",
    "confidence": "high",
    "evidence": "Restaurace zdravého životního stylu.",
    "sourceUrl": "https://www.rebio.cz/"
  },
  "zdravy-zivot-jaselska-11": {
    "category": "zdrave",
    "type": "Zdravé",
    "confidence": "high",
    "evidence": "Restaurace Zdravý život.",
    "sourceUrl": "https://www.zzbrno.cz/"
  },
  "bistro-franz-veveri-461-14": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "medium",
    "evidence": "Bistro s výběrovou kávou a zákusky.",
    "sourceUrl": "https://www.bistrofranz.cz/"
  },
  "terasa-hnevkovskeho-26": {
    "category": "pizza",
    "type": "Pizza",
    "confidence": "high",
    "evidence": "Pizza lístek a burgery na oficiálním webu.",
    "sourceUrl": "https://www.terasabrno.cz/"
  },
  "coffee4all-chironova-8": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Kavárna Coffee4all.",
    "sourceUrl": "https://coffee4all.cz"
  },
  "aroha-cafe-krenova-183-57": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Aroha café – kavárna (oprava z ceske).",
    "sourceUrl": "https://www.facebook.com/Arohabistrocafe/"
  },
  "rebelbean-prizova-5": {
    "category": "kava",
    "type": "Kavárna",
    "confidence": "high",
    "evidence": "Pražírna a kavárna Rebelbean (oprava z fastfood).",
    "sourceUrl": "https://www.rebelbean.cz/"
  },
  "wok-99-cejl-544-99": {
    "category": "asijske",
    "type": "Asijské",
    "confidence": "medium",
    "evidence": "Wok bistro – asijská rychlá kuchyně.",
    "sourceUrl": ""
  },
  "kurdsky-kebab-cejl-93": {
    "category": "kebab",
    "type": "Kebab",
    "confidence": "high",
    "evidence": "Kebab v názvu a nabídce (oprava z fastfood).",
    "sourceUrl": ""
  },
  "kurdsky-kebab-lidicka-33": {
    "category": "kebab",
    "type": "Kebab",
    "confidence": "high",
    "evidence": "Kebab v názvu a nabídce (oprava z fastfood).",
    "sourceUrl": ""
  },
  "lion-kebab-milady-horakove-1957-15": {
    "category": "kebab",
    "type": "Kebab",
    "confidence": "high",
    "evidence": "Kebab v názvu a nabídce (oprava z fastfood).",
    "sourceUrl": ""
  },
  "marhaba-kebab-cejl-39": {
    "category": "kebab",
    "type": "Kebab",
    "confidence": "high",
    "evidence": "Kebab v názvu a nabídce (oprava z fastfood).",
    "sourceUrl": ""
  },
  "rock-kebab-kastanova-579-76": {
    "category": "kebab",
    "type": "Kebab",
    "confidence": "high",
    "evidence": "Kebab v názvu a nabídce (oprava z fastfood).",
    "sourceUrl": ""
  },
  "roj-kebab-panska-1": {
    "category": "kebab",
    "type": "Kebab",
    "confidence": "high",
    "evidence": "Kebab v názvu a nabídce (oprava z fastfood).",
    "sourceUrl": ""
  }
}

/** Place IDs, u kterých se má úplně odstranit ilustrace (detail = SVG fallback). */
export const illustrationRemovals = Object.entries(categoryOverrides)
  .filter(([, row]) => row.removeIllustration)
  .map(([id]) => id)

export function getCategoryOverride(placeId) {
  return categoryOverrides[placeId] || null
}
