/**
 * Jen server. Neimportovat z Reactu.
 * Kódy a postup se do prohlížeče dostanou až po ověřené relaci.
 */

export const DEAL_PRIVATE = {
  'kfc-isic-twister': {
    code: 'TWIST2ISIC',
    sourceUrl: 'https://www.isic.cz/slevy/cr/kfc/709',
    conditions: [
      'Platný průkaz ISIC a ALIVE.',
      'Platí v restauracích KFC po celé ČR.',
      'Stránka neuvádí datum začátku ani konce.',
    ],
    steps: [
      'Na pokladně ukaž průkaz a řekni, že chceš 2× Twister za 149 Kč.',
      'V Objednej a vyzvedni zadej kód níže a při vyzvednutí znovu ukaž průkaz.',
    ],
  },
  'kfc-isic-qurrito': {
    code: 'QURRITOISIC',
    sourceUrl: 'https://www.isic.cz/slevy/cr/kfc/709',
    conditions: [
      'Platný průkaz ISIC a ALIVE.',
      'Qurrito a hranolky 80 g za 100 Kč, restaurace KFC po celé ČR.',
      'Stránka neuvádí datum začátku ani konce.',
    ],
    steps: [
      'Na pokladně ukaž průkaz a objednej Qurrito s hranolkami za 100 Kč.',
      'V Objednej a vyzvedni zadej kód níže a při vyzvednutí ukaž průkaz.',
    ],
  },
  'kfc-isic-cheeseburger': {
    code: 'CHEESEISIC',
    sourceUrl: 'https://www.isic.cz/slevy/cr/kfc/709',
    conditions: [
      'Platný průkaz ISIC a ALIVE.',
      'Cheeseburger za 35 Kč, restaurace KFC po celé ČR.',
      'Stránka neuvádí datum začátku ani konce.',
    ],
    steps: [
      'Na pokladně ukaž průkaz a objednej cheeseburger za 35 Kč.',
      'V Objednej a vyzvedni zadej kód níže a při vyzvednutí ukaž průkaz.',
    ],
  },
  'mcdonalds-isic-mcmenu': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    conditions: [
      'Jednou za den.',
      'Velké McMenu za 155 Kč platí na Big Mac, McRoyal, McChicken a 6 ks McNuggets.',
      'Částka je zvláštní cena, ne procento z jiného menu.',
      'Stránka neuvádí datum začátku ani konce.',
    ],
    steps: [
      'Před zaplacením řekni, že chceš nabídku pro ISIC nebo ITIC.',
      'Ukaž platný průkaz. Kód stránka neuvádí.',
    ],
  },
  'mcdonalds-isic-mcmuffin': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    conditions: [
      'Jednou za den.',
      'McMuffin se slaninou a vajíčkem menu za 89 Kč.',
      'Stránka neuvádí datum začátku ani konce.',
    ],
    steps: ['Před zaplacením ukaž platný průkaz ISIC nebo ITIC. Kód stránka neuvádí.'],
  },
  'mcdonalds-isic-mccafe': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/mcdonald-s/729',
    conditions: [
      'Jednou za den.',
      'Café latte 0,3 l nebo cappuccino 0,2 l za 55 Kč.',
      'Stránka neuvádí datum začátku ani konce.',
    ],
    steps: ['Před zaplacením ukaž platný průkaz ISIC nebo ITIC. Kód stránka neuvádí.'],
  },
  'burger-king-isic-steakhouse': {
    code: '',
    sourceUrl: 'https://www.isic.cz/en/discounts/discounts-in-the-czech-republic/burger-king/720',
    conditions: [
      'Steakhouse burger, střední hranolky a bezedný nápoj 0,3 l za 189 Kč.',
      'Cena je na anglické verzi záznamu ISIC. Český výpis stejné stránky cenu v nadpisu nezobrazil.',
      'Stránka neuvádí omezení na konkrétní pobočku ani datum konce.',
    ],
    steps: ['Na pokladně ukaž platný průkaz ISIC. Kód stránka neuvádí.'],
  },
  'burger-king-isic-chicken': {
    code: '',
    sourceUrl: 'https://www.isic.cz/en/discounts/discounts-in-the-czech-republic/burger-king/720',
    conditions: [
      'Crispy Chicken burger, 6 nugetek a omáčka za 129 Kč.',
      'Cena je na anglické verzi záznamu ISIC.',
      'Stránka neuvádí omezení na konkrétní pobočku ani datum konce.',
    ],
    steps: ['Na pokladně ukaž platný průkaz ISIC. Kód stránka neuvádí.'],
  },
  'ugo-isic-fresh': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    conditions: [
      'Drink č. 9 na rovnováhu, 0,3 l, za 79 Kč.',
      'Jednou za den.',
      'Stránka neuvádí datum konce.',
    ],
    steps: ['Před zaplacením ukaž platný průkaz ISIC. Kód stránka neuvádí.'],
  },
  'ugo-isic-salad': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    conditions: [
      'Salát se zauzeným kuřetem a ledový čaj 0,3 l nebo Rajec 0,33 l, od 165 Kč.',
      'Rajec jen ve vybraných provozovnách.',
      'Jednou za den. Neplatí na letišti v Praze. Brněnská salaterie Campus Square v tomhle vyloučení není.',
      'Freshbar na Cimburkově tenhle salát v datech nemá, proto mu nabídka nepřísluší.',
    ],
    steps: ['Před zaplacením ukaž platný průkaz ISIC. Kód stránka neuvádí.'],
  },
  'ugo-isic-bowl': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    conditions: [
      'Poke bowl kuře za 189 Kč nebo losos za 209 Kč, k tomu ledový čaj 0,3 l nebo Rajec 0,33 l.',
      'Jednou za den.',
      'Přiřazeno jen salaterii Campus Square, ne freshbaru.',
    ],
    steps: ['Před zaplacením ukaž platný průkaz ISIC. Kód stránka neuvádí.'],
  },
  'ugo-isic-grill': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/ugo/7125',
    conditions: [
      'Malá polévka, wrap a ledový čaj 0,3 l nebo Rajec 0,33 l za 129 Kč.',
      'Rajec jen ve vybraných provozovnách. Jednou za den.',
      'Neplatí na letišti v Praze. Přiřazeno jen salaterii Campus Square.',
    ],
    steps: ['Před zaplacením ukaž platný průkaz ISIC. Kód stránka neuvádí.'],
  },
  'starbucks-isic-upsize': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/starbucks/9265',
    conditions: [
      'Nápoj ve velikosti Venti za cenu Grande.',
      'Vlastní kelímek podle stejné stránky ubere dalších 10 Kč. To není sleva 10 %.',
      'Neplatí ve Starbucks Reserve Jungmannova v Praze. Brněnská pobočka na náměstí Svobody v tomhle vyloučení není.',
      'Stránka neuvádí datum konce.',
    ],
    steps: ['Při objednávce ukaž platný průkaz ISIC a řekni, že chceš Upsize. Kód stránka neuvádí.'],
  },
  'starbucks-isic-venti-bogo': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/starbucks/9265',
    conditions: [
      'Dva nápoje Venti, levnější je zdarma.',
      'Stránka uvádí konec 17. 11. 2026. Datum začátku neuvádí.',
      'Text je na stránce slev ISIC. Samotný odstavec znovu neříká, že akce platí jen s průkazem.',
    ],
    steps: [
      'Objednej dva nápoje Venti. Levnější má být zdarma.',
      'Protože je nabídka na stránce ISIC, ukaž u pokladny platný průkaz. Kód stránka neuvádí.',
    ],
  },
  'bageterie-isic-app': {
    code: '',
    sourceUrl: 'https://www.isic.cz/slevy/cr/bageterie-boulevard/6946',
    conditions: [
      'ISIC stránka říká jen to, že studentská nabídka je v aplikaci Bageterie Boulevard v sekci kupóny.',
      'Konkrétní částku, procento ani kód web neuvádí. Nevymýšlíme je.',
      'Datum konce stránka neuvádí.',
    ],
    steps: [
      'Otevři oficiální aplikaci Bageterie Boulevard a sekci kupóny.',
      'U pokladny se prokaž podle pokynu v aplikaci. Webový kód neexistuje.',
    ],
  },
}
