import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const POLY = process.env.POLYGON_API_KEY
const FINN = process.env.NEXT_PUBLIC_FINNHUB_API_KEY

const INSTRUMENTS = [
  { key: 'nq', proxy: 'I:NDX',    label: 'NQ', full: 'E-mini Nasdaq 100', chartProxy: '^NDX',  newsTickers: ['QQQ', 'SPY', 'AAPL', 'NVDA', 'MSFT'] },
  { key: 'cl', proxy: 'X:BCOUSD', label: 'CL', full: 'Crude Oil',          chartProxy: 'BZ=F',  newsTickers: ['USO', 'XLE']                         },
  { key: 'gc', proxy: 'X:XAUUSD', label: 'GC', full: 'Gold',               chartProxy: 'GC=F',  newsTickers: ['GLD', 'GDX']                         },
]

const VALID_RANGES = {
  'I:NDX':    { min: 10000, max: 30000 },
  'X:BCOUSD': { min: 20,    max: 200   },
  'X:XAUUSD': { min: 1000,  max: 6000  },
}

// ── data fetchers ─────────────────────────────────────────────────────────────

async function fetchPrevOHLCV(ticker) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${POLY}`
  const res = await fetch(url)
  const json = await res.json()
  if (!json.results?.length) throw new Error(`No Polygon prev data for ${ticker} — status: ${json.status}, detail: ${json.error ?? json.message ?? 'unknown'}`)
  const b = json.results[0]
  const range = VALID_RANGES[ticker]
  if (range && (b.c < range.min || b.c > range.max)) {
    throw new Error(`${ticker} close ${b.c} outside expected range ${range.min}–${range.max}`)
  }
  return { open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v, timestamp: b.t }
}

// Hourly candles — try Polygon first, fall back to Yahoo Finance
async function fetchIntradayCandles(polygonTicker, yahooTicker) {
  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 4 * 86_400_000).toISOString().split('T')[0]

  try {
    const url  = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(polygonTicker)}/range/1/hour/${from}/${to}?adjusted=true&sort=asc&limit=150&apiKey=${POLY}`
    const json = await (await fetch(url)).json()
    if (json.results?.length >= 10) {
      return json.results.map(b => ({ time: Math.floor(b.t / 1000), open: b.o, high: b.h, low: b.l, close: b.c }))
    }
  } catch { /* fall through */ }

  // Yahoo Finance fallback
  try {
    const url  = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooTicker}?range=4d&interval=1h&includePrePost=false`
    const json = await (await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json()
    const result = json.chart?.result?.[0]
    if (!result) return []
    const { open, high, low, close } = result.indicators.quote[0]
    return result.timestamp
      .map((t, i) => ({ time: t, open: open[i], high: high[i], low: low[i], close: close[i] }))
      .filter(b => b.open > 0 && b.close > 0)
      .sort((a, b) => a.time - b.time)
  } catch { return [] }
}

const MACRO_INCLUDE = [
  'fed','fomc','powell','inflation','cpi','ppi','gdp','jobs','unemployment',
  'tariff','trade war','interest rate','yield','treasury','recession','opec',
  'crude','oil price','geopolit','china','war','sanction','rate cut','rate hike',
  'monetary','payroll','non-farm','gold price','commodit','debt','deficit',
  'economic data','fiscal','labor market',
]
const NOISE_EXCLUDE = [
  'should you buy','millionaire','best stocks','is it too late','screaming buy',
  'must-buy','beginner','how to invest','10 stocks','5 stocks','dividend guide',
]

async function fetchNews(tickers) {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
  const seen = new Map()

  for (const t of tickers) {
    try {
      const url  = `https://api.polygon.io/v2/reference/news?ticker=${t}&limit=10&published_utc.gte=${yesterday}&order=desc&apiKey=${POLY}`
      const json = await (await fetch(url)).json()
      for (const a of json.results ?? []) {
        if (seen.has(a.title)) continue
        const low = a.title?.toLowerCase() ?? ''
        if (NOISE_EXCLUDE.some(k => low.includes(k))) continue
        if (MACRO_INCLUDE.some(k => low.includes(k))) {
          seen.set(a.title, {
            title:  a.title,
            source: a.publisher?.name ?? '',
            time:   a.published_utc,
          })
        }
      }
    } catch { /* skip on error */ }
    if (seen.size >= 6) break
  }
  return [...seen.values()].slice(0, 6)
}

async function fetchCalendar() {
  if (!FINN) return []
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
  try {
    const url  = `https://finnhub.io/api/v1/calendar/economic?from=${today}&to=${tomorrow}&token=${FINN}`
    const json = await (await fetch(url)).json()
    return (json.economicCalendar?.economicData ?? [])
      .filter(e => e.impact === 'high' && e.country === 'US')
      .map(e => ({
        time:     e.time,
        event:    e.event,
        actual:   e.actual  ?? null,
        estimate: e.estimate ?? null,
        prev:     e.prev    ?? null,
        unit:     e.unit    ?? '',
      }))
  } catch { return [] }
}

// ── calculations ──────────────────────────────────────────────────────────────

function calcLevels({ high, low, close }) {
  const pivot = (high + low + close) / 3
  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + (high - low),
    s1: 2 * pivot - high,
    s2: pivot - (high - low),
  }
}

function calcBias(price, levels) {
  const all = [levels.s2, levels.s1, levels.pivot, levels.r1, levels.r2]
  const above = all.filter(l => price > l).length
  const score = above / all.length
  if (score > 0.6) return { label: 'BULLISH', pct: Math.round(score * 100) }
  if (score < 0.4) return { label: 'BEARISH', pct: Math.round((1 - score) * 100) }
  return { label: 'NEUTRAL', pct: 50 }
}

// ── llm ───────────────────────────────────────────────────────────────────────

async function generateContent(instruments, allNews, calendar) {
  const calText = calendar.length
    ? calendar.map(e => {
        const t = new Date(e.time).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
        const actual = e.actual != null ? ` actual=${e.actual}${e.unit}` : ''
        return `${t} ET — ${e.event}: est ${e.estimate}${e.unit} prev ${e.prev}${e.unit}${actual}`
      }).join('\n')
    : 'No high-impact US events today or tomorrow.'

  const newsText = allNews.length
    ? allNews.map(n => `- ${n.title}`).join('\n')
    : 'No macro headlines.'

  const instText = instruments.map(({ label, ohlcv, levels, bias }) =>
    `${label} (via proxy): O${ohlcv.open} H${ohlcv.high} L${ohlcv.low} C${ohlcv.close} | PP ${levels.pivot.toFixed(2)} R1 ${levels.r1.toFixed(2)} R2 ${levels.r2.toFixed(2)} S1 ${levels.s1.toFixed(2)} S2 ${levels.s2.toFixed(2)} | ${bias.label} ${bias.pct}%`
  ).join('\n')

  const prompt = `You are a blunt, data-driven futures trading analyst. No fluff. Every sentence references specific price levels or macro events. Plain text only — no markdown, no asterisks, no headers.

INSTRUMENT DATA (previous session):
${instText}

HIGH-IMPACT ECONOMIC CALENDAR:
${calText}

MACRO HEADLINES:
${newsText}

Return ONLY a valid JSON object — no markdown fences, no extra text:
{
  "riskSentiment": "RISK_ON" | "RISK_OFF" | "NEUTRAL",
  "riskReason": "one direct sentence explaining the dominant risk factor",
  "macroContext": "3-4 sentences. Cover overnight macro news, Fed stance, geopolitical or energy factors. Reference specific events.",
  "nq": "2-3 sentences. Reference proxy levels, macro context relevance, what price must do to confirm bias. No generic statements.",
  "cl": "2-3 sentences. Reference proxy levels, energy/OPEC context, what confirms or invalidates the move.",
  "gc": "2-3 sentences. Reference proxy levels, safe-haven demand, dollar strength or weakness."
}`

  const { text } = await generateText({
    model: 'anthropic/claude-haiku-4-5-20251001',
    prompt,
    maxTokens: 700,
  })

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fallback if JSON parsing fails
    return {
      riskSentiment: 'NEUTRAL',
      riskReason: 'Unable to determine — check logs.',
      macroContext: cleaned,
      nq: '', cl: '', gc: '',
    }
  }
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Fetch all news upfront across all tickers
    const allNewsTickers = INSTRUMENTS.flatMap(i => i.newsTickers)
    const [calendar, allNews] = await Promise.all([
      fetchCalendar(),
      fetchNews(allNewsTickers),
    ])

    // Fetch per-instrument data in parallel
    const instData = await Promise.all(
      INSTRUMENTS.map(async inst => {
        const [ohlcv, candles] = await Promise.all([
          fetchPrevOHLCV(inst.proxy),
          fetchIntradayCandles(inst.proxy, inst.chartProxy),
        ])
        const levels = calcLevels(ohlcv)
        const bias   = calcBias(ohlcv.close, levels)
        return { ...inst, ohlcv, candles, levels, bias }
      })
    )

    // Single LLM call for all content
    const llm = await generateContent(instData, allNews, calendar)

    // Assemble result
    const result = {}
    for (const inst of instData) {
      result[inst.key] = {
        ohlcv:    inst.ohlcv,
        levels:   inst.levels,
        bias:     inst.bias,
        candles:  inst.candles,
        briefing: llm[inst.key] ?? '',
        news:     allNews,
      }
    }

    const meta = {
      riskSentiment: llm.riskSentiment,
      riskReason:    llm.riskReason,
      macroContext:  llm.macroContext,
      calendar,
    }

    const { error } = await supabase
      .from('daily_briefings')
      .upsert(
        { date: today, ...result, meta, generated_at: new Date().toISOString() },
        { onConflict: 'date' }
      )

    if (error) throw error

    return Response.json({ success: true, date: today })
  } catch (err) {
    console.error('[briefing/generate]', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
