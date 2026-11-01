/**
 * Validace žádosti o přidání podniku (START).
 * Společné pro průvodce i server. Neověřuje fyzickou existenci podniku.
 */

import { ALLOWED_PLACE_CATEGORIES, FOOD_CATEGORIES, getCategoryMeta } from '../constants/filters.js'
import { findBusinessPlan, normalizeWebAddress, PHOTO_TYPES } from '../constants/businessPlans.js'

export const ACTIVE_APPLICATION_PLAN = 'start'
export const APPLICATION_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'needs_changes',
])

export const EXISTENCE_STATUSES = Object.freeze([
  'unavailable',
  'likely_match',
  'ambiguous',
  'no_match',
])

export function lockedPlans() {
  return {
    start: { id: 'start', locked: false, free: true },
    plus: { id: 'plus', locked: true, free: true },
    premium: { id: 'premium', locked: true, free: true },
  }
}

export function canStartPlan(planId) {
  return planId === ACTIVE_APPLICATION_PLAN && !lockedPlans().start.locked
}

const NAME_MIN = 2
const NAME_MAX = 120
const ADDRESS_MIN = 5
const ADDRESS_MAX = 200
const DESC_MIN = 20
const PHOTO_DATA_MAX = 350_000

const NONSENSE_NAME = /^(test|asdf|qwer|xxx+|aaa+|foo|bar|lorem|ipsum)[\s\d._-]*$/i
const REPEAT_CHAR = /(.)\1{6,}/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

export function categoryChoices() {
  return FOOD_CATEGORIES.map((item) => ({
    value: item.value,
    label: item.label,
    typeLabel: item.label,
  }))
}

export function slugifyPlaceId(name, address = '') {
  const base = `${String(name ?? '')} ${String(address ?? '')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return base || 'podnik'
}

export function uniquePlaceId(name, address, takenIds) {
  const taken = takenIds instanceof Set ? takenIds : new Set(takenIds ?? [])
  let base = slugifyPlaceId(name, address)
  if (!/^[a-z0-9]/.test(base)) base = `p-${base}`
  let candidate = base.slice(0, 80)
  let n = 2
  while (taken.has(candidate)) {
    const suffix = `-${n}`
    candidate = `${base.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`
    n += 1
  }
  return candidate
}

export function normalizeKey(name, address) {
  return `${String(name ?? '')}|${String(address ?? '')}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Úprava popisu jen z dodaných údajů — nic si nevymýšlí. */
export function polishDescription(raw, context = {}) {
  let text = String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

  if (!text) return ''

  text = text.replace(/\s+([,.!?])/g, '$1')
  if (/^[a-zá-ž]/u.test(text)) {
    text = text.charAt(0).toUpperCase() + text.slice(1)
  }
  if (!/[.!?…]$/.test(text)) text = `${text}.`

  const max = findBusinessPlan(ACTIVE_APPLICATION_PLAN)?.descriptionMax ?? 400
  if (text.length > max) text = `${text.slice(0, max - 1).trimEnd()}…`

  const name = String(context.businessName ?? '').trim()
  if (name && !text.toLowerCase().includes(name.toLowerCase().slice(0, Math.min(12, name.length)))) {
    /* neodvozujeme nové věty o podniku */
  }
  return text
}

export function suggestDescriptionDraft(answers) {
  const name = String(answers.businessName ?? '').trim()
  const category = getCategoryMeta(answers.category)
  const address = String(answers.address ?? '').trim()
  const parts = []
  if (name) parts.push(name)
  if (category) parts.push(`nabízí ${category.label.toLowerCase()}`)
  if (address) parts.push(`na adrese ${address}`)
  const draft = parts.length
    ? `${parts[0]}${parts.length > 1 ? ` ${parts.slice(1).join(' ')}` : ''}.`
    : ''
  return polishDescription(draft, answers).slice(0, findBusinessPlan(ACTIVE_APPLICATION_PLAN)?.descriptionMax ?? 400)
}

function photoDataProblem(photo) {
  if (!photo) return ''
  const mime = String(photo.mime ?? '').trim()
  const data = String(photo.dataUrl ?? photo.data ?? '')
  if (!PHOTO_TYPES.includes(mime)) return 'Fotografie musí být JPG, PNG nebo WebP.'
  if (!data.startsWith('data:image/')) return 'Fotografie nemá platný formát.'
  if (data.length > PHOTO_DATA_MAX) return 'Fotografie je moc velká. Zkus menší soubor (do cca 250 kB).'
  if (!/^data:image\/(jpeg|png|webp);base64,/i.test(data)) {
    return 'Fotografie musí být odeslaná jako bezpečný data URL.'
  }
  return ''
}

export function assessBusinessApplication(input, options = {}) {
  const errors = {}
  const plan = findBusinessPlan(ACTIVE_APPLICATION_PLAN)
  const businessName = String(input.businessName ?? '').trim()
  const address = String(input.address ?? '').trim()
  const locality = String(input.locality ?? 'Brno').trim() || 'Brno'
  const category = String(input.category ?? '').trim()
  const cuisineFocus = String(input.cuisineFocus ?? input.typeFocus ?? '').trim()
  const descriptionOriginal = String(input.descriptionOriginal ?? input.description ?? '').trim()
  const skipPolish = Boolean(input.keepDescriptionExact)
  const description = skipPolish
    ? descriptionOriginal.slice(0, plan?.descriptionMax ?? 400)
    : polishDescription(input.description ?? '', { businessName })
  const ownerEmail = String(input.ownerEmail ?? input.email ?? '').trim().toLowerCase()
  const websiteRaw = String(input.website ?? '').trim()
  const website = normalizeWebAddress(websiteRaw)
  const planId = String(input.planId ?? ACTIVE_APPLICATION_PLAN).trim()
  const photo = input.photo ?? null
  const existenceStatus = EXISTENCE_STATUSES.includes(input.existenceStatus)
    ? input.existenceStatus
    : 'unavailable'
  const existenceSummary = String(input.existenceSummary ?? '').trim().slice(0, 600)
  const existenceRequiresManual = input.existenceRequiresManual !== false
  const descriptionReviewEngine = String(input.descriptionReviewEngine ?? '').trim().slice(0, 40)
  const descriptionReviewNotes = String(input.descriptionReviewNotes ?? '').trim().slice(0, 1000)
  let existenceCandidates = []
  try {
    const rawCandidates = input.existenceCandidates
    existenceCandidates = Array.isArray(rawCandidates)
      ? rawCandidates.slice(0, 5)
      : typeof rawCandidates === 'string' && rawCandidates
        ? JSON.parse(rawCandidates).slice(0, 5)
        : []
  } catch {
    existenceCandidates = []
  }

  if (planId !== ACTIVE_APPLICATION_PLAN) {
    errors.planId = 'Teď je aktivní jen tarif START. Plus a Premium zatím nejde objednat.'
  }
  if (!plan) errors.planId = 'Neznámý tarif.'

  if (businessName.length < NAME_MIN || businessName.length > NAME_MAX) {
    errors.businessName = `Název podniku zadej v délce ${NAME_MIN}–${NAME_MAX} znaků.`
  } else if (NONSENSE_NAME.test(businessName) || REPEAT_CHAR.test(businessName)) {
    errors.businessName = 'Název vypadá jako zkušební nebo nesmyslný. Zadej skutečný název podniku.'
  }

  if (address.length < ADDRESS_MIN || address.length > ADDRESS_MAX) {
    errors.address = `Adresu nebo pobočku zadej v délce ${ADDRESS_MIN}–${ADDRESS_MAX} znaků.`
  } else if (NONSENSE_NAME.test(address) || REPEAT_CHAR.test(address)) {
    errors.address = 'Adresa vypadá neúplně nebo nesmyslně.'
  }

  if (locality.length < 2 || locality.length > 80) {
    errors.locality = 'Město nebo lokalitu zadej v délce 2–80 znaků.'
  }

  if (!ALLOWED_PLACE_CATEGORIES.includes(category) || category === 'neuvedeno') {
    errors.category = 'Vyber kategorii podniku ze seznamu.'
  }

  if (!cuisineFocus || cuisineFocus.length < 2 || cuisineFocus.length > 80) {
    errors.cuisineFocus = 'Doplň typ kuchyně nebo zaměření (2–80 znaků).'
  }

  if (description.length < DESC_MIN) {
    errors.description = `Popis musí mít aspoň ${DESC_MIN} znaků.`
  } else if (description.length > (plan?.descriptionMax ?? 400)) {
    errors.description = `Popis může mít nejvýš ${plan.descriptionMax} znaků.`
  } else if (REPEAT_CHAR.test(description)) {
    errors.description = 'Popis vypadá jako nesmyslný text.'
  }

  if (!EMAIL_RE.test(ownerEmail) || ownerEmail.length > 160) {
    errors.ownerEmail = 'Zadej platný e-mail, například majitel@podnik.cz.'
  }

  if (websiteRaw && !website.ok) {
    errors.website = 'Webová adresa není platná. Použij tvar https://example.cz, nebo pole nech prázdné.'
  }

  const photoError = photoDataProblem(photo)
  if (photoError) errors.photo = photoError
  if (photo && (plan?.photoMax ?? 1) < 1) errors.photo = 'U tohoto tarifu fotografie nejde přiložit.'

  const takenIds = options.takenIds ?? new Set()
  const existingKeys = options.existingKeys ?? new Set()
  const key = normalizeKey(businessName, address)
  if (existingKeys.has(key)) {
    errors.duplicate = 'Podobný podnik nebo pobočka už v CheapEats je, nebo čeká na kontrolu.'
  }

  const categoryMeta = getCategoryMeta(category)
  const proposedPlaceId =
    String(input.proposedPlaceId ?? '').trim() ||
    uniquePlaceId(businessName, address, takenIds)

  if (Object.keys(errors).length) {
    return {
      ok: false,
      errors,
      message: errors.duplicate || errors.planId || Object.values(errors)[0],
      value: null,
    }
  }

  const typeLabel = cuisineFocus || categoryMeta?.label || category

  return {
    ok: true,
    errors: {},
    message: '',
    value: {
      planId: ACTIVE_APPLICATION_PLAN,
      businessName,
      address,
      locality,
      category,
      categoryLabel: categoryMeta?.label ?? category,
      cuisineFocus,
      typeLabel,
      description,
      descriptionOriginal: descriptionOriginal || description,
      descriptionReviewEngine,
      descriptionReviewNotes,
      ownerEmail,
      website: website.href || '',
      proposedPlaceId,
      photo: photo
        ? {
            mime: String(photo.mime).trim(),
            dataUrl: String(photo.dataUrl ?? photo.data),
          }
        : null,
      existenceStatus,
      existenceSummary:
        existenceSummary ||
        'Automatická kontrola formátu proběhla. Fyzickou existenci podniku tento krok nepotvrdil.',
      existenceRequiresManual,
      existenceCandidates,
      verificationNote:
        'Automatická kontrola ověřila formát údajů. Absolutní existenci podniku nepotvrdila. Zveřejnění schvaluje administrátor.',
    },
  }
}

export function publicApplicationView(row) {
  if (!row) return null
  let existenceCandidates = []
  try {
    const raw = row.existence_candidates
    existenceCandidates = Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : []
  } catch {
    existenceCandidates = []
  }
  return {
    id: row.id,
    status: row.status,
    planId: row.plan_id,
    businessName: row.business_name,
    address: row.address,
    locality: row.locality,
    category: row.category,
    categoryLabel: row.category_label,
    cuisineFocus: row.cuisine_focus || '',
    description: row.description,
    descriptionOriginal: row.description_original || row.description || '',
    descriptionReviewEngine: row.description_review_engine || '',
    descriptionReviewNotes: row.description_review_notes || '',
    website: row.website || '',
    proposedPlaceId: row.proposed_place_id,
    publishedPlaceId: row.published_place_id || null,
    adminNote: row.admin_note || '',
    emailStatus: row.email_status,
    emailError: row.email_error || '',
    emailSentAt: row.email_sent_at || null,
    existenceStatus: row.existence_status || 'unavailable',
    existenceSummary: row.existence_summary || '',
    existenceRequiresManual: row.existence_requires_manual !== false,
    existenceCandidates,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at || null,
    hasPhoto: Boolean(row.photo_data),
    photoDataUrl: row.photo_data || null,
    ownerEmail: row.owner_email,
  }
}

export function publishedPlaceFromApplication(application, placeId) {
  const id = placeId || application.proposedPlaceId
  const address =
    application.locality && !String(application.address).includes(application.locality)
      ? `${application.address}, ${application.locality}`
      : application.address
  return {
    id,
    name: application.businessName,
    description: application.description,
    type: application.cuisineFocus || application.typeLabel || application.categoryLabel,
    category: application.category,
    address,
    website: application.website || undefined,
    imageDataUrl: application.photo?.dataUrl || null,
    source: 'owner_application',
    isNew: true,
    curated: false,
    ownerSubmitted: true,
  }
}

export function toCatalogRestaurant(row) {
  const category = row.category || 'neuvedeno'
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type || row.category,
    category,
    cuisineType: category,
    address: row.address,
    website: row.website || undefined,
    imageUrl: row.image_data_url || row.imageDataUrl || undefined,
    imageAlt: row.image_data_url || row.imageDataUrl ? `Fotografie podniku ${row.name}` : undefined,
    officialPhotoUrl: row.image_data_url || row.imageDataUrl || undefined,
    isDemo: false,
    isNew: row.is_new !== false,
    ownerSubmitted: true,
    source: row.source || 'owner_application',
    vegetarianFriendly: false,
    veganFriendly: false,
    locationVerified: false,
  }
}
