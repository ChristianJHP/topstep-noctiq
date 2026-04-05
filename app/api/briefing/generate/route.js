import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const POLY = process.env.POLYGON_API_KEY
const FINN = process.env.NEXT_PUBLIC_FINNHUB_API_KEY

const INSTRUMENTS = [
  { key: 'nq', symbol: 'I:NDX',    label: 'NQ', full: 'E-mini Nasdaq 100' },
  { key: 'cl', symbol: 'X:WTICOUSD', label: 'CL', full: 'Crude Oil'       },
  { key: 'gc', symbol: 'X:XAUUSD', label: 'GC', full: 'Gold'              },
]

const VALID_RANGES = {
  'I:NDX':      { min: 10000, max: 30000 },
  'X:WTICOUSD': { min: 20,    max: 200   },
  'X:XAUUSD':   { min: 1000,  max: 6000  },
}

// ── data fetchers ─────────────────────────────────────────────────────────────

async function fetchPrevOHLCV(symbol) {
  const url  = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/prev?adjusted=true&apiKey=${POLY}`
  const json = await (await fetch(url)).json()
  if (!json.results?.length) throw new Error(`Polygon no data for ${symbol}: ${json.error ?? json.message ?? json.status}`)
  const b     = json.results[0]
  const range = VALID_RANGES[symbol]
  if (range && (b.c < range.min || b.c > range.max)) throw new Error(`${symbol} close ${b.c} outside range ${range.min}–${range.max}`)
  console.log(`[briefing] ${symbol} prev: O${b.o} H${b.h} L${b.l} C${b.c}`)
  return { open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }
}

async function fetchIntradayCandles(symbol) {
  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 4 * 86_400_000).toISOString().split('T')[0]
  const url  = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/hour/${from}/${to}?adjusted=true&sort=asc&limit=150&apiKey=${POLY}`
  const json = await (await fetch(url)).json()
  if (!json.results?.length) return []
  return json.results.map(b => ({ time: Math.floor(b.t / 1000), open: b.o, high: b.h, low: b.l, close: b.c }))
}

// ── news (Finnhub general market news) ───────────────────────────────────────

const MACRO_INCLUDE = [
  'fed','fomc','powell','inflation','cpi','ppi','gdp','jobs','unemployment',
  'tariff','trade','interest rate','yield','treasury','recession','opec',
  'crude','oil','geopolit','china','war','sanction','rate cut','rate hike',
  'monetary','payroll','non-farm','gold','commodit','debt','deficit','fiscal',
]
const NOISE_EXCLUDE = [
  'should you buy','millionaire','best stocks','is it too late','screaming buy',
  'beginner','how to invest','10 stocks','5 stocks','dividend guide','etf guide',
]

async function fetchNews() {
  if (!FINN) return []
  try {
    const url  = `https://finnhub.io/api/v1/news?category=general&token=${FINN}`
    const json = await (await fetch(url)).json()
    const seen = new Map()
    for (const a of json ?? []) {
      if (seen.size >= 8) break
      const low = (a.headline ?? '').toLowerCase()
      if (NOISE_EXCLUDE.some(k => low.includes(k))) continue
      if (MACRO_INCLUDE.some(k => low.includes(k))) {
        seen.set(a.headline, {
          title:  a.headline,
          source: a.source ?? '',
          time:   a.datetime ? new Date(a.datetime * 1000).toISOString() : '',
        })
      }
    }
    return [...seen.values()].slice(0, 6)
  } catch { return [] }
}

// ── economic calendar (Finnhub) ───────────────────────────────────────────────

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
        actual:   e.actual   ?? null,
        estimate: e.estimate ?? null,
        prev:     e.prev     ?? null,
        unit:     e.unit     ?? '',
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
  const all   = [levels.s2, levels.s1, levels.pivot, levels.r1, levels.r2]
  const above = all.filter(l => price > l).length
  const score = above / all.length
  if (score > 0.6) return { label: 'BULLISH', pct: Math.round(score * 100) }
  if (score < 0.4) return { label: 'BEARISH', pct: Math.round((1 - score) * 100) }
  return { label: 'NEUTRAL', pct: 50 }
}

// ── llm ───────────────────────────────────────────────────────────────────────

async function generateContent(instruments, news, calendar) {
  const calText = calendar.length
    ? calendar.map(e => {
        const t      = new Date(e.time).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
        const actual = e.actual != null ? ` ACTUAL: ${e.actual}${e.unit}` : ''
        return `${t} ET — ${e.event}: est ${e.estimate}${e.unit} prev ${e.prev}${e.unit}${actual}`
      }).join('\n')
    : 'No high-impact US events today or tomorrow.'

  const newsText  = news.length ? news.map(n => `- ${n.title}`).join('\n') : 'No macro headlines.'
  const instText  = instruments.map(({ label, ohlcv, levels, bias }) =>
    `${label}: O${ohlcv.open} H${ohlcv.high} L${ohlcv.low} C${ohlcv.close} | PP ${levels.pivot.toFixed(2)} R1 ${levels.r1.toFixed(2)} R2 ${levels.r2.toFixed(2)} S1 ${levels.s1.toFixed(2)} S2 ${levels.s2.toFixed(2)} | ${bias.label} ${bias.pct}%`
  ).join('\n')

  const { text } = await generateText({
    model: 'anthropic/claude-haiku-4-5-20251001',
    prompt: `You are a blunt, data-driven futures trading analyst. No fluff. Only reference specific price levels or confirmed macro events from the data below. Plain text only — no markdown, no asterisks, no headers.

INSTRUMENT DATA (previous session, index/spot proxies):
${instText}

HIGH-IMPACT ECONOMIC CALENDAR:
${calText}

MACRO HEADLINES:
${newsText}

Return ONLY a valid JSON object — no markdown fences, no extra text:
{
  "riskSentiment": "RISK_ON" | "RISK_OFF" | "NEUTRAL",
  "riskReason": "one direct sentence citing specific data above",
  "macroContext": "3-4 sentences. Only cite confirmed headlines or calendar events above. No invented news.",
  "nq": "2-3 sentences on NDX levels, what broke or held, what confirms or invalidates.",
  "cl": "2-3 sentences on WTI levels, energy/OPEC context from headlines, key level to watch.",
  "gc": "2-3 sentences on gold levels, safe-haven or dollar context, what confirms the move."
}`,
    maxTokens: 700,
  })

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    return { riskSentiment: 'NEUTRAL', riskReason: 'Parse error — check logs.', macroContext: cleaned, nq: '', cl: '', gc: '' }
  }
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]

    const [calendar, news] = await Promise.all([fetchCalendar(), fetchNews()])

    const instData = await Promise.all(
      INSTRUMENTS.map(async inst => {
        const [ohlcv, candles] = await Promise.all([
          fetchPrevOHLCV(inst.symbol),
          fetchIntradayCandles(inst.symbol),
        ])
        const levels = calcLevels(ohlcv)
        const bias   = calcBias(ohlcv.close, levels)
        return { ...inst, ohlcv, candles, levels, bias }
      })
    )

    const llm    = await generateContent(instData, news, calendar)
    const result = {}
    for (const inst of instData) {
      result[inst.key] = { ohlcv: inst.ohlcv, levels: inst.levels, bias: inst.bias, candles: inst.candles, briefing: llm[inst.key] ?? '', news }
    }

    const meta = { riskSentiment: llm.riskSentiment, riskReason: llm.riskReason, macroContext: llm.macroContext, calendar }

    const { error } = await supabase
      .from('daily_briefings')
      .upsert({ date: today, ...result, meta, generated_at: new Date().toISOString() }, { onConflict: 'date' })

    if (error) throw error
    return Response.json({ success: true, date: today })
  } catch (err) {
    console.error('[briefing/generate]', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
