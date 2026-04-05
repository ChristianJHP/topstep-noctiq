/**
 * GET /api/calendar
 *
 * Returns upcoming high-impact economic events from Finnhub.
 * Filters to: US only, impact == 3 (high) or impact === 'high'.
 * Cached for 1 hour. Returns empty array (not error) if Finnhub is down.
 */

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY
const TTL_MS      = 60 * 60 * 1000 // 1 hour

let cache = { data: null, fetchedAt: 0 }

function formatEvents(raw) {
  return (raw ?? [])
    .filter(e => {
      const isUS     = e.country === 'US'
      // Finnhub returns impact as number (3=high) or string ('high')
      const isHigh   = e.impact === 3 || e.impact === 'high'
      return isUS && isHigh
    })
    .map(e => ({
      event:    e.event    ?? '',
      country:  e.country  ?? '',
      datetime: e.time     ?? null,
      actual:   e.actual   ?? null,
      forecast: e.estimate ?? null,
      previous: e.prev     ?? null,
      impact:   e.impact,
      unit:     e.unit     ?? '',
    }))
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
}

export async function GET(req) {
  const forceRefresh = new URL(req.url).searchParams.get('refresh') === 'true'
  const now = Date.now()

  if (!forceRefresh && cache.data && now - cache.fetchedAt < TTL_MS) {
    return Response.json({ calendar: cache.data, fetchedAt: new Date(cache.fetchedAt).toISOString(), cached: true })
  }

  if (!FINNHUB_KEY) {
    return Response.json({ calendar: [], error: 'FINNHUB_API_KEY not configured', cached: false })
  }

  try {
    const today    = new Date().toISOString().split('T')[0]
    const nextWeek = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0]
    const url      = `https://finnhub.io/api/v1/calendar/economic?from=${today}&to=${nextWeek}&token=${FINNHUB_KEY}`
    const res      = await fetch(url)
    if (!res.ok) throw new Error(`Finnhub calendar ${res.status}`)
    const json     = await res.json()
    const calendar = formatEvents(json.economicCalendar?.economicData)
    cache = { data: calendar, fetchedAt: now }
    return Response.json({ calendar, fetchedAt: new Date(now).toISOString(), cached: false })
  } catch (err) {
    console.error('[calendar] Finnhub fetch failed:', err.message)
    if (cache.data) {
      return Response.json({ calendar: cache.data, fetchedAt: new Date(cache.fetchedAt).toISOString(), cached: true, stale: true, error: err.message })
    }
    return Response.json({ calendar: [], error: err.message, cached: false })
  }
}
