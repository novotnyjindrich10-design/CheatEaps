/**
 * Kontrola Resend / e-mail env bez vypisování tajemství.
 * Spuštění: node scripts/check-resend-config.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describeResendKey, normalizeResendKey } from './lib/resend-key-shape.mjs'

function load(path) {
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return out
}

const env = { ...load(resolve('.env')), ...load(resolve('.env.local')), ...process.env }
const required = ['RESEND_API_KEY', 'INQUIRY_TO_EMAIL', 'EMAIL_FROM']
const optional = ['PUBLIC_SITE_URL']

function describeKey(name) {
  const value = String(env[name] ?? '').trim()
  if (!value) return { name, present: false }
  const info = {
    name,
    present: true,
    length: value.length,
  }
  if (name === 'RESEND_API_KEY') {
    const shape = describeResendKey(value)
    info.prefixOk = shape.prefixOk
    info.shapeOk = shape.accepted
    info.officialShape = shape.official
    info.lengthOk = shape.length >= 28 && shape.length <= 80
  }
  if (name === 'INQUIRY_TO_EMAIL') {
    info.looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }
  if (name === 'EMAIL_FROM') {
    info.hasAt = value.includes('@')
    info.usesResendDev = /onboarding@resend\.dev/i.test(value)
  }
  return info
}

const report = {
  required: required.map(describeKey),
  optional: optional.map(describeKey),
  readyForTrialSend: required.every((name) => {
    const value = String(env[name] ?? '').trim()
    if (!value) return false
    if (name === 'RESEND_API_KEY') {
      return describeResendKey(normalizeResendKey(value)).accepted
    }
    return true
  }),
  notes: [
    'Zkušební režim bez vlastní domény: EMAIL_FROM=FoodGo <onboarding@resend.dev>',
    'INQUIRY_TO_EMAIL musí být e-mail přihlášený v Resend účtu (jinak Resend doručení odmítne).',
    'Ostré doručení na libovolné adresy vyžaduje ověřenou doménu v Resend.',
    'Klíče patří jen do .env / Vercel Environment Variables, nikdy do Gitu ani VITE_*.',
    'Chybí-li klíč: npm run resend:key (maskovaný terminálový vstup, ne Chat).',
    'readyForTrialSend=true znamená jen lokálně kompletní env, ne ověřené doručení.',
  ],
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.readyForTrialSend ? 0 : 2)
