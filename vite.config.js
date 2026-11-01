import react from '@vitejs/plugin-react'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** Jen vývojový server. Produkční Vite build tuhle obsluhu do prohlížeče nedává. */
function apiDevMiddleware(env) {
  return {
    name: 'cheapeats-api-dev',
    configureServer(server) {
      for (const key of [
        'RESEND_API_KEY',
        'INQUIRY_TO_EMAIL',
        'EMAIL_FROM',
        'SUPABASE_URL',
        'SUPABASE_ANON_KEY',
        'GOOGLE_PLACES_API_KEY',
        'PUBLIC_SITE_URL',
      ]) {
        if (env[key] && process.env[key] == null) process.env[key] = env[key]
      }
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] || ''
        if (!pathname.startsWith('/api/')) return next()
        handleDevApi(req, res).catch((error) => {
          console.error(error)
          if (res.headersSent) return
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, message: 'Požadavek se nepodařilo zpracovat.' }))
        })
      })
    },
  }
}

async function handleDevApi(req, res) {
  const contentType = req.headers['content-type']
  const headers = {}
  if (typeof contentType === 'string') headers['content-type'] = contentType
  if (typeof req.headers.cookie === 'string') headers.cookie = req.headers.cookie
  if (typeof req.headers.origin === 'string') headers.origin = req.headers.origin
  if (typeof req.headers.referer === 'string') headers.referer = req.headers.referer
  if (typeof req.headers.host === 'string') headers.host = req.headers.host
  if (typeof req.headers['x-forwarded-host'] === 'string') {
    headers['x-forwarded-host'] = req.headers['x-forwarded-host']
  }
  if (typeof req.headers['x-forwarded-proto'] === 'string') {
    headers['x-forwarded-proto'] = req.headers['x-forwarded-proto']
  }
  if (typeof req.headers['x-forwarded-for'] === 'string') {
    headers['x-forwarded-for'] = req.headers['x-forwarded-for']
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const host = typeof req.headers.host === 'string' ? req.headers.host : '127.0.0.1'
  const request = new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? await readBody(req) : undefined,
  })
  const file = pathToFileURL(path.resolve('src/server/apiRouter.js')).href
  const mod = await import(`${file}?t=${Date.now()}`)
  const response = await mod.apiRouter(request)
  res.statusCode = response.status
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : []
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return
    res.setHeader(key, value)
  })
  for (const cookie of cookies) res.appendHeader('set-cookie', cookie)
  res.end(Buffer.from(await response.arrayBuffer()))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), apiDevMiddleware(env)],
    server: {
      watch: {
        ignored: ['**/reports/**', '**/osm-brno-*.json'],
      },
    },
  }
})
