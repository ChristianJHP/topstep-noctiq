/**
 * GET /api/market-data
 *
 * Returns latest OHLCV bars for NQ.c.0, ES.c.0, CL.c.0, GC.c.0 via Databento REST API.
 * Schema: ohlcv-1h (intraday, cached 5 min) and ohlcv-1d (daily, cached 1 hr)
 * Query params:
 *   ?schema=1h  (default) | 1d
 *   ?refresh=true  (bypass cache)
 */

const DATABENTO_KEY = process.env.DATABENTO_API_KEY
const BASE_URL      = 'https://hist.databento.com/v0'
const SYMBOLS       = ['NQ.c.0', 'ES.c.0', 'CL.c.0', 'GC.c.0']
const DATASET       = 'GLBX.MDP3'

// Databento prices are fixed-point integers scaled by 1e-9
const PRICE_SCALE = 1e-9

// In-memory cache: { data, fetchedAt, schema }
const cache = {
  '1h': { data: null, fetchedAt: 0 },
  '1d': { data: null, fetchedAt: 0 },
}
const TTL = { '1h': 5 * 60 * 1000, '1d': 60 * 60 * 1000 }

function authHeader() {
  const encoded = Buffer.from(`${DATABENTO_KEY}:`).toString('base64')
  return { Authorization: `Basic ${encoded}` }
}

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0]
}

async function estimateCost(schema, start) {
  try {
    const res  = await fetch(`${BASE_URL}/metadata.get_cost`, {
      method:  'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset:  DATASET,
        symbols:  SYMBOLS,
        schema,
        start,
        stype_in: 'continuous',
      }),
    })
    const json = await res.json()
    console.log(`[market-data] Databento cost estimate for ${schema} since ${start}: $${json.cost ?? 'unknown'}`)
  } catch (e) {
    console.warn('[market-data] Cost estimate failed (non-fatal):', e.message)
  }
}

async function fetchFromDatabento(schema) {
  const start = schema === '1d' ? daysAgo(5) : daysAgo(3)

  // Log cost estimate before the pull
  await estimateCost(schema, start)

  const res = await fetch(`${BASE_URL}/timeseries.get_range`, {
    method:  'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataset:   DATASET,
      symbols:   SYMBOLS,
      schema:    `ohlcv-${schema}`,
      start,
      stype_in:  'continuous',
      encoding:  'json',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Databento ${res.status}: ${err}`)
  }

  const text    = await res.text()
  const lines   = text.trim().split('\n').filter(Boolean)
  const records = []

  for (const line of lines) {
    try {
      const r = JSON.parse(line)
      // Skip metadata/header lines that don't have OHLCV fields
      if (r.open == null) continue
      records.push({
        symbol:    r.symbol ?? r.instrument_id,
        time:      r.ts_event ? Math.floor(Number(r.ts_event) / 1_000_000_000) : null,
        open:      Number(r.open)  * PRICE_SCALE,
        high:      Number(r.high)  * PRICE_SCALE,
        low:       Number(r.low)   * PRICE_SCALE,
        close:     Number(r.close) * PRICE_SCALE,
        volume:    Number(r.volume),
      })
    } catch { /* skip malformed lines */ }
  }

  // Group by symbol, sort ascending by time
  const bySymbol = {}
  for (const r of records) {
    const sym = r.symbol ?? 'unknown'
    if (!bySymbol[sym]) bySymbol[sym] = []
    bySymbol[sym].push(r)
  }
  for (const sym of Object.keys(bySymbol)) {
    bySymbol[sym].sort((a, b) => a.time - b.time)
  }

  console.log(`[market-data] Databento ${schema}: fetched ${records.length} bars for ${Object.keys(bySymbol).join(', ')}`)
  return bySymbol
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const schema    = searchParams.get('schema') === '1d' ? '1d' : '1h'
  const forceRefresh = searchParams.get('refresh') === 'true'
  const now       = Date.now()
  const cached    = cache[schema]

  if (!DATABENTO_KEY) {
    return Response.json({ error: 'DATABENTO_API_KEY not configured' }, { status: 500 })
  }

  if (!forceRefresh && cached.data && now - cached.fetchedAt < TTL[schema]) {
    return Response.json({
      data:       cached.data,
      schema,
      fetchedAt:  new Date(cached.fetchedAt).toISOString(),
      cached:     true,
    })
  }

  try {
    const data = await fetchFromDatabento(schema)
    cache[schema] = { data, fetchedAt: now }
    return Response.json({ data, schema, fetchedAt: new Date(now).toISOString(), cached: false })
  } catch (err) {
    console.error('[market-data] Databento fetch failed:', err.message)
    // Return stale cache if available
    if (cached.data) {
      return Response.json({
        data:       cached.data,
        schema,
        fetchedAt:  new Date(cached.fetchedAt).toISOString(),
        cached:     true,
        stale:      true,
        error:      err.message,
      })
    }
    return Response.json({ error: err.message }, { status: 502 })
  }
}
