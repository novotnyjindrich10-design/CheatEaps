/**
 * Kontrola připravenosti FoodGo bez deploye, bez zápisu do DB a bez výpisu tajemství.
 * Spuštění: npm run check:ready
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const steps = []

function run(label, command, args, opts = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
    ...opts,
  })
  const ok = result.status === 0
  steps.push({
    label,
    ok,
    status: result.status,
    note: ok ? 'pass' : String(result.stderr || result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-3).join(' | ').slice(0, 240),
  })
  return ok
}

function envPresence() {
  const path = resolve('.env')
  if (!existsSync(path)) {
    return { envFile: false, RESEND_API_KEY: false, INQUIRY_TO_EMAIL: false, EMAIL_FROM: false }
  }
  const raw = readFileSync(path, 'utf8')
  const get = (key) => {
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return Boolean(m && String(m[1]).trim())
  }
  const key = (() => {
    const m = raw.replace(/^\uFEFF/, '').match(/^RESEND_API_KEY=(.*)$/m)
    const v = m ? String(m[1]).trim() : ''
    const shapeOk = /^re_[1-9A-HJ-NP-Za-km-z]{8}_[1-9A-HJ-NP-Za-km-z]{24}$/.test(v)
    return {
      present: Boolean(v),
      prefixOk: v.startsWith('re_'),
      shapeOk,
      length: v.length,
    }
  })()
  return {
    envFile: true,
    gitignoredHint: true,
    RESEND_API_KEY: key,
    INQUIRY_TO_EMAIL: get('INQUIRY_TO_EMAIL'),
    EMAIL_FROM: get('EMAIL_FROM'),
  }
}

const env = envPresence()
steps.push({
  label: 'env-resend',
  ok: Boolean(
    env.RESEND_API_KEY?.present
    && env.RESEND_API_KEY?.shapeOk
    && env.INQUIRY_TO_EMAIL
    && env.EMAIL_FROM,
  ),
  status: env.RESEND_API_KEY?.shapeOk ? 0 : 2,
  note: !env.RESEND_API_KEY?.present
    ? 'RESEND_API_KEY missing'
    : !env.RESEND_API_KEY.shapeOk
      ? 'key present, unexpected Resend shape'
      : 'key present, official shape ok',
})

run('unit-tests', 'npm', ['test'])
run('lint', 'npm', ['run', 'lint'])
run('build', 'npm', ['run', 'build'])
run('catalog-audit', 'npm', ['run', 'audit:catalog'])
run('resend-config', 'node', ['scripts/check-resend-config.mjs'])

const report = {
  ok: steps.every((s) => s.ok),
  env: {
    envFile: env.envFile,
    inquiryToEmail: env.INQUIRY_TO_EMAIL,
    emailFrom: env.EMAIL_FROM,
    resendKeyPresent: Boolean(env.RESEND_API_KEY?.present),
    resendKeyPrefixOk: Boolean(env.RESEND_API_KEY?.prefixOk),
    resendKeyLength: env.RESEND_API_KEY?.length ?? 0,
  },
  steps,
  notes: [
    'Nepíše tajné hodnoty.',
    'Neprovádí deploy ani zápis do produkční DB.',
    'E2E spusť zvlášť: npm run test:e2e',
    'GUI pro klíč: npm run resend:key',
  ],
}

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
