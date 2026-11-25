/**
 * E-mail majiteli po schválení podniku (Resend, server-side).
 * Neoznačuje neodeslaný e-mail za úspěch.
 */
import { CONTACT_EMAIL } from '../constants/brand.js'
import { wrapFoodGoEmail } from './emailTemplates.js'

function configured(env) {
  const apiKey = String(env.RESEND_API_KEY ?? '').trim()
  const from = String(env.EMAIL_FROM ?? '').trim()
  if (!apiKey || !from || /[\r\n]/.test(from) || !from.includes('@')) return null
  return { apiKey, from }
}

export function buildApprovalEmail({ businessName, placeUrl, ownerEmail }) {
  const name = String(businessName ?? '').trim() || 'váš podnik'
  const url = String(placeUrl ?? '').trim()
  const to = String(ownerEmail ?? '').trim()
  const bodyLines = [
    'Dobrý den,',
    `máme radost — podnik „${name}“ je teď zveřejněný na FoodGo Brno.`,
    'Lidé, kteří u nás hledají, kde se dobře najíst, ho můžou najít ve výsledcích a na stránce podniku.',
  ]
  if (url) {
    bodyLines.push(`Přímý odkaz na veřejný profil: ${url}`)
  }
  bodyLines.push(
    `Když budete chtít cokoli upravit (popis, fotku, údaje), napište nám na ${CONTACT_EMAIL}.`,
    'Děkujeme, že jste s námi.',
    'Tým FoodGo Brno',
  )
  const letter = wrapFoodGoEmail({
    title: 'Váš podnik je nyní na FoodGo',
    preheader: 'Profil je zveřejněný v katalogu',
    bodyLines,
  })
  return {
    to,
    subject: 'Váš podnik je nyní na FoodGo!',
    text: letter.text,
    html: letter.html,
  }
}

export async function sendBusinessApprovalEmail(payload, env, fetchImpl = fetch) {
  const mail = configured(env)
  if (!mail) {
    return {
      ok: false,
      status: 'skipped',
      error: 'email-not-configured',
      message:
        'Odesílání e-mailů není nastavené. Doplň RESEND_API_KEY a EMAIL_FROM na serveru. Žádost je schválená, e-mail neodešel.',
    }
  }

  const letter = buildApprovalEmail(payload)
  if (!letter.to.includes('@')) {
    return { ok: false, status: 'failed', error: 'invalid-recipient', message: 'E-mail majitele není platný.' }
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
        to: [letter.to],
        reply_to: CONTACT_EMAIL,
        subject: letter.subject,
        text: letter.text,
        html: letter.html,
      }),
    })
  } catch {
    return {
      ok: false,
      status: 'failed',
      error: 'email-failed',
      message: 'E-mail se nepodařilo odeslat.',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: 'failed',
      error: 'email-failed',
      message: 'E-mail se nepodařilo odeslat (Resend odmítl požadavek).',
    }
  }

  return { ok: true, status: 'sent', error: '', message: 'E-mail majiteli byl odeslán.' }
}
