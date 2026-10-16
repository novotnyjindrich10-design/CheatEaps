/**
 * Nezávazná žádost o první měsíc propagace zdarma.
 * Cenu po zkušebním měsíci bere z quoteTrustedPrice. Částku z požadavku nečte.
 * Neukládá objednávku a nespouští platbu.
 */
import { findBusinessPlan, formatKc, normalizeWebAddress } from '../constants/businessPlans.js'
import { quoteTrustedPrice } from '../constants/promotionPrice.js'

const LIMITS = {
  businessName: 100,
  contactName: 100,
  email: 200,
  website: 300,
  socials: 1000,
  extra: 2000,
  photoName: 120,
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

  const shown = quotedShown.ok
    ? `${quotedShown.periodId === 'rocne' ? 'Roční zobrazení ceníku' : 'Měsíční zobrazení ceníku'}: ${formatKc(quotedShown.amount)} ${quotedShown.periodId === 'rocne' ? 'za rok' : 'za měsíc'}`
    : 'Ceník se nepodařilo dopočítat.'

  const text = [
    'Nezávazná žádost o první měsíc propagace zdarma',
    'CheapEats Brno',
    '',
    `Podnik: ${businessName.value}`,
    `Kontakt: ${contactName.value}`,
    `E-mail: ${email.value}`,
    `Web: ${websiteCheck.href || 'neuveden'}`,
    `Balíček: ${plan.name} (${plan.id})`,
    'První měsíc: zdarma',
    `Cena po zkušebním měsíci: ${formatKc(quotedMonthly.amount)} měsíčně`,
    shown,
    'Částka na ceníku není objednávka a není souhlas s platbou.',
    '',
    `Popis: ${description.value || 'neuveden'}`,
    `Sociální sítě: ${socialLines.join(', ') || 'neuvedeny'}`,
    `Další informace: ${extra.value || 'neuvedeny'}`,
    photoNames.length
      ? `Fotografie (jen názvy, soubory se nenahrály): ${photoNames.join(', ')}`
      : 'Fotografie: žádné',
    '',
    'Stav: žádost o ruční kontakt. Platba neproběhla. Propagace není aktivní. Předplatné se nespustilo.',
    'Obchodní podmínky a informace o zpracování osobních údajů na webu zatím nejsou.',
  ].join('\n')

  return {
    ok: true,
    subject: oneLine(`Žádost o měsíc zdarma: ${businessName.value} (${plan.name})`).slice(0, 160),
    text,
    replyTo: email.value,
    emailKey: email.value.toLowerCase(),
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

  let response
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
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
  } catch {
    release(emailKey)
    if (ipKey) release(ipKey)
    return fail(502, 'email-failed', 'E-mail se nepodařilo odeslat. Žádost neodešla, můžeš to zkusit znovu.')
  }

  if (!response.ok) {
    release(emailKey)
    if (ipKey) release(ipKey)
    return fail(502, 'email-failed', 'E-mail se nepodařilo odeslat. Žádost neodešla, můžeš to zkusit znovu.')
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      accepted: true,
      paid: false,
      activated: false,
      message: 'Žádost o první měsíc zdarma je přijatá. Nic se nezaplatilo a propagace se sama nezapnula.',
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
