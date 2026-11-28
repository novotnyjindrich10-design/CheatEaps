/**
 * Nezávazná poptávka placené propagace.
 * Cenu bere z quoteTrustedPrice. Částku z požadavku nečte.
 * Samo o sobě poptávku neukládá, platbu nespouští a reklamu nezapne.
 */
import { findBusinessPlan, formatKc, normalizeWebAddress } from '../constants/businessPlans.js'
import { presentPrice } from '../constants/operator.js'
import { quoteTrustedPrice } from '../constants/promotionPrice.js'
import { inquiryOperatorEmail, inquiryRestaurantEmail } from './emailTemplates.js'

const LIMITS = {
  businessName: 100,
  companyName: 160,
  contactName: 100,
  email: 200,
  phone: 40,
  billingAddress: 200,
  ico: 16,
  dic: 20,
  placeId: 80,
  website: 300,
  socials: 1000,
  extra: 2000,
  photoName: 120,
}

export function icoChecksumOk(value) {
  const digits = String(value ?? '').replace(/\s/g, '')
  if (!/^\d{8}$/.test(digits)) return false
  const weights = [8, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 7; i += 1) sum += Number(digits[i]) * weights[i]
  const mod = sum % 11
  const check = mod === 0 ? 1 : mod === 1 ? 0 : 11 - mod
  return check === Number(digits[7])
}

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_EMAIL = 3
const MAX_PER_IP = 10
const MIN_FILL_MS = 2000
const MAX_AGE_MS = 12 * 60 * 60 * 1000
const recentByKey = new Map()

export function resetPromotionRequestLimits() {
  recentByKey.clear()
}

function fail(status, error, message, field) {
  return {
    ok: false,
    status,
    body: {
      ok: false,
      accepted: false,
      paid: false,
      activated: false,
      error,
      message,
      ...(field ? { field } : {}),
    },
  }
}

function readText(payload, key, max, required, label) {
  const has = Object.hasOwn(payload, key) && payload[key] != null && payload[key] !== ''
  if (!has) {
    if (!required) return { ok: true, value: '' }
    return { ok: false, field: key, message: `Doplň ${label}.` }
  }
  if (typeof payload[key] !== 'string') {
    return { ok: false, field: key, message: `${label} nemá platný text.` }
  }
  if (payload[key].length > max) {
    return { ok: false, field: key, message: `${label} je moc dlouhé.` }
  }
  const value = payload[key].replace(/\r/g, '').trim()
  if (required && !value) return { ok: false, field: key, message: `Doplň ${label}.` }
  return { ok: true, value }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value)
}

function oneLine(value) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function remember(key, now) {
  const prev = (recentByKey.get(key) ?? []).filter((time) => now - time < WINDOW_MS)
  if (prev.length >= (key.startsWith('ip:') ? MAX_PER_IP : MAX_PER_EMAIL)) {
    recentByKey.set(key, prev)
    return false
  }
  prev.push(now)
  recentByKey.set(key, prev)
  return true
}

function release(key) {
  const prev = recentByKey.get(key)
  if (!prev?.length) return
  prev.pop()
  recentByKey.set(key, prev)
}

function clientIp(headers) {
  const raw = headers?.get?.('x-forwarded-for') ?? ''
  const first = raw.split(',')[0]?.trim() ?? ''
  if (!first || first.length > 80) return ''
  return first
}

function linkCount(value) {
  return (value.match(/https?:\/\//gi) ?? []).length
}

export function assessPromotionRequest(payload, now = Date.now()) {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail(400, 'invalid-json', 'Žádost musí být JSON objekt.')
  }
  if (Object.hasOwn(payload, 'photos')) {
    return fail(400, 'invalid-field', 'Fotografie se tímto formulářem neodesílají. V e-mailu mohou být jen názvy souborů.')
  }
  const honeypot = payload.ceLeaveBlank
  if (honeypot != null && String(honeypot).trim() !== '') {
    return fail(400, 'rejected', 'Žádost se nepodařilo odeslat. Zkus to znovu.')
  }

  const openedAt = Number(payload.openedAt)
  if (!Number.isFinite(openedAt)) {
    return fail(400, 'rejected', 'Žádost se nepodařilo odeslat. Obnov stránku a zkus to znovu.')
  }
  if (now - openedAt < MIN_FILL_MS) {
    return fail(400, 'too-soon', 'Počkej chvíli a odešli žádost znovu.')
  }
  if (openedAt > now + 60_000 || now - openedAt > MAX_AGE_MS) {
    return fail(400, 'stale-form', 'Formulář je otevřený moc dlouho. Obnov stránku a odešli žádost znovu.')
  }

  const businessName = readText(payload, 'businessName', LIMITS.businessName, true, 'Název podniku')
  if (!businessName.ok) return fail(400, 'invalid-field', businessName.message, businessName.field)
  const contactName = readText(payload, 'contactName', LIMITS.contactName, true, 'Jméno kontaktní osoby')
  if (!contactName.ok) return fail(400, 'invalid-field', contactName.message, contactName.field)
  const email = readText(payload, 'email', LIMITS.email, true, 'E-mail')
  if (!email.ok) return fail(400, 'invalid-field', email.message, email.field)
  if (!isEmail(email.value)) {
    return fail(400, 'invalid-field', 'Zadej platný e-mail, například jmeno@podnik.cz.', 'email')
  }
  const companyName = readText(payload, 'companyName', LIMITS.companyName, true, 'Název firmy')
  if (!companyName.ok) return fail(400, 'invalid-field', companyName.message, companyName.field)
  const phone = readText(payload, 'phone', LIMITS.phone, true, 'Telefon')
  if (!phone.ok) return fail(400, 'invalid-field', phone.message, phone.field)
  const phoneDigits = phone.value.replace(/\D/g, '')
  if (phoneDigits.length < 9 || phoneDigits.length > 15) {
    return fail(400, 'invalid-field', 'Zadej telefon, na kterém tě zastihneme.', 'phone')
  }
  const billingAddress = readText(payload, 'billingAddress', LIMITS.billingAddress, true, 'Fakturační adresa')
  if (!billingAddress.ok) return fail(400, 'invalid-field', billingAddress.message, billingAddress.field)
  const ico = readText(payload, 'ico', LIMITS.ico, false, 'IČO')
  if (!ico.ok) return fail(400, 'invalid-field', ico.message, ico.field)
  const icoDigits = ico.value.replace(/\s/g, '')
  if (icoDigits && !icoChecksumOk(icoDigits)) {
    return fail(400, 'invalid-field', 'IČO nemá platný tvar.', 'ico')
  }
  const dic = readText(payload, 'dic', LIMITS.dic, false, 'DIČ')
  if (!dic.ok) return fail(400, 'invalid-field', dic.message, dic.field)
  if (dic.value && !/^CZ\d{8,10}$/i.test(dic.value.replace(/\s/g, ''))) {
    return fail(400, 'invalid-field', 'DIČ zadej ve tvaru CZ a čísel.', 'dic')
  }
  const placeId = readText(payload, 'placeId', LIMITS.placeId, false, 'Podnik v katalogu')
  if (!placeId.ok) return fail(400, 'invalid-field', placeId.message, placeId.field)
  if (placeId.value && !/^[a-z0-9][a-z0-9-]{0,79}$/.test(placeId.value)) {
    return fail(400, 'invalid-field', 'Vybraný podnik nemá platný identifikátor.', 'placeId')
  }
  if (payload.termsAck !== true) {
    return fail(
      400,
      'invalid-field',
      'Potvrď, že jde o nezávaznou poptávku a že obchodní podmínky jsou text k právní kontrole.',
      'termsAck',
    )
  }

  const plan = findBusinessPlan(payload.planId)
  const quotedMonthly = quoteTrustedPrice(payload.planId, 'mesicne')
  if (!plan || !quotedMonthly.ok) {
    return fail(400, 'unknown-plan', 'Vyber balíček Start, Plus nebo Premium.', 'planId')
  }
  if (payload.periodId !== 'mesicne' && payload.periodId !== 'rocne') {
    return fail(400, 'unknown-period', 'Ceník má jen měsíční nebo roční zobrazení.', 'periodId')
  }
  const quotedShown = quoteTrustedPrice(payload.planId, payload.periodId)

  const website = readText(payload, 'website', LIMITS.website, false, 'Web')
  if (!website.ok) return fail(400, 'invalid-field', website.message, website.field)
  const websiteCheck = normalizeWebAddress(website.value)
  if (!websiteCheck.ok) {
    return fail(400, 'invalid-field', 'Webová adresa není platná. Použij tvar https://example.cz.', 'website')
  }

  const description = readText(payload, 'description', plan.descriptionMax, false, 'Popis')
  if (!description.ok) return fail(400, 'invalid-field', description.message, description.field)
  const socials = readText(payload, 'socials', LIMITS.socials, false, 'Odkazy na sociální sítě')
  if (!socials.ok) return fail(400, 'invalid-field', socials.message, socials.field)
  const extra = readText(payload, 'extra', LIMITS.extra, false, 'Další informace')
  if (!extra.ok) return fail(400, 'invalid-field', extra.message, extra.field)

  const socialLines = socials.value.split('\n').map((line) => line.trim()).filter(Boolean)
  if (socialLines.length > 10) {
    return fail(400, 'invalid-field', 'Sociálních odkazů je moc. Stačí jich nejvýš deset.', 'socials')
  }
  const badSocial = socialLines.find((line) => !normalizeWebAddress(line).ok)
  if (badSocial) {
    return fail(400, 'invalid-field', 'Některý odkaz na sociální síť není platná webová adresa.', 'socials')
  }

  let photoNames = []
  if (Object.hasOwn(payload, 'photoNames') && payload.photoNames != null) {
    if (!Array.isArray(payload.photoNames)) {
      return fail(400, 'invalid-field', 'Názvy fotografií nemají platný tvar.', 'photos')
    }
    if (payload.photoNames.length > plan.photoMax) {
      return fail(
        400,
        'invalid-field',
        `U balíčku ${plan.name} lze uvést nejvýš ${plan.photoMax} ${plan.photoMax === 1 ? 'fotografii' : 'fotografií'}.`,
        'photos',
      )
    }
    for (const name of payload.photoNames) {
      if (typeof name !== 'string' || !name.trim() || name.length > LIMITS.photoName || /[\r\n]/.test(name)) {
        return fail(400, 'invalid-field', 'Název fotografie není platný.', 'photos')
      }
      photoNames.push(oneLine(name))
    }
  }

  const blob = [businessName.value, description.value, socials.value, extra.value, website.value].join('\n')
  if (linkCount(blob) > 8) {
    return fail(400, 'rejected', 'Žádost se nepodařilo odeslat. Zkus to znovu.')
  }

  if (!quotedShown.ok) {
    return fail(400, 'unknown-period', 'Ceník má jen měsíční nebo roční zobrazení.', 'periodId')
  }

  const shown = quotedShown.ok
    ? `${quotedShown.periodId === 'rocne' ? 'Roční zobrazení ceníku' : 'Měsíční zobrazení ceníku'}: ${formatKc(quotedShown.amount)} ${quotedShown.periodId === 'rocne' ? 'za rok' : 'za měsíc'}`
    : 'Ceník se nepodařilo dopočítat.'
  const price = presentPrice(quotedShown.amount)
  const serviceLabel = quotedShown.serviceLabel

  const text = [
    'Nezávazná poptávka placené propagace',
    'FoodGo Brno',
    '',
    `Podnik: ${businessName.value}`,
    `Podnik v katalogu: ${placeId.value || 'neuveden'}`,
    `Firma: ${companyName.value}`,
    `IČO: ${icoDigits || 'neuvedeno'}`,
    `DIČ: ${dic.value || 'neuvedeno'}`,
    `Kontakt: ${contactName.value}`,
    `E-mail: ${email.value}`,
    `Telefon: ${phone.value}`,
    `Fakturační adresa: ${billingAddress.value}`,
    `Web: ${websiteCheck.href || 'neuveden'}`,
    `Balíček: ${plan.name} (${plan.id})`,
    `Délka: ${serviceLabel}`,
    'Platba: jednorázová. Samo se neobnovuje.',
    `Měsíční sazba ceníku: ${formatKc(quotedMonthly.amount)} měsíčně`,
    `Ceníková částka: ${formatKc(quotedShown.amount)}`,
    price.vatNote,
    shown,
    'Tato poptávka není objednávka a úhrada z ní neplyne.',
    '',
    `Popis: ${description.value || 'neuveden'}`,
    `Sociální sítě: ${socialLines.join(', ') || 'neuvedeny'}`,
    `Další informace: ${extra.value || 'neuvedeny'}`,
    photoNames.length
      ? `Fotografie (jen názvy, soubory se nenahrály): ${photoNames.join(', ')}`
      : 'Fotografie: žádné',
    '',
    'Stav: nezávazná poptávka. Platba neproběhla. Propagace není aktivní. Předplatné se nespustilo.',
    'Obchodní podmínky a ochrana osobních údajů ještě nejsou právně schválené. Tahle zpráva není smlouva ani výzva k platbě.',
  ].join('\n')

  return {
    ok: true,
    subject: oneLine(`Poptávka propagace: ${businessName.value} (${plan.name})`).slice(0, 160),
    text,
    replyTo: email.value,
    emailKey: email.value.toLowerCase(),
    record: {
      businessName: businessName.value,
      companyName: companyName.value,
      contactName: contactName.value,
      email: email.value,
      phone: phone.value,
      billingAddress: billingAddress.value,
      ico: icoDigits,
      dic: dic.value.replace(/\s/g, '').toUpperCase(),
      placeId: placeId.value,
      website: websiteCheck.href,
      description: description.value,
      extra: extra.value,
      planId: plan.id,
      planName: plan.name,
      periodId: quotedShown.periodId,
      amount: quotedShown.amount,
      currency: 'CZK',
      serviceDays: quotedShown.serviceDays,
      serviceLabel,
      renewal: 'none',
      vatStatus: price.vatStatus,
      vatNote: price.vatNote,
      termsAck: true,
    },
  }
}

export function buildRestaurantConfirmation(assessment) {
  const record = assessment.record
  const letter = inquiryRestaurantEmail({
    reference: assessment.reference || '',
    businessName: record.businessName,
    planName: record.planName,
    serviceLabel: record.serviceLabel,
    amountLabel: formatKc(record.amount),
    vatNote: record.vatNote,
  })
  return {
    to: assessment.replyTo,
    subject: 'Poptávka propagace na FoodGo je přijatá',
    text: letter.text,
    html: letter.html,
  }
}

async function postOne(mail, letter, fetchImpl) {
  try {
    const headers = {
      Authorization: `Bearer ${mail.apiKey}`,
      'Content-Type': 'application/json',
    }
    if (letter.idempotencyKey) headers['Idempotency-Key'] = String(letter.idempotencyKey).slice(0, 256)
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: mail.from,
        to: [letter.to],
        ...(letter.replyTo ? { reply_to: letter.replyTo } : {}),
        subject: letter.subject,
        text: letter.text,
        ...(letter.html ? { html: letter.html } : {}),
      }),
    })
    if (!response.ok) return { ok: false, error: 'email-failed', providerAccepted: false, delivered: false }
    const body = typeof response.json === 'function' ? await response.json().catch(() => ({})) : {}
    return { ok: true, providerAccepted: true, delivered: false, providerId: body?.id || '' }
  } catch {
    return { ok: false, error: 'email-failed', providerAccepted: false, delivered: false }
  }
}

export async function sendPromotionInquiryMail(assessment, env, fetchImpl) {
  const mail = configured(env)
  if (!mail) {
    return { ok: false, operator: false, restaurant: false, error: 'email-not-configured' }
  }
  const operatorText = assessment.reference
    ? `${assessment.text}\n\nČíslo evidence: ${assessment.reference}`
    : assessment.text
  const operatorHtml = inquiryOperatorEmail({
    subjectLines: operatorText.split('\n'),
  }).html
  const reference = assessment.reference || ''
  const operatorSent = await postOne(mail, {
    to: mail.to,
    replyTo: assessment.replyTo,
    subject: assessment.subject,
    text: operatorText,
    html: operatorHtml,
    idempotencyKey: reference ? `foodgo-promo-op-${reference}` : '',
  }, fetchImpl)
  if (!operatorSent.ok) {
    return { ok: false, operator: false, restaurant: false, error: operatorSent.error }
  }
  const confirmation = buildRestaurantConfirmation(assessment)
  const restaurantSent = await postOne(mail, {
    ...confirmation,
    replyTo: mail.to,
    idempotencyKey: reference ? `foodgo-promo-rest-${reference}` : '',
  }, fetchImpl)
  return {
    ok: true,
    operator: true,
    restaurant: restaurantSent.ok,
    providerAccepted: true,
    delivered: false,
    error: restaurantSent.ok ? '' : 'restaurant-email-failed',
  }
}

function configured(env) {
  const apiKey = String(env.RESEND_API_KEY ?? '').trim()
  const to = String(env.INQUIRY_TO_EMAIL ?? '').trim()
  const from = String(env.EMAIL_FROM ?? '').trim()
  if (!apiKey || !to || !from || /[\r\n]/.test(to) || /[\r\n]/.test(from) || !to.includes('@') || !from.includes('@')) {
    return null
  }
  return { apiKey, to, from }
}

export async function postResend(assessment, env, fetchImpl) {
  const mail = configured(env)
  if (!mail) return { ok: false, status: 503, error: 'email-not-configured' }
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mail.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        reply_to: assessment.replyTo,
        subject: assessment.subject,
        text: assessment.text,
      }),
    })
    if (!response.ok) return { ok: false, status: 502, error: 'email-failed' }
    return { ok: true }
  } catch {
    return { ok: false, status: 502, error: 'email-failed' }
  }
}

export async function deliverPromotionRequest(assessment, env, fetchImpl, now, ip) {
  const mail = configured(env)
  if (!mail) {
    return fail(
      503,
      'email-not-configured',
      'Odeslání e-mailu ještě není nastavené. Žádost neodešla, zkus to později.',
    )
  }

  const emailKey = `email:${assessment.emailKey}`
  const ipKey = ip ? `ip:${ip}` : ''
  if (!remember(emailKey, now)) {
    return fail(429, 'rate-limited', 'Z tohoto kontaktu už přišlo víc žádostí. Zkus to později.')
  }
  if (ipKey && !remember(ipKey, now)) {
    release(emailKey)
    return fail(429, 'rate-limited', 'Z tohoto kontaktu už přišlo víc žádostí. Zkus to později.')
  }

  const posted = await postResend(assessment, env, fetchImpl)
  if (!posted.ok) {
    release(emailKey)
    if (ipKey) release(ipKey)
    return fail(posted.status, posted.error, 'E-mail se nepodařilo odeslat. Žádost neodešla, můžeš to zkusit znovu.')
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      accepted: true,
      paid: false,
      activated: false,
      message: 'Poptávka propagace je přijatá e-mailem. Nic se nezaplatilo a propagace se sama nezapnula.',
    },
  }
}

export async function promotionRequestHttp(request, options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? fetch
  const now = options.now ?? Date.now()

  try {
    if (request.method !== 'POST') {
      return jsonResponse(
        fail(405, 'method-not-allowed', 'Povolená je jen metoda POST.').body,
        405,
        { Allow: 'POST' },
      )
    }
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
      return jsonResponse(fail(400, 'invalid-json', 'Žádost musí být JSON.').body, 400)
    }
    let payload
    try {
      payload = await request.json()
    } catch {
      return jsonResponse(fail(400, 'invalid-json', 'Žádost musí být platný JSON.').body, 400)
    }

    const assessment = assessPromotionRequest(payload, now)
    if (!assessment.ok) return jsonResponse(assessment.body, assessment.status)

    const delivered = await deliverPromotionRequest(
      assessment,
      env,
      fetchImpl,
      now,
      clientIp(request.headers),
    )
    return jsonResponse(delivered.body, delivered.status)
  } catch {
    return jsonResponse(
      fail(500, 'internal-error', 'Žádost se nepodařilo zpracovat.').body,
      500,
    )
  }
}

function jsonResponse(body, status, headers) {
  return { status, headers, body }
}
