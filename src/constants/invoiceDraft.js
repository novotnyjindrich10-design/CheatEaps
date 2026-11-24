/**
 * Text pro ruční vystavení faktury ve vlastním účetnictví.
 * Není účetní ani daňový doklad a sám o sobě se nikam neodesílá.
 */
import { formatKc } from './businessPlans.js'
import { OPERATOR, operatorAddress, operatorIsComplete, presentPrice } from './operator.js'

export function buildInvoiceDraft(order, source = OPERATOR) {
  const operator = source || OPERATOR
  const amount = Number(order?.amount)
  const price = presentPrice(Number.isFinite(amount) ? amount : 0, operator)
  const complete = operatorIsComplete(operator)
  const lines = [
    'PODKLAD K RUČNÍ FAKTUŘE',
    'Toto není účetní ani daňový doklad. Web fakturu nevystavuje, nečísluje a úhradu nepotvrzuje.',
    'Číslo dokladu, datum a odeslání doplní provozovatel ve svém účetnictví a pak je zapíše do administrace.',
    '',
  ]
  if (!complete) {
    lines.push('Údaje provozovatele nejsou doplněné. Chybí jméno nebo název, IČO, sídlo nebo e-mail. Podklad zatím nelze použít jako předlohu faktury.')
  } else {
    lines.push(`Dodavatel: ${String(operator.legalName).trim()}`)
    lines.push(`IČO: ${String(operator.ico).trim()}`)
    if (String(operator.dic || '').trim()) lines.push(`DIČ: ${String(operator.dic).trim()}`)
    lines.push(`Sídlo: ${operatorAddress(operator)}`)
    lines.push(`E-mail: ${String(operator.email).trim()}`)
    lines.push('I s doplněnými údaji jde jen o podklad. Platný doklad vznikne až po kontrole v účetnictví.')
  }
  lines.push(
    '',
    `Odběratel: ${order?.companyName || ''}`,
    `IČO odběratele: ${order?.ico || 'neuvedeno'}`,
    `DIČ odběratele: ${order?.dic || 'neuvedeno'}`,
    `Fakturační adresa: ${order?.billingAddress || ''}`,
    `Kontakt: ${order?.contactName || ''}, ${order?.email || ''}, ${order?.phone || ''}`,
    `Podnik: ${order?.businessName || ''}`,
    `Poptávka: ${order?.reference || 'bez čísla evidence'}`,
    `Balíček: ${order?.planName || order?.planId || ''}`,
    `Délka: ${order?.serviceLabel || ''}`,
    'Platba: jednorázová. Samo se neobnovuje.',
    `Ceníková částka: ${Number.isFinite(amount) ? formatKc(amount) : ''}`,
  )
  if (price.finalAmount == null) {
    lines.push('Konečná částka: nelze určit. Režim DPH není potvrzený, daň se nedopočítává.')
  } else {
    lines.push(`Konečná částka: ${formatKc(price.finalAmount)}`)
  }
  lines.push(price.vatNote)
  lines.push('Splatnost určí provozovatel. Zaplacení se v administraci označí až po kontrole úhrady.')
  return {
    text: lines.join('\n'),
    validDocument: false,
    operatorComplete: complete,
    finalAmount: price.finalAmount,
    vatStatus: price.vatStatus,
    vatNote: price.vatNote,
  }
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/**
 * Export evidence pro účetní. Není hromadné vystavení faktur.
 * gateway-test řádky označí jako test — do ostrých tržeb nepatří.
 */
export function buildOrdersCsv(orders = [], source = OPERATOR) {
  const header = [
    'reference',
    'status',
    'paymentStatus',
    'paymentSource',
    'planId',
    'amountCzk',
    'finalAmountCzk',
    'currency',
    'vatStatus',
    'companyName',
    'ico',
    'dic',
    'billingAddress',
    'email',
    'placeId',
    'invoiceNumber',
    'paidAt',
    'startsAt',
    'endsAt',
    'isTestPayment',
  ]
  const rows = [header.join(',')]
  for (const order of orders) {
    const price = presentPrice(Number(order?.amount) || 0, source)
    const isTest = String(order?.paymentSource || '') === 'gateway-test'
    rows.push([
      order.reference,
      order.status,
      order.paymentStatus,
      order.paymentSource || '',
      order.planId,
      order.amount,
      price.finalAmount == null ? '' : price.finalAmount,
      order.currency || 'CZK',
      price.vatStatus,
      order.companyName,
      order.ico || '',
      order.dic || '',
      order.billingAddress || '',
      order.email || '',
      order.placeId || '',
      order.invoiceNumber || '',
      order.paidAt || '',
      order.startsAt || '',
      order.endsAt || '',
      isTest ? 'yes' : 'no',
    ].map(csvCell).join(','))
  }
  return `${rows.join('\n')}\n`
}
