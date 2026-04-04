import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const INSTRUMENTS = [
  {
    key: 'nq',
    ticker: 'NQ=F',
    label: 'NQ (E-mini Nasdaq)',
    // ETF proxies for Polygon news — free tier doesn't have futures tickers
    newsTickers: ['QQQ', 'SPY', 'AAPL', 'NVDA'],
  },
  {
    key: 'cl',
    ticker: 'CL=F',
    label: 'CL (Crude Oil)',
    newsTickers: ['USO', 'XLE'],
  },
  {
    key: 'gc',
    ticker: 'GC=F',
    label: 'GC (Gold)',
    newsTickers: ['GLD', 'IAU'],
  },
]

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

// Sanity ranges — reject bars clearly outside these (bad data / wrong contract)
const VALID_RANGES = {
  'NQ=F': { min: 10000, max: 35000 },
  'CL=F': { min: 20,    max: 200   },
  'GC=F': { min: 800,   max: 5000  },
}

async function fetchOHLCV(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=10d&interval=1d&includePrePost=false`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status} for ${ticker}`)

  const json = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) throw new Error(`No chart result for ${ticker}`)

  const { timestamp, indicators } = result
  const { open, high, low, close, volume } = indicators.quote[0]
  const range = VALID_RANGES[ticker]

  const bars = timestamp
    .map((t, i) => ({ time: t, open: open[i], high: high[i], low: low[i], close: close[i], volume: volume[i] }))
    .filter(b => b.open > 0 && b.high > 0 && b.low > 0 && b.close > 0)
    .filter(b => b.close >= range.min && b.close <= range.max)
    .sort((a, b) => a.time - b.time)

  if (!bars.length) throw new Error(`No valid bars in range for ${ticker} (check contract)`)

  // Drop bars from today (may be incomplete) — compare date in ET
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD
  const prev = bars.filter(b => {
    const d = new Date(b.time * 1000).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    return d < todayET
  })

  const bar = prev.at(-1) ?? bars.at(-1)
  console.log(`[briefing] ${ticker} prev session: O${bar.open} H${bar.high} L${bar.low} C${bar.close}`)
  return bar
}

async function fetchHourlyCandles(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3d&interval=1h&includePrePost=false`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const json = await res.json()
  const result = json.chart?.result?.[0]
  if (!result) return []

  const { open, high, low, close } = result.indicators.quote[0]
  const range = VALID_RANGES[ticker]

  return result.timestamp
    .map((t, i) => ({ time: t, open: open[i], high: high[i], low: low[i], close: close[i] }))
    .filter(b => b.open > 0 && b.close > 0 && b.close >= range.min && b.close <= range.max)
    .sort((a, b) => a.time - b.time)
}

async function fetchNews(newsTickers) {
  const apiKey = process.env.POLYGON_API_KEY
  if (!apiKey) return []

  // yesterday in YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const headlines = []

  for (const t of newsTickers) {
    try {
      const url = `https://api.polygon.io/v2/reference/news?ticker=${t}&limit=3&published_utc.gte=${yesterday}&order=desc&apiKey=${apiKey}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.results?.length) {
        for (const article of json.results) {
          headlines.push(article.title)
        }
      }
    } catch {
      // silently skip — news is supplementary
    }
    if (headlines.length >= 5) break
  }

  // deduplicate
  return [...new Set(headlines)].slice(0, 5)
}

async function generateBriefing(label, ohlcv, levels, headlines) {
  const newsBlock = headlines.length
    ? `\nRecent headlines:\n${headlines.map(h => `- ${h}`).join('\n')}`
    : ''

  const { text } = await generateText({
    model: 'anthropic/claude-haiku-4-5-20251001',
    prompt: `Write a 2-3 sentence pre-market briefing for ${label}. Plain text only — no markdown, no asterisks, no headers, no labels.

Previous session: Open ${ohlcv.open?.toFixed(2)} High ${ohlcv.high?.toFixed(2)} Low ${ohlcv.low?.toFixed(2)} Close ${ohlcv.close?.toFixed(2)}
Pivot ${levels.pivot.toFixed(2)} | R1 ${levels.r1.toFixed(2)} | R2 ${levels.r2.toFixed(2)} | S1 ${levels.s1.toFixed(2)} | S2 ${levels.s2.toFixed(2)}${newsBlock}

Cover: bias (close above/below pivot), key level to watch, what invalidates it. If any headlines are directly relevant to price action, factor them in briefly. Short sentences. No formatting.`,
    maxTokens: 175,
  })

  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/^#+/gm, '')
    .trim()
}

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const result = {}

    for (const inst of INSTRUMENTS) {
      const [ohlcv, candles, headlines] = await Promise.all([
        fetchOHLCV(inst.ticker),
        fetchHourlyCandles(inst.ticker),
        fetchNews(inst.newsTickers),
      ])
      const levels = calcLevels(ohlcv)
      const briefingText = await generateBriefing(inst.label, ohlcv, levels, headlines)
      result[inst.key] = { ohlcv, levels, candles, briefing: briefingText, headlines }
    }

    const { error } = await supabase
      .from('daily_briefings')
      .upsert({ date: today, ...result, generated_at: new Date().toISOString() }, { onConflict: 'date' })

    if (error) throw error

    return Response.json({ success: true, date: today })
  } catch (err) {
    console.error('Briefing generation error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
