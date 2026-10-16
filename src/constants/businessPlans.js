/**
 * Ceník propagace a kontrola formuláře.
 * Částku počítá quoteTrustedPrice v promotionPrice.js.
 * Komponenty ceny neodvozují samy.
 */

import { PROMOTION_MONTHLY_PRICES, quoteTrustedPrice } from './promotionPrice.js'

export { YEARLY_MONTHS_BILLED, yearlyPrice, yearlySavings } from './promotionPrice.js'

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const SETUP_TIME = {
  title: 'Očekávaná doba nastavení',
  text: 'Propagaci obvykle nastavíme do 1–3 dnů. Maximální doba nastavení je 7 dní od potvrzení žádosti a dodání všech potřebných podkladů.',
  note: 'Jde o očekávanou dobu nastavení. Lhůta se nespouští automaticky a začíná až po potvrzení žádosti a dodání všech potřebných podkladů.',
}

/** Co ještě není hotové, než se žádosti mají přijímat veřejně a než se má platit. */
export const ORDER_GAPS = [
  'Obchodní podmínky v projektu nejsou. Před veřejným spuštěním je potřeba je sepsat a na stránku odkázat.',
  'Informace o zpracování osobních údajů v projektu nejsou. Před veřejným spuštěním je potřeba popsat, jaké údaje odcházejí e-mailem a kdo k nim má přístup.',
  'Žádost o zkušební měsíc je jen nezávazná prosba o kontakt. Neukládá se jako objednávka a fotografie se nenahrávají.',
  'Platební brána není zapojená. Z této stránky se nic nestrhává a předplatné se samo nespustí.',
]

export const BUSINESS_PLANS = [
  {
    id: 'start',
    name: 'Start',
    monthlyPrice: PROMOTION_MONTHLY_PRICES.start,
    descriptionMax: 400,
    photoMax: 1,
    summary: 'Základní propagace podniku pro lidi, kteří na CheapEats hledají, kam zajít.',
    recommended: false,
    perks: [
      {
        title: 'Základní propagace podniku',
        detail:
          'Domluvíme, jak se podnik na CheapEats představí. Vyplnění formuláře samo od sebe nic nezapne.',
      },
      {
        title: 'Zvýrazněné označení podniku na CheapEats',
        detail:
          'Označení v seznamu připravíme jako součást propagace. V aplikaci teď takové reklamní označení samo neběží.',
      },
      {
        title: 'Odkaz na vlastní web, pokud je k dispozici',
        detail:
          'Na detailu podniku už umíme ukázat ověřený web. Doplníme ho, když nám ho pošleš.',
      },
      {
        title: 'Jednoduché představení podniku',
        detail: 'Krátký text na stránce podniku. Znění schválíme společně, než ho zveřejníme.',
      },
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: PROMOTION_MONTHLY_PRICES.plus,
    descriptionMax: 800,
    photoMax: 2,
    summary: 'Výraznější prezentace včetně fotografie, kterou si předem domluvíme.',
    recommended: true,
    perks: [
      {
        title: 'Vše z balíčku Start',
        detail: 'Platí rozsah Startu a k němu body níže.',
      },
      {
        title: 'Výraznější reklamní označení',
        detail:
          'Silnější odlišení v seznamu. Zapneme ho až po domluvě. Teď v aplikaci samo neběží.',
      },
      {
        title: 'Možnost prezentovat vlastní fotografii podniku',
        detail:
          'Fotografii můžeš přiložit k objednávce. Na server se z formuláře zatím nenahrává a v seznamu podniků se sama nezobrazí.',
      },
      {
        title: 'Rozšířená prezentace podniku',
        detail: 'Delší text a víc údajů na stránce podniku. Rozsah doladíme spolu.',
      },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: PROMOTION_MONTHLY_PRICES.premium,
    descriptionMax: 1600,
    photoMax: 6,
    summary: 'Největší prostor v rámci propagace. Přednostní místo jen tam, kde ho opravdu postavíme.',
    recommended: false,
    perks: [
      {
        title: 'Vše z balíčku Plus',
        detail: 'Platí rozsah Plusu a k němu body níže.',
      },
      {
        title: 'Nejvýraznější reklamní prezentace',
        detail:
          'Největší odlišení, které v rámci propagace připravíme. Není to funkce zapnutá pro všechny podniky.',
      },
      {
        title: 'Více prostoru pro fotografie a informace o podniku',
        detail:
          'K objednávce lze přiložit víc fotografií a delší popis než u nižších balíčků. Zobrazení na webu doladíme až při přípravě propagace.',
      },
      {
        title: 'Prioritní reklamní umístění ve vybraných částech webu, pokud bude skutečně implementováno',
        detail:
          'Přednostní místo na úvodu nebo ve výsledcích přidáme až ve chvíli, kdy bude v aplikaci postavené. Teď ho jako hotové nenabízíme.',
      },
    ],
  },
]

const FIELD_ORDER = [
  'businessName',
  'contactName',
  'email',
  'planId',
  'periodId',
  'website',
  'description',
  'socials',
  'photos',
]

export function findBusinessPlan(id) {
  return BUSINESS_PLANS.find((plan) => plan.id === id) ?? null
}

/** Chybějící nebo neznámá hodnota je měsíční platba. Roční se zapne jen hodnotou `rocne`. */
export function resolvePeriod(value) {
  return value === 'rocne' ? 'rocne' : 'mesicne'
}

export function formatKc(amount) {
  const formatted = new Intl.NumberFormat('cs-CZ')
    .format(amount)
    .replace(/[\u00a0\u202f]/g, ' ')
  return `${formatted} Kč`
}

/** Cena pro formulář. Chybějící období je měsíční. Částku bere z quoteTrustedPrice, ne z monthlyPrice na objektu. */
export function quotePlan(plan, periodValue) {
  const period = resolvePeriod(periodValue)
  const quoted = quoteTrustedPrice(plan?.id, period)
  if (!quoted.ok) {
    throw new Error('Neznámý balíček propagace.')
  }
  const yearlyBilling = quoted.periodId === 'rocne'
  return {
    period: quoted.periodId,
    periodName: yearlyBilling ? 'Roční platba' : 'Měsíční platba',
    amount: quoted.amount,
    amountLabel: yearlyBilling ? 'za rok' : 'za měsíc',
    monthly: quoted.monthly,
    yearly: quoted.yearly,
    savings: quoted.savings,
  }
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1).replace('.', ',')} MB`
}

export function normalizeWebAddress(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return { ok: true, href: '' }
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  let url
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, href: '' }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, href: '' }
  const host = url.hostname
  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return { ok: false, href: '' }
  return { ok: true, href: url.href }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function photoTypeOk(file) {
  if (file.type) return PHOTO_TYPES.includes(file.type)
  return /\.(jpe?g|png|webp)$/i.test(file.name ?? '')
}

export function photoProblem(file) {
  const name = file?.name || 'soubor'
  if (!photoTypeOk(file)) {
    return `Soubor ${name} má nepodporovaný typ. Použij JPG, PNG nebo WebP.`
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return `Soubor ${name} je prázdný.`
  if (file.size > PHOTO_MAX_BYTES) return `Soubor ${name} je větší než 5 MB.`
  return ''
}

function socialLines(raw) {
  return String(raw ?? '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function materialsOf(input, plan, website, socials) {
  const photos = input.photos ?? []
  return [
    { label: 'Web', value: website.href || 'nedodán' },
    { label: 'Popis', value: input.description.trim() ? `${input.description.trim().length} znaků` : 'nedodán' },
    {
      label: 'Sociální sítě',
      value: socials.length ? socials.join(', ') : 'nedodány',
    },
    { label: 'Další informace', value: input.extra.trim() || 'nedodány' },
    {
      label: 'Fotografie',
      value: photos.length
        ? photos.map((file) => `${file.name} (${formatFileSize(file.size)})`).join(', ')
        : `žádná (u balíčku ${plan.name} lze přiložit až ${plan.photoMax})`,
    },
  ]
}

export function reviewOrder(input) {
  const errors = {}
  const plan = findBusinessPlan(input.planId)
  const period = resolvePeriod(input.periodId)
  const website = normalizeWebAddress(input.website)
  const socials = socialLines(input.socials)
  const photos = input.photos ?? []

  if (!input.businessName.trim()) errors.businessName = 'Doplň název podniku.'
  if (!input.contactName.trim()) errors.contactName = 'Doplň jméno kontaktní osoby.'
  if (!isEmail(input.email ?? '')) errors.email = 'Zadej platný e-mail, například jmeno@podnik.cz.'
  if (!plan) errors.planId = 'Vyber balíček.'
  if (input.periodId !== 'mesicne' && input.periodId !== 'rocne') {
    errors.periodId = 'Vyber měsíční nebo roční platbu.'
  }
  if (!website.ok) errors.website = 'Webová adresa není platná. Použij tvar https://example.cz.'
  if (plan && input.description.trim().length > plan.descriptionMax) {
    errors.description = `Popis může mít nejvýš ${plan.descriptionMax} znaků.`
  }
  const badSocial = socials.find((line) => !normalizeWebAddress(line).ok)
  if (badSocial) {
    const sample = badSocial.length > 48 ? `${badSocial.slice(0, 48)}…` : badSocial
    errors.socials = `Odkaz „${sample}“ není platná webová adresa. Každý odkaz dej na vlastní řádek.`
  }
  if (plan && photos.length > plan.photoMax) {
    errors.photos = `U balíčku ${plan.name} lze přiložit nejvýš ${plan.photoMax} ${plan.photoMax === 1 ? 'fotografii' : 'fotografií'}.`
  }
  const photoError = photos.map(photoProblem).find(Boolean)
  if (photoError) errors.photos = photoError

  const firstField = FIELD_ORDER.find((key) => errors[key]) ?? ''
  if (firstField || !plan) {
    return { ok: false, errors, firstField, summary: null }
  }

  const quote = quotePlan(plan, period)
  const afterTrial = quoteTrustedPrice(plan.id, 'mesicne')
  const materials = materialsOf(input, plan, website, socials.map((line) => normalizeWebAddress(line).href))
  const priceLine = `${formatKc(quote.amount)} ${quote.amountLabel}`
  const afterPriceText = afterTrial.ok ? `${formatKc(afterTrial.amount)} měsíčně` : ''
  const savingsLine = quote.savings
    ? `Úspora oproti 12 měsíčním platbám: ${formatKc(quote.savings)}.`
    : 'Roční úspora se u měsíční platby neuplatňuje.'

  const lines = [
    'Žádost o první měsíc propagace zdarma na CheapEats Brno',
    `Podnik: ${input.businessName.trim()}`,
    `Kontakt: ${input.contactName.trim()}`,
    `E-mail: ${input.email.trim()}`,
    `Balíček: ${plan.name}`,
    'První měsíc: zdarma',
    `Cena po zkušebním měsíci: ${afterPriceText}`,
    `Na ceníku je zobrazeno: ${quote.periodName}, ${priceLine}`,
    savingsLine,
    ...materials.map((item) => `${item.label}: ${item.value}`),
    `${SETUP_TIME.title}: ${SETUP_TIME.text}`,
    SETUP_TIME.note,
    'Stav: souhrn v prohlížeči. Platba neprobíhá a propagace se neaktivuje.',
  ]

  return {
    ok: true,
    errors: {},
    firstField: '',
    summary: {
      planName: plan.name,
      periodName: quote.periodName,
      priceText: priceLine,
      afterPriceText,
      savingsText: savingsLine,
      materials,
      setupTitle: SETUP_TIME.title,
      setupText: SETUP_TIME.text,
      setupNote: SETUP_TIME.note,
      gaps: ORDER_GAPS,
      text: lines.join('\n'),
    },
  }
}

/**
 * Starší pomocná funkce. Živý formulář posílá žádost na /api/promotion-request.
 * Tahle funkce platbu nespouští a e-mail neposílá.
 */
export function submitBusinessOrder(summary) {
  return {
    sent: false,
    paid: false,
    summary,
    gaps: ORDER_GAPS,
  }
}
