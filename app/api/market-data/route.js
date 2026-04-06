/**
 * GET /api/market-data
 * Returns OHLCV bars for NQ.c.0, CL.c.0, GC.c.0 via Databento.
 * ?schema=1h (default) | 1d
 * ?refresh=true
 */

import https from 'https'

const DATABENTO_KEY = process.env.DATABENTO_API_KEY
const BASE_URL      = 'https://hist.databento.com/v0'
const SYMBOLS       = ['NQ.c.0', 'CL.c.0', 'GC.c.0']
const DATASET       = 'GLBX.MDP3'
const PRICE_SCALE   = 1e-9

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

function httpsPost(body) {
  return new Promise((resolve, reject) => {
    const buf = Buffer.from(body, 'utf8')
    const encoded = Buffer.from(`${DATABENTO_KEY}:`).toString('base64')
    const req = https.request({
      hostname: 'hist.databento.com',
      path:     '/v0/timeseries.get_range',
      method:   'POST',
      headers: {
        'Authorization':  `Basic ${encoded}`,
        'Content-Type':   'application/json',
        'Content-Length': buf.length,
      },
    }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.write(buf)
    req.end()
  })
}

async function fetchDatabento(schema) {
  const start = schema === '1d' ? daysAgo(7) : daysAgo(4)

  const payload = JSON.stringify({
    dataset:  DATASET,
    symbols:  SYMBOLS,
    schema:   `ohlcv-${schema}`,
    start,
    stype_in: 'continuous',
    stype_out: 'continuous',
    encoding: 'json',
  })

  console.log('[market-data] Databento request payload:', payload)

  const { status, text } = await httpsPost(payload)

  if (status !== 200) {
    throw new Error(`Databento ${status}: ${text.slice(0, 300)}`)
  }

  const lines = text.trim().split('\n').filter(Boolean)
  const bySymbol = {}

  for (const line of lines) {
    try {
      const r = JSON.parse(line)
      if (r.open == null) continue
      const sym = r.symbol ?? r.hd?.symbol ?? r.raw_symbol ?? r.s
      if (!sym) continue
      if (!bySymbol[sym]) bySymbol[sym] = []
      bySymbol[sym].push({
        symbol: sym,
        time:   r.ts_event ? Math.floor(Number(r.ts_event) / 1_000_000_000) : null,
        open:   Number(r.open)  * PRICE_SCALE,
        high:   Number(r.high)  * PRICE_SCALE,
        low:    Number(r.low)   * PRICE_SCALE,
        close:  Number(r.close) * PRICE_SCALE,
        volume: Number(r.volume),
      })
    } catch { /* skip malformed lines */ }
  }

  for (const sym of Object.keys(bySymbol)) {
    bySymbol[sym].sort((a, b) => a.time - b.time)
  }

  const totalBars = Object.values(bySymbol).flat().length
  console.log(`[market-data] Databento ${schema}: ${totalBars} bars for [${Object.keys(bySymbol).join(', ')}]`)
  if (!totalBars) throw new Error('Databento returned 0 records')

  return bySymbol
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const schema       = searchParams.get('schema') === '1d' ? '1d' : '1h'
  const forceRefresh = searchParams.get('refresh') === 'true'
  const now          = Date.now()
  const cached       = cache[schema]

  if (!DATABENTO_KEY) {
    return Response.json({ error: 'DATABENTO_API_KEY not configured' }, { status: 500 })
  }

  if (!forceRefresh && cached.data && now - cached.fetchedAt < TTL[schema]) {
    return Response.json({ data: cached.data, schema, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true })
  }

  try {
    const data = await fetchDatabento(schema)
    cache[schema] = { data, fetchedAt: now }
    return Response.json({ data, schema, fetchedAt: new Date(now).toISOString(), cached: false })
  } catch (err) {
    console.error('[market-data] fetch failed:', err.message)
    if (cached.data) {
      return Response.json({ data: cached.data, schema, fetchedAt: new Date(cached.fetchedAt).toISOString(), cached: true, stale: true, error: err.message })
    }
    return Response.json({ error: err.message }, { status: 502 })
  }
}
