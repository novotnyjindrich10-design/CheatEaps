/**
 * E-mail majiteli po schválení podniku (Resend, server-side).
 * Neoznačuje neodeslaný e-mail za úspěch.
 */

const SUPPORT_EMAIL = 'novotnyjindrich10@gmail.com'

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
  const lines = [
    'Dobrý den,',
    '',
    `máme radost — podnik „${name}“ je teď zveřejněný na CheapEats Brno.`,
    '',
    'Lidé, kteří u nás hledají, kde se dobře najíst, ho můžou najít ve výsledcích a na stránce podniku.',
  ]
  if (url) {
    lines.push('', `Přímý odkaz na veřejný profil:`, url)
  }
  lines.push(
    '',
    `Když budete chtít cokoli upravit (popis, fotku, údaje), napište nám na ${SUPPORT_EMAIL}.`,
    '',
    'Děkujeme, že jste s námi.',
    '',
    'Tým CheapEats Brno',
  )
  return {
    to,
    subject: 'Váš podnik je nyní na CheapEats!',
    text: lines.join('\n'),
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
        subject: letter.subject,
        text: letter.text,
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
