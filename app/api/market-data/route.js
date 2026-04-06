/**
 * GET /api/market-data
 * ?schema=1h (default) | 1d | debug
 *
 * Pass ?schema=debug to get the raw Databento response + request URL
 * directly in the browser for diagnosis.
 */

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

const DATABENTO_KEY = process.env.DATABENTO_API_KEY
const SYMBOLS       = ['NQ.c.0', 'CL.c.0', 'GC.c.0']
const DATASET       = 'GLBX.MDP3'
const PRICE_SCALE   = 1e-9

const cache = {
  '1h': { data: null, fetchedAt: 0 },
  '1d': { data: null, fetchedAt: 0 },
}
const TTL = { '1h': 5 * 60 * 1000, '1d': 60 * 60 * 1000 }

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
}

function buildDatabentoUrl(schema, symbol) {
  const start = schema === '1d' ? daysAgo(14) : daysAgo(10)
  const params = new URLSearchParams()
  params.set('dataset',   DATASET)
  params.set('schema',    `ohlcv-${schema}`)
  params.set('start',     start)
  params.set('stype_in',  'continuous')
  params.set('stype_out', 'instrument_id')
  params.set('encoding',  'json')
  params.set('symbols', symbol)
  return `https://hist.databento.com/v0/timeseries.get_range?${params.toString()}`
}

async function fetchDatabento(schema) {
  console.log('[market-data] key set:', !!DATABENTO_KEY)
  const bySymbol = {}

  for (const symbol of SYMBOLS) {
    const url = buildDatabentoUrl(schema, symbol)
    console.log('[market-data] url:', url)

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Authorization': `Basic ${btoa(`${DATABENTO_KEY}:`)}` },
    })

    console.log('[market-data] status:', symbol, res.status)
    const text = await res.text()

    if (!res.ok) throw new Error(`Databento ${res.status} for ${symbol}: ${text.slice(0, 300)}`)

    const lines = text.trim().split('\n').filter(Boolean)
    bySymbol[symbol] = []

    for (const line of lines) {
      try {
        const r = JSON.parse(line)
        if (r.open == null) continue
        const tsEventNs = r.ts_event ?? r.hd?.ts_event
        bySymbol[symbol].push({
          symbol,
          time:   tsEventNs ? Math.floor(Number(tsEventNs) / 1_000_000_000) : null,
          open:   Number(r.open)  * PRICE_SCALE,
          high:   Number(r.high)  * PRICE_SCALE,
          low:    Number(r.low)   * PRICE_SCALE,
          close:  Number(r.close) * PRICE_SCALE,
          volume: Number(r.volume),
        })
      } catch { /* skip malformed lines */ }
    }
  }

  for (const sym of Object.keys(bySymbol)) {
    bySymbol[sym].sort((a, b) => a.time - b.time)
  }

  const totalBars = Object.values(bySymbol).flat().length
  console.log(`[market-data] ${schema}: ${totalBars} bars`)
  if (!totalBars) throw new Error('Databento returned 0 records')

  return bySymbol
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const schema       = searchParams.get('schema') === '1d' ? '1d' : '1h'
  const forceRefresh = searchParams.get('refresh') === 'true'
  const isDebug      = searchParams.get('schema') === 'debug'

  if (!DATABENTO_KEY) {
    return Response.json({ error: 'DATABENTO_API_KEY not configured' }, { status: 500 })
  }

  // Debug mode: hit Databento with hardcoded values, return raw response to browser
  if (isDebug) {
    const symbol = SYMBOLS[0]
    const url  = buildDatabentoUrl('1d', symbol)
    const auth = `Basic ${btoa(`${DATABENTO_KEY}:`)}`
    try {
      const res  = await fetch(url, { method: 'GET', headers: { Authorization: auth } })
      const raw  = await res.text()
      return Response.json({ requestUrl: url, symbol, status: res.status, ok: res.ok, raw: raw.slice(0, 2000), keyPrefix: DATABENTO_KEY.slice(0, 6) })
    } catch (err) {
      return Response.json({ requestUrl: url, routeError: err.message })
    }
  }

  const now    = Date.now()
  const cached = cache[schema]

  if (!forceRefresh && cached.data && now - cached.fetchedAt < TTL[schema]) {
    return Response.json({ data: cached.data, schema, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true })
  }

  try {
    const data = await fetchDatabento(schema)
    cache[schema] = { data, fetchedAt: now }
    return Response.json({ data, schema, fetchedAt: new Date(now).toISOString(), cached: false })
  } catch (err) {
    console.error('[market-data] failed:', err.message)
    if (cached.data) {
      return Response.json({ data: cached.data, schema, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true, stale: true, error: err.message })
    }
    return Response.json({ error: err.message }, { status: 502 })
  }
}
