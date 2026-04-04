import { createClient } from '@supabase/supabase-js'
import { generateText } from 'ai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const INSTRUMENTS = [
  { key: 'nq', ticker: 'NQ=F', label: 'NQ (E-mini Nasdaq)' },
  { key: 'cl', ticker: 'CL=F', label: 'CL (Crude Oil)' },
  { key: 'gc', ticker: 'GC=F', label: 'GC (Gold)' },
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

async function fetchOHLCV(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const json = await res.json()
  const quotes = json.chart?.result?.[0]
  if (!quotes) throw new Error(`No data for ${ticker}`)

  const timestamps = quotes.timestamp
  const { open, high, low, close, volume } = quotes.indicators.quote[0]

  const bars = timestamps
    .map((t, i) => ({ time: t, open: open[i], high: high[i], low: low[i], close: close[i], volume: volume[i] }))
    .filter(b => b.open && b.high && b.low && b.close)

  // Second-to-last = previous completed session
  return bars[bars.length - 2] ?? bars[bars.length - 1]
}

async function fetchHourlyCandles(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=3d&interval=1h`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  const json = await res.json()
  const quotes = json.chart?.result?.[0]
  if (!quotes) return []

  const { open, high, low, close } = quotes.indicators.quote[0]
  return quotes.timestamp
    .map((t, i) => ({ time: t, open: open[i], high: high[i], low: low[i], close: close[i] }))
    .filter(b => b.open && b.high && b.low && b.close)
}

async function generateBriefing(label, ohlcv, levels) {
  const { text } = await generateText({
    model: 'anthropic/claude-haiku-4-5-20251001',
    prompt: `Write a 2-3 sentence pre-market briefing for ${label}. Plain text only — no markdown, no asterisks, no headers, no labels.

Previous session: Open ${ohlcv.open?.toFixed(2)} High ${ohlcv.high?.toFixed(2)} Low ${ohlcv.low?.toFixed(2)} Close ${ohlcv.close?.toFixed(2)}
Pivot ${levels.pivot.toFixed(2)} | R1 ${levels.r1.toFixed(2)} | R2 ${levels.r2.toFixed(2)} | S1 ${levels.s1.toFixed(2)} | S2 ${levels.s2.toFixed(2)}

Cover: bias (close above/below pivot), key level to watch, what invalidates it. Short sentences. No formatting whatsoever.`,
    maxTokens: 150,
  })
  // strip any markdown that slips through
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
      const ohlcv = await fetchOHLCV(inst.ticker)
      const levels = calcLevels(ohlcv)
      const candles = await fetchHourlyCandles(inst.ticker)
      const briefingText = await generateBriefing(inst.label, ohlcv, levels)
      result[inst.key] = { ohlcv, levels, candles, briefing: briefingText }
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
