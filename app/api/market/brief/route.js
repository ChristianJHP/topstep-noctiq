/**
 * GET /api/market/brief
 * AI Market Brief with full multi-instrument context, session levels,
 * bullish/bearish probability and scenario analysis.
 * Cached 1 hour.
 */

import { generateText } from 'ai'

let briefCache = { content: null, generatedAt: null, expiresAt: null, raw: null }
const CACHE_DURATION_MS = 60 * 60 * 1000

const INSTRUMENTS = [
  { key: 'NQ.c.0', label: 'NQ', name: 'E-mini Nasdaq 100' },
  { key: 'CL.c.0', label: 'CL', name: 'Crude Oil'         },
  { key: 'GC.c.0', label: 'GC', name: 'Gold'              },
]

// ── data helpers ──────────────────────────────────────────────────────────────

function pivots(bar) {
  if (!bar) return null
  const h = Number(bar.high), l = Number(bar.low), c = Number(bar.close)
  const p = (h + l + c) / 3
  return { pivot: +p.toFixed(2), r1: +(2*p-l).toFixed(2), r2: +(p+(h-l)).toFixed(2), s1: +(2*p-h).toFixed(2), s2: +(p-(h-l)).toFixed(2) }
}

// Get ET hour from unix timestamp (seconds)
function etHour(ts) {
  return parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }).format(new Date(Number(ts) * 1000)))
}

function sessionLevels(bars1h) {
  // Split 1h bars into sessions based on ET time
  const london = [], ny = [], overnight = []
  for (const b of (bars1h ?? [])) {
    const h = etHour(b.time)
    if (h >= 3  && h < 9)  london.push(b)      // London: 3am–9am ET
    if (h >= 9  && h < 16) ny.push(b)           // NY RTH: 9am–4pm ET
    if (h >= 18 || h < 3)  overnight.push(b)    // Globex/overnight
  }
  const hi = arr => arr.length ? Math.max(...arr.map(b => Number(b.high)))  : null
  const lo = arr => arr.length ? Math.min(...arr.map(b => Number(b.low)))   : null
  return {
    londonH:    hi(london),    londonL:    lo(london),
    nyH:        hi(ny),        nyL:        lo(ny),
    overnightH: hi(overnight), overnightL: lo(overnight),
  }
}

async function fetchMarketContext() {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const [d1d, d1h] = await Promise.all([
    fetch(`${base}/api/market-data?schema=1d`).then(r => r.json()),
    fetch(`${base}/api/market-data?schema=1h`).then(r => r.json()),
  ])

  const context = {}
  for (const inst of INSTRUMENTS) {
    const daily   = d1d.data?.[inst.key] ?? []
    const hourly  = d1h.data?.[inst.key] ?? []
    const prevBar = daily.length >= 2 ? daily[daily.length - 2] : null
    const todBar  = daily.length >= 1 ? daily[daily.length - 1] : null
    const pp      = pivots(prevBar)
    const sess    = sessionLevels(hourly)
    const curPrice = todBar ? Number(todBar.close) : null
    const prevClose = prevBar ? Number(prevBar.close) : null
    const change  = curPrice && prevClose ? curPrice - prevClose : null
    const changePct = change && prevClose ? ((change/prevClose)*100).toFixed(2) : null

    context[inst.label] = {
      price:    curPrice?.toFixed(2)    ?? 'N/A',
      change:   change?.toFixed(2)      ?? 'N/A',
      changePct: changePct              ?? 'N/A',
      prevHigh: prevBar?.high?.toFixed ? Number(prevBar.high).toFixed(2) : 'N/A',
      prevLow:  prevBar?.low?.toFixed  ? Number(prevBar.low).toFixed(2)  : 'N/A',
      pivots:   pp,
      sessions: sess,
    }
  }
  return context
}

function buildPrompt(ctx, etDate, etTime) {
  const lines = []
  for (const [sym, d] of Object.entries(ctx)) {
    if (d.price === 'N/A') continue
    const pp = d.pivots
    lines.push(`${sym}: ${d.price} (${d.changePct >= 0 ? '+' : ''}${d.changePct}%)`)
    if (pp) lines.push(`  Pivot levels — PP:${pp.pivot} R1:${pp.r1} R2:${pp.r2} S1:${pp.s1} S2:${pp.s2}`)
    if (d.sessions.londonH) lines.push(`  London session — H:${d.sessions.londonH.toFixed(2)} L:${d.sessions.londonL.toFixed(2)}`)
    if (d.sessions.overnightH) lines.push(`  Overnight range — H:${d.sessions.overnightH.toFixed(2)} L:${d.sessions.overnightL.toFixed(2)}`)
    lines.push(`  Prev day — H:${d.prevHigh} L:${d.prevLow}`)
  }

  return `You are an elite futures trader and technical analyst. Analyze the following real-time market data for ${etDate} at ${etTime} ET and generate a structured pre-market / intraday briefing.

LIVE MARKET DATA:
${lines.join('\n')}

Your response MUST follow this EXACT format (no extra text, no markdown):

BULL_PCT: [0-100]
BEAR_PCT: [0-100]
BULL_CASE: [1-2 sentence bull scenario with specific price targets — which level to break and where price goes]
BEAR_CASE: [1-2 sentence bear scenario with specific price targets — which level to fail at and where price falls]
SUMMARY: [2-3 sentences: overall market bias, key driver, what to watch for. Be specific with levels. Reference London session high/low and pivot levels when relevant. No fluff.]
WATCH: [Comma-separated list of 3-5 exact price levels or events to monitor today, e.g. "NQ PP 18432, NQ R1 18654, CL OPEC headlines, GC 3050 support"]

Rules:
- Base probability on where price sits relative to pivots and session ranges
- If price is above London high and above PP → bullish lean
- If price rejected London high or below PP → bearish lean
- DO NOT make up price levels — use only the numbers provided
- Do NOT use **, ##, or any markdown formatting
- Be direct and professional, like a Bloomberg terminal analyst`
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  const now          = Date.now()
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  if (!forceRefresh && briefCache.content && briefCache.expiresAt && now < briefCache.expiresAt) {
    return Response.json({ brief: briefCache.content, raw: briefCache.raw, generatedAt: briefCache.generatedAt, cached: true })
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json({ brief: 'AI brief not configured.', error: 'API key missing' }, { status: 500 })
  }

  try {
    const etDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const etTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })

    const ctx    = await fetchMarketContext()
    const prompt = buildPrompt(ctx, etDate, etTime)

    const { text } = await generateText({
      model: 'openai/gpt-4o-mini',
      prompt,
      maxTokens: 400,
    })

    // Parse the structured response
    const parse = (key) => {
      const match = text.match(new RegExp(`${key}:\\s*(.+)`))
      return match?.[1]?.trim() ?? null
    }

    const raw = {
      bullPct:  parseInt(parse('BULL_PCT')) || 50,
      bearPct:  parseInt(parse('BEAR_PCT')) || 50,
      bullCase: parse('BULL_CASE'),
      bearCase: parse('BEAR_CASE'),
      summary:  parse('SUMMARY'),
      watch:    parse('WATCH'),
    }

    // Build clean display text
    const clean = [
      raw.summary,
      raw.bullCase ? `BULL: ${raw.bullCase}` : null,
      raw.bearCase ? `BEAR: ${raw.bearCase}` : null,
    ].filter(Boolean).join('\n').replace(/\*\*/g,'').replace(/##/g,'').trim()

    briefCache = { content: clean, raw, generatedAt: new Date().toISOString(), expiresAt: now + CACHE_DURATION_MS }

    return Response.json({ brief: clean, raw, generatedAt: briefCache.generatedAt, cached: false })

  } catch (error) {
    console.error('[MarketBrief] Error:', error)
    if (briefCache.content) {
      return Response.json({ brief: briefCache.content, raw: briefCache.raw, generatedAt: briefCache.generatedAt, cached: true, stale: true })
    }
    return Response.json({ brief: 'Brief temporarily unavailable.', error: error.message }, { status: 500 })
  }
}
