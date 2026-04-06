/**
 * GET /api/market/brief
 * AI Market Brief with full multi-instrument context, session levels,
 * bullish/bearish probability and scenario analysis.
 * Cached 1 hour.
 */

import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

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

async function fetchMarketContext(base) {
  const fetchJson = async (url) => {
    const res = await fetch(url)
    const text = await res.text()
    try {
      const json = JSON.parse(text)
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      return json
    } catch (err) {
      if (!res.ok) throw err


      throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 120)}`)
    }
  }

  const [d1d, d1h] = await Promise.all([
    fetchJson(`${base}/api/market-data?schema=1d`),
    fetchJson(`${base}/api/market-data?schema=1h`),
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

function buildPrompt(ctx, etDate, etTime, newsHeadlines) {
  const lines = []
  for (const [sym, d] of Object.entries(ctx)) {
    if (d.price === 'N/A') continue
    const pp = d.pivots
    lines.push(`${sym}: ${d.price} (${d.changePct >= 0 ? '+' : ''}${d.changePct}%)`)
    if (pp) lines.push(`  Classic Pivots — PP:${pp.pivot} R1:${pp.r1} R2:${pp.r2} S1:${pp.s1} S2:${pp.s2}`)
    if (d.sessions.londonH) lines.push(`  London session (ICT killzone 2-5am ET) — H:${d.sessions.londonH.toFixed(2)} L:${d.sessions.londonL.toFixed(2)}`)
    if (d.sessions.overnightH) lines.push(`  Overnight/Asia range — H:${d.sessions.overnightH.toFixed(2)} L:${d.sessions.overnightL.toFixed(2)}`)
    lines.push(`  Prev day PDH:${d.prevHigh} PDL:${d.prevLow}`)
  }

  const newsSection = newsHeadlines?.length
    ? `\nMACROECONOMIC HEADLINES:\n${newsHeadlines.slice(0, 5).map(h => `- ${h}`).join('\n')}`
    : ''

  return `You are an elite ICT-trained futures trader. Analyze the following data for ${etDate} at ${etTime} ET.

LIVE MARKET DATA:
${lines.join('\n')}${newsSection}

ICT FRAMEWORK TO APPLY:
- Identify if price is trading above or below the previous day high/low (PDH/PDL) — these are key liquidity levels
- London killzone highs/lows are liquidity pools; price often sweeps them before reversing
- Look for fair value gaps (FVG): if price gapped between sessions, that imbalance attracts price
- Premium/discount: price above PP or PDH = premium (look for sells); below PP or PDL = discount (look for buys)
- NY open (9:30am ET) often creates the actual trend direction by sweeping London liquidity first
- Macro news (CPI, FOMC, jobs data) acts as a catalyst for liquidity sweeps

Your response MUST follow this EXACT format (no extra text, no markdown):

BULL_PCT: [0-100]
BEAR_PCT: [0-100]
BULL_CASE: [1-2 sentences — which liquidity level gets swept/broken, where price targets next, specific levels only]
BEAR_CASE: [1-2 sentences — which level fails or gets swept, where price drops to, specific levels only]
SUMMARY: [2-3 sentences: ICT bias (premium/discount), key liquidity above and below, macro catalyst if any, what the NY open setup looks like]
WATCH: [3-5 exact levels/events, e.g. "NQ London high 19842 sweep, NQ PDL 19540 target, FOMC minutes 2pm, GC PDH 3120 resistance"]

Rules:
- DO NOT make up price levels — use only the numbers provided above
- Do NOT use **, ##, or any markdown formatting
- Reference PDH/PDL and London H/L as ICT liquidity levels explicitly
- If macro news is present, factor it into the bias and WATCH list
- Be direct and concise, like a Bloomberg terminal analyst`
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

    const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
    const [ctx, newsRes] = await Promise.all([
      fetchMarketContext(base),
      fetch(`${base}/api/news`).then(r => r.json()).catch(() => ({ news: [] })),
    ])
    const newsHeadlines = (newsRes.news ?? []).map(n => n.headline)
    const prompt = buildPrompt(ctx, etDate, etTime, newsHeadlines)

    const anthropic = createAnthropic({
      baseURL: 'https://ai-gateway.vercel.sh/v1',
      apiKey: process.env.AI_GATEWAY_API_KEY,
    })
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
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
