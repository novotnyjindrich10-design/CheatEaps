/**
 * Profesionální české e-mailové šablony FoodGo (HTML + plain text).
 * HTML escapuje vstup. Neodesílá samo — volá je server po kontrole env.
 */
import { BRAND_CITY, BRAND_MARK, CONTACT_EMAIL } from '../constants/brand.js'

export function escapeEmailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function linesToHtml(lines) {
  return lines
    .map((line) => {
      const text = String(line ?? '')
      if (!text) return '<p style="margin:0 0 12px">&nbsp;</p>'
      return `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#1a1a1a">${escapeEmailHtml(text)}</p>`
    })
    .join('')
}

export function wrapFoodGoEmail({ title, preheader = '', bodyLines = [], footerNote = '' }) {
  const safeTitle = escapeEmailHtml(title)
  const safePre = escapeEmailHtml(preheader)
  const body = linesToHtml(bodyLines)
  const footer = escapeEmailHtml(
    footerNote || `${BRAND_CITY} · ${CONTACT_EMAIL} · Tento e-mail není marketingový newsletter.`,
  )
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
${safePre ? `<div style="display:none;max-height:0;overflow:hidden">${safePre}</div>` : ''}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8e4">
<tr><td style="background:#0f7a4c;padding:18px 24px">
<p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.12em;color:#ffffff">${escapeEmailHtml(BRAND_MARK)}</p>
<p style="margin:4px 0 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.88)">${escapeEmailHtml(BRAND_CITY)}</p>
</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f2a1c">${safeTitle}</h1>
${body}
</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e2e8e4">
<p style="margin:0;font-size:12px;line-height:1.45;color:#5a6b62">${footer}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  const text = [title, '', ...bodyLines, '', footerNote || `${BRAND_CITY} · ${CONTACT_EMAIL}`]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
  return { html, text }
}

export function inquiryRestaurantEmail({ reference, businessName, planName, serviceLabel, amountLabel, vatNote }) {
  return wrapFoodGoEmail({
    title: 'Poptávka propagace je přijatá',
    preheader: 'Nic se nezaplatilo. Reklama se nezapnula.',
    bodyLines: [
      'Dobrý den,',
      'přijali jsme nezávaznou poptávku placené propagace na FoodGo Brno.',
      reference ? `Číslo poptávky: ${reference}` : 'Číslo poptávky se doplní, až bude evidence zapnutá.',
      `Podnik: ${businessName || 'neuveden'}`,
      `Balíček: ${planName || 'neuveden'}`,
      `Délka: ${serviceLabel || 'neuvedena'}`,
      amountLabel ? `Ceníková částka: ${amountLabel}` : '',
      vatNote || '',
      'Nic se nezaplatilo. Reklama se nezapnula. Platba se sama nestrhává.',
      'Ozveme se na tento e-mail po kontrole.',
    ].filter(Boolean),
  })
}

export function inquiryOperatorEmail({ subjectLines }) {
  return wrapFoodGoEmail({
    title: 'Nová poptávka propagace',
    preheader: 'Nezávazná poptávka — platba neproběhla',
    bodyLines: subjectLines,
  })
}

export function paymentVerifiedEmail({ reference, businessName, amountLabel }) {
  return wrapFoodGoEmail({
    title: 'Platba byla ověřena',
    preheader: 'Úhrada je v evidenci. Propagace se zapne až po aktivaci.',
    bodyLines: [
      'Dobrý den,',
      `u poptávky ${reference || ''} jsme zaznamenali ověřenou úhradu.`,
      `Podnik: ${businessName || 'neuveden'}`,
      amountLabel ? `Částka: ${amountLabel}` : '',
      'Propagace se nezapíná automaticky z tohoto e-mailu. Aktivaci provede administrátor po kontrole.',
    ].filter(Boolean),
  })
}

export function promotionActivatedEmail({ businessName, planName, startsAt, endsAt }) {
  return wrapFoodGoEmail({
    title: 'Propagace je aktivní',
    preheader: 'Zvýraznění běží v katalogu FoodGo',
    bodyLines: [
      'Dobrý den,',
      `propagace podniku ${businessName || ''} (${planName || ''}) je zapnutá.`,
      startsAt && endsAt ? `Období: ${startsAt} – ${endsAt}` : '',
      'Po datu konce zvýraznění skončí samo. Automatické obnovení není zapnuté.',
    ].filter(Boolean),
  })
}

export function promotionEndedEmail({ businessName, endsAt }) {
  return wrapFoodGoEmail({
    title: 'Propagace skončila',
    preheader: 'Zvýraznění už není aktivní',
    bodyLines: [
      'Dobrý den,',
      `propagace podniku ${businessName || ''} skončila${endsAt ? ` (${endsAt})` : ''}.`,
      'Podnik zůstává v běžném katalogu. Novou nezávaznou poptávku můžeš poslat na stránce Pro podniky.',
    ].filter(Boolean),
  })
}

export function businessApplicationEmail({ kind, businessName, reference }) {
  const isOwner = kind === 'ownership'
  return wrapFoodGoEmail({
    title: isOwner ? 'Žádost o správu podniku' : 'Žádost o přidání podniku',
    preheader: 'Žádost čeká na kontrolu',
    bodyLines: [
      'Dobrý den,',
      isOwner
        ? 'přijali jsme žádost o správu profilu podniku v katalogu FoodGo.'
        : 'přijali jsme žádost o přidání podniku do katalogu FoodGo.',
      `Podnik: ${businessName || 'neuveden'}`,
      reference ? `Evidence: ${reference}` : '',
      'Změna v katalogu nastane až po kontrole. Tento e-mail sám nic v katalogu nemění.',
    ].filter(Boolean),
  })
}
