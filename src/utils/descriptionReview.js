/**
 * Kontrola a úprava popisu podniku.
 * Výchozí engine je pravidlový (ne jazykový model).
 * Nevymýšlí otevírací dobu, ceny ani služby.
 */

import { findBusinessPlan } from '../constants/businessPlans.js'
import { ACTIVE_APPLICATION_PLAN, polishDescription } from './businessApplication.js'

const SUSPICIOUS = [
  { re: /\b(otevřen[oa]|otevírací\s+dob[ay]|po–pá|po-pá|nonstop)\b/i, note: 'Popis zmiňuje otevírací dobu — ověř, že je pravdivá, nebo ji vynech.' },
  { re: /\b(\d{2,4}\s*Kč|od\s*\d+\s*Kč|menu\s+od)\b/i, note: 'Popis zmiňuje ceny — do žádosti je neuváděj, pokud je nemáš ověřené.' },
  { re: /\b(rozvoz|donáška|wolt|foodora)\b/i, note: 'Popis zmiňuje rozvoz — uveď jen pokud to opravdu nabízíte.' },
  { re: /\b(nejlepší|nejlevnější|#1|number\s*one)\b/i, note: 'Superlaivy působí marketingově; zvaž klidnější formulaci.' },
  { re: /(.)\1{5,}/, note: 'V textu jsou podezřelé opakující se znaky.' },
]

export function reviewDescription(raw, context = {}) {
  const max = findBusinessPlan(ACTIVE_APPLICATION_PLAN)?.descriptionMax ?? 400
  const original = String(raw ?? '').trim()
  const warnings = []

  if (!original) {
    return {
      ok: false,
      engine: 'rules',
      engineLabel: 'Pravidlová kontrola CheapEats (ne jazykový model)',
      message: 'Nejdřív napiš popis podniku.',
      original: '',
      suggested: '',
      warnings: ['Chybí popis podniku.'],
    }
  }

  if (original.length < 20) warnings.push('Popis je krátký — doplň, čím je podnik charakteristický (bez vymyšlených detailů).')
  if (original.length > max) warnings.push(`Popis je delší než ${max} znaků — zkrátíme ho při úpravě.`)

  for (const item of SUSPICIOUS) {
    if (item.re.test(original)) warnings.push(item.note)
  }

  const name = String(context.businessName ?? '').trim()
  const locality = String(context.locality ?? '').trim()
  if (name && original.length >= 20 && !original.toLowerCase().includes(name.toLowerCase().slice(0, Math.min(8, name.length)))) {
    warnings.push('V popisu není název podniku — není to chyba, ale můžeš ho zmínit, pokud to dává smysl.')
  }
  if (!locality && !/brno/i.test(original)) {
    warnings.push('Lokalita v popisu chybí — adresa je v jiném poli, do popisu ji nemusíš opakovat.')
  }

  const suggested = polishDescription(original, context).slice(0, max)

  return {
    ok: true,
    engine: 'rules',
    engineLabel: 'Pravidlová kontrola CheapEats (ne jazykový model)',
    message:
      suggested === original
        ? 'Úprava nezasáhla do významu — text už byl v pořádku, nebo šlo jen o drobnosti.'
        : 'Navrhli jsme stylistickou úpravu bez přidání nových informací.',
    original,
    suggested,
    warnings,
    modelAvailable: false,
  }
}
