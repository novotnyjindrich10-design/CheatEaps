/**
 * Nastaví jen e-mailové Resend proměnné (bez API klíče).
 * Nic tajného nevypisuje. Nepřepisuje jiné klíče v .env.
 *
 * node scripts/set-resend-emails.mjs
 */
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const TO = 'foodgocz@gmail.com'
const FROM = 'FoodGo <onboarding@resend.dev>'
const envPath = resolve('.env')
const example = resolve('.env.example')

if (!existsSync(envPath)) {
  if (!existsSync(example)) {
    console.error('Chybí .env i .env.example')
    process.exit(1)
  }
  copyFileSync(example, envPath)
  console.log('Vytvořen .env ze .env.example')
}

function setLine(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  const line = `${key}=${value}`
  if (pattern.test(content)) return content.replace(pattern, line)
  const needsNl = content.length > 0 && !content.endsWith('\n')
  return `${content}${needsNl ? '\n' : ''}${line}\n`
}

let raw = readFileSync(envPath, 'utf8')
raw = setLine(raw, 'INQUIRY_TO_EMAIL', TO)
raw = setLine(raw, 'EMAIL_FROM', FROM)
writeFileSync(envPath, raw, 'utf8')

console.log(JSON.stringify({
  ok: true,
  INQUIRY_TO_EMAIL: 'set',
  EMAIL_FROM: 'set',
  note: 'RESEND_API_KEY se timto skriptem nemenil',
}, null, 2))
