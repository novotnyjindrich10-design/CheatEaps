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
function promotionRequestDevApi(env) {
  return {
    name: 'promotion-request-dev-api',
    configureServer(server) {
      for (const key of ['RESEND_API_KEY', 'INQUIRY_TO_EMAIL', 'EMAIL_FROM']) {
        if (env[key] && process.env[key] == null) process.env[key] = env[key]
      }
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0]
        if (pathname !== '/api/promotion-request') return next()
        handleDevPromotionRequest(req, res).catch((error) => {
          console.error(error)
          if (res.headersSent) return
          res.statusCode = 500
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, accepted: false, error: 'internal-error', message: 'Žádost se nepodařilo zpracovat.' }))
        })
      })
    },
  }
}

async function handleDevPromotionRequest(req, res) {
  const contentType = req.headers['content-type']
  const headers = {}
  if (typeof contentType === 'string') headers['content-type'] = contentType
  if (typeof req.headers['x-forwarded-for'] === 'string') {
    headers['x-forwarded-for'] = req.headers['x-forwarded-for']
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  const request = new Request('http://127.0.0.1/api/promotion-request', {
    method: req.method,
    headers,
    body: hasBody ? await readBody(req) : undefined,
  })
  const file = pathToFileURL(path.resolve('api/promotion-request.js')).href
  const mod = await import(file)
  const response = await mod.default.fetch(request)
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), promotionRequestDevApi(env)],
    server: {
      watch: {
        ignored: ['**/reports/**', '**/osm-brno-*.json'],
      },
    },
  }
})
