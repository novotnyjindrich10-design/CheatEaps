/**
 * Jediná Vercel Serverless Function pro všechny /api/* cesty (Hobby limit 12).
 * Nested cesty směřuje vercel.json rewrite `/api/:path*` → `/api` (zachová původní URL).
 */
import { apiRouter } from '../src/server/apiRouter.js'

export default {
  fetch(request) {
    return apiRouter(request)
  },
}
