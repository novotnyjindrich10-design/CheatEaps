/**
 * Placené umístění je vidět jen u ověřeného a zaplaceného záznamu
 * v době mezi začátkem a koncem. Příznak na podniku sám reklamu nezapne.
 * Po expiraci zvýraznění skončí a podnik se vrátí mezi běžné výsledky.
 */

export const SPONSORED_LABEL = 'Sponzorováno'

const PLAN_RANK = { premium: 0, plus: 1, start: 2 }

export function activeSponsorship(record, now = Date.now()) {
  if (!record || record.verified !== true || record.status !== 'active') return null
  const start = Date.parse(record.startsAt)
  const end = Date.parse(record.endsAt)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  if (now < start || now >= end) return null
  return {
    verified: true,
    status: 'active',
    planId: record.planId || '',
    startsAt: record.startsAt,
    endsAt: record.endsAt,
  }
}

export function isSponsoredPlace(place, now = Date.now()) {
  return activeSponsorship(place?.sponsorship, now) != null
}

function withoutClientFlag(place) {
  if (!place?.sponsored && place?.placement !== 'sponsored' && !place?.sponsorship) return place
  const next = { ...place }
  delete next.sponsored
  delete next.placement
  delete next.sponsorship
  return next
}

export function applySponsorships(places, records, now = Date.now()) {
  const active = new Map()
  for (const record of records || []) {
    const live = activeSponsorship(
      {
        verified: true,
        status: 'active',
        planId: record.planId,
        startsAt: record.startsAt,
        endsAt: record.endsAt,
      },
      now,
    )
    const placeId = String(record?.placeId || '')
    if (live && placeId) active.set(placeId, live)
  }
  return (places || []).map((place) => {
    const live = active.get(place?.id)
    if (!live) return withoutClientFlag(place)
    return {
      ...place,
      sponsored: true,
      placement: 'sponsored',
      sponsorship: live,
    }
  })
}

/**
 * Aktivní reklama je mimo organická doporučení.
 * Neověřený příznak sponsored podnik v běžném seznamu nechá a štítek nedostane.
 */
export function partitionPlacements(places, now = Date.now()) {
  const organic = []
  const sponsored = []
  for (const place of places || []) {
    if (isSponsoredPlace(place, now)) sponsored.push(place)
    else organic.push(withoutClientFlag(place))
  }
  sponsored.sort(
    (a, b) => (PLAN_RANK[a.sponsorship?.planId] ?? 9) - (PLAN_RANK[b.sponsorship?.planId] ?? 9),
  )
  return { organic, sponsored, withheld: [] }
}

export function showSponsoredLabel(place, now = Date.now()) {
  return isSponsoredPlace(place, now)
}

export function formatSponsorshipRange(sponsorship, now = Date.now()) {
  const live = activeSponsorship(sponsorship, now)
  if (!live) return ''
  const fmt = new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium' })
  return `${fmt.format(new Date(live.startsAt))} – ${fmt.format(new Date(live.endsAt))}`
}
