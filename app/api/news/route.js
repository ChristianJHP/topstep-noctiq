/**
 * GET /api/news
 *
 * Returns latest macro-relevant news from Finnhub general feed.
 * Cached for 10 minutes. Returns empty array (not error) if Finnhub is down.
 */

const FINNHUB_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY
const TTL_MS      = 10 * 60 * 1000 // 10 minutes

const MACRO_INCLUDE = [
  'fed','fomc','powell','inflation','cpi','ppi','gdp','jobs','unemployment',
  'tariff','trade war','interest rate','yield','treasury','recession','opec',
  'crude','oil','geopolit','china','war','sanction','rate cut','rate hike',
  'monetary','payroll','non-farm','gold','commodit','debt','deficit','fiscal',
]
const NOISE_EXCLUDE = [
  'should you buy','millionaire','best stocks','is it too late','screaming buy',
  'beginner','how to invest','10 stocks','5 stocks','dividend guide','etf guide',
]

let cache = { data: null, fetchedAt: 0 }

function filterNews(articles) {
  const seen = new Set()
  const out  = []
  for (const a of articles ?? []) {
    const headline = a.headline ?? ''
    if (seen.has(headline) || !headline) continue
    const low = headline.toLowerCase()
    if (NOISE_EXCLUDE.some(k => low.includes(k))) continue
    if (!MACRO_INCLUDE.some(k => low.includes(k))) continue
    seen.add(headline)
    out.push({
      headline,
      source:   a.source   ?? '',
      datetime: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
      url:      a.url      ?? '',
    })
    if (out.length >= 10) break
  }
  return out
}

export async function GET(req) {
  const forceRefresh = new URL(req.url).searchParams.get('refresh') === 'true'
  const now = Date.now()

  if (!forceRefresh && cache.data && now - cache.fetchedAt < TTL_MS) {
    return Response.json({ news: cache.data, fetchedAt: new Date(cache.fetchedAt).toISOString(), cached: true })
  }

  if (!FINNHUB_KEY) {
    return Response.json({ news: [], error: 'FINNHUB_API_KEY not configured', cached: false })
  }

  try {
    const res  = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`)
    if (!res.ok) throw new Error(`Finnhub news ${res.status}`)
    const json = await res.json()
    const news = filterNews(json)
    cache = { data: news, fetchedAt: now }
    return Response.json({ news, fetchedAt: new Date(now).toISOString(), cached: false })
  } catch (err) {
    console.error('[news] Finnhub fetch failed:', err.message)
    if (cache.data) {
      return Response.json({ news: cache.data, fetchedAt: new Date(cache.fetchedAt).toISOString(), cached: true, stale: true, error: err.message })
    }
    return Response.json({ news: [], error: err.message, cached: false })
  }
}
