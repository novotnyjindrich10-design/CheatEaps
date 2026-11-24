import { readFileSync, unlinkSync, existsSync } from 'node:fs'

function load(p) {
  if (!existsSync(p)) return {}
  const raw = readFileSync(p, 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    let v = line.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"'))
      || (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[line.slice(0, i).trim()] = v
  }
  return env
}

function host(v) {
  try {
    return new URL(String(v || '').replace(/\/$/, '').replace(/\/rest\/v1$/i, '')).host
  } catch {
    return ''
  }
}

const prev = load('.env.vercel.check')
const prod = load('.env.vercel.prod.check')
const local = load('.env')
const prevHost = host(prev.SUPABASE_URL)
const prodHost = host(prod.SUPABASE_URL)
const localHost = host(local.SUPABASE_URL)

console.log(JSON.stringify({
  local_host: localHost || null,
  preview_url_host: prevHost || (String(prev.SUPABASE_URL || '').includes('SENSITIVE') ? 'secret-not-pulled' : null),
  production_url_host: prodHost || (String(prod.SUPABASE_URL || '').includes('SENSITIVE') ? 'secret-not-pulled' : null),
  preview_public_site: prev.PUBLIC_SITE_URL || null,
  production_public_site: prod.PUBLIC_SITE_URL || null,
  hosts_comparable: Boolean(prevHost && prodHost),
  same_host_if_known: prevHost && prodHost ? prevHost === prodHost : null,
}, null, 2))

for (const f of ['.env.vercel.check', '.env.vercel.prod.check']) {
  try {
    if (existsSync(f)) unlinkSync(f)
  } catch {
    /* ignore */
  }
}
