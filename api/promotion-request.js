/**
 * Vercel Function: POST /api/promotion-request
 * Vite ve výchozím nastavení api/ neobsluhuje. Lokálně ji přidává jen vývojový server v vite.config.js.
 * E-mail jde přes Resend. Klíče jsou v proměnných prostředí, ne v tomto souboru.
 */
import { promotionRequestHttp } from '../src/server/promotionRequest.js'

function json(body, status, headers) {
  return Response.json(body, { status, headers })
}

export default {
  async fetch(request) {
    const result = await promotionRequestHttp(request)
    return json(result.body, result.status, result.headers)
  },
}
