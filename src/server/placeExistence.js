/**
 * Serverová kontrola pravděpodobné existence podniku přes Google Places Text Search.
 * Nikdy netvrdí absolutní ověření. Klíč jen ze serverového prostředí.
 */

function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenOverlap(a, b) {
  const left = new Set(normalize(a).split(' ').filter((t) => t.length > 1))
  const right = new Set(normalize(b).split(' ').filter((t) => t.length > 1))
  if (!left.size || !right.size) return 0
  let hit = 0
  for (const token of left) if (right.has(token)) hit += 1
  return hit / Math.max(left.size, right.size)
}

export function scorePlaceCandidate(input, candidate) {
  const nameScore = tokenOverlap(input.businessName, candidate.name)
  const addressScore = Math.max(
    tokenOverlap(input.address, candidate.address),
    tokenOverlap(`${input.address} ${input.locality}`, candidate.address),
  )
  return Number((nameScore * 0.65 + addressScore * 0.35).toFixed(3))
}

export function classifyExistence(candidates, input) {
  const scored = (candidates || [])
    .map((item) => ({ ...item, score: scorePlaceCandidate(input, item) }))
    .sort((a, b) => b.score - a.score)

  if (!scored.length) {
    return {
      status: 'no_match',
      requiresManualReview: true,
      verified: false,
      summary:
        'V Google Places jsme nenašli shodu. To neznamená, že podnik neexistuje — žádost vyžaduje ruční kontrolu.',
      candidates: [],
    }
  }

  const top = scored[0]
  const second = scored[1]
  const strong = top.score >= 0.55
  const closeSecond = second && second.score >= 0.45 && top.score - second.score < 0.12

  if (strong && !closeSecond) {
    return {
      status: 'likely_match',
      requiresManualReview: true,
      verified: false,
      summary: `Našli jsme pravděpodobnou shodu „${top.name}“ (${top.address || 'adresa neuvedena'}). Jde o nápovědu, ne o potvrzení existence. Zveřejnění schvaluje administrátor.`,
      candidates: scored.slice(0, 5),
    }
  }

  if (scored.length > 1 || closeSecond || top.score >= 0.35) {
    return {
      status: 'ambiguous',
      requiresManualReview: true,
      verified: false,
      summary:
        'Našli jsme více možných shod nebo nejistou podobnost. Žádost vyžaduje ruční kontrolu administrátora.',
      candidates: scored.slice(0, 5),
    }
  }

  return {
    status: 'no_match',
    requiresManualReview: true,
    verified: false,
    summary:
      'Shoda s Google Places je slabá. Automaticky netvrdíme, že podnik neexistuje — žádost vyžaduje ruční kontrolu.',
    candidates: scored.slice(0, 5),
  }
}

export async function checkPlaceExistence(input, env = process.env, fetchImpl = fetch) {
  const apiKey = String(env.GOOGLE_PLACES_API_KEY ?? '').trim()
  const businessName = String(input.businessName ?? '').trim()
  const address = String(input.address ?? '').trim()
  const locality = String(input.locality ?? 'Brno').trim() || 'Brno'

  if (!businessName || !address) {
    return {
      ok: false,
      status: 'unavailable',
      verified: false,
      requiresManualReview: true,
      summary: 'Pro kontrolu doplň název i adresu.',
      candidates: [],
    }
  }

  if (!apiKey) {
    return {
      ok: true,
      status: 'unavailable',
      verified: false,
      requiresManualReview: true,
      summary:
        'Kontrola existence přes Google Places není nastavená (chybí GOOGLE_PLACES_API_KEY na serveru). Podnik nebyl ověřen. Žádost půjde k ruční kontrole.',
      candidates: [],
      configured: false,
    }
  }

  const textQuery = [businessName, address, locality].filter(Boolean).join(', ')
  let response
  try {
    response = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'cs',
        regionCode: 'CZ',
        maxResultCount: 5,
        locationBias: {
          circle: {
            center: { latitude: 49.1951, longitude: 16.6068 },
            radius: 20000,
          },
        },
      }),
    })
  } catch {
    return {
      ok: true,
      status: 'unavailable',
      verified: false,
      requiresManualReview: true,
      summary: 'Google Places teď neodpověděl. Podnik nebyl ověřen — žádost vyžaduje ruční kontrolu.',
      candidates: [],
      configured: true,
    }
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: true,
      status: 'unavailable',
      verified: false,
      requiresManualReview: true,
      summary: 'Kontrola existence se nepovedla (Places API). Podnik nebyl ověřen — žádost vyžaduje ruční kontrolu.',
      candidates: [],
      configured: true,
    }
  }

  const candidates = (body.places || []).map((place) => ({
    placeId: place.id || '',
    name: place.displayName?.text || '',
    address: place.formattedAddress || '',
  }))

  const classified = classifyExistence(candidates, { businessName, address, locality })
  return {
    ok: true,
    configured: true,
    verified: false,
    ...classified,
  }
}
