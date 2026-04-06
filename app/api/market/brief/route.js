/**
 * GET /api/market/brief
 * AI Market Brief with macro + ICT structure and actionable setups.
 * Cached 1 hour.
 */

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

function f2(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n.toFixed(2) : 'N/A'
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
      price:      curPrice?.toFixed(2)  ?? 'N/A',
      change:     change?.toFixed(2)    ?? 'N/A',
      changePct:  changePct             ?? 'N/A',
      prevHigh:   prevBar ? f2(prevBar.high) : 'N/A',
      prevLow:    prevBar ? f2(prevBar.low)  : 'N/A',
      pivots:     pp,
      sessions:   sess,
      rawPrice:   curPrice,
      rawPrevHigh: prevBar ? Number(prevBar.high) : null,
      rawPrevLow:  prevBar ? Number(prevBar.low) : null,
    }
  }
  return context
}

function computeMacroBias(ctx, newsHeadlines) {
  const text = (newsHeadlines ?? []).join(' | ').toLowerCase()
  const nq = ctx.NQ
  const cl = ctx.CL
  const gc = ctx.GC

  let score = 0
  const reasons = []

  const hasRiskOffHeadline = /(iran|middle east|war|missile|attack|geopolit|sanction|strait|opec cut|supply disruption)/.test(text)
  const hasInflationHeadline = /(inflation|cpi|ppi|wage|hot print|sticky inflation)/.test(text)
  const hasHawkishHeadline = /(higher for longer|hawkish|rate hike|yields rise|treasury yield)/.test(text)
  const hasDovishHeadline = /(rate cut|cooling inflation|disinflation|dovish|yields fall)/.test(text)

  if (hasRiskOffHeadline) {
    score -= 2
    reasons.push('Geopolitical risk headline flow is elevated (risk-off).')
  }
  if (hasInflationHeadline) {
    score -= 1
    reasons.push('Inflation-sensitive headlines increase higher-for-longer risk.')
  }
  if (hasHawkishHeadline) {
    score -= 1
    reasons.push('Rates/yield tone is hawkish, pressuring duration-heavy tech.')
  }
  if (hasDovishHeadline) {
    score += 1
    reasons.push('Some headline flow supports a softer rates path.')
  }

  if (cl?.changePct !== 'N/A' && Number(cl.changePct) > 0.8) {
    score -= 1
    reasons.push(`Crude is bid (+${cl.changePct}%), reinforcing inflation pressure.`)
  }
  if (gc?.changePct !== 'N/A' && Number(gc.changePct) > 0.6) {
    score -= 1
    reasons.push(`Gold strength (+${gc.changePct}%) signals defensive positioning.`)
  }
  if (nq?.changePct !== 'N/A' && Number(nq.changePct) > 0.8) {
    score += 1
    reasons.push(`NQ momentum is positive (+${nq.changePct}%), offsetting part of risk-off flow.`)
  }

  const macroBias = score >= 0 ? 'BULLISH' : 'BEARISH'
  return {
    macroBias,
    macroScore: score,
    reasons: reasons.slice(0, 4),
  }
}

function buildDeterministicFallback(ctx, macro) {
  const nq = ctx.NQ ?? {}
  const pdh = nq.prevHigh ?? 'N/A'
  const pdl = nq.prevLow ?? 'N/A'
  const asiaH = f2(nq?.sessions?.overnightH)
  const asiaL = f2(nq?.sessions?.overnightL)
  const londonH = f2(nq?.sessions?.londonH)
  const londonL = f2(nq?.sessions?.londonL)
  const direction = macro.macroBias === 'BULLISH' ? 'upside' : 'downside'

  return {
    thesis: `NQ trading around key liquidity with ${macro.macroBias.toLowerCase()} macro tone; ${direction} favored unless opposing level reclaims.`,
    primaryBias: macro.macroBias,
    oneLiner: `${macro.macroBias === 'BULLISH' ? 'Bid tone building' : 'Pressure at highs'} — watch liquidity sweep then ${direction} continuation.`,
    macroContext: macro.reasons.length
      ? macro.reasons.slice(0, 3)
      : ['Macro signal set is mixed; use structure confirmation at PDH/PDL.'],
    structure: {
      pdh,
      pdl,
      asiaRange: `H ${asiaH} / L ${asiaL}`,
      londonRange: `H ${londonH} / L ${londonL}`,
    },
    liquidityIntent: `Liquidity is clustered near PDH ${pdh} and PDL ${pdl}; expect a sweep-and-confirm sequence before directional expansion.`,
    setups: {
      shortSetup: `If price rejects PDH ${pdh} after a sweep, target internal range then PDL ${pdl}.`,
      longSetup: `Only long on clean reclaim and hold above PDH ${pdh}; target session highs extension.`,
    },
    invalidation: `Sustained acceptance above PDH ${pdh} invalidates bearish continuation; sustained trade below PDL ${pdl} invalidates bullish continuation.`,
    watch: [
      `NQ PDH ${pdh}`,
      `NQ PDL ${pdl}`,
      `Asia H/L ${asiaH}/${asiaL}`,
      `London H/L ${londonH}/${londonL}`,
    ],
    macroEngine: macro,
    provenance: {
      mode: 'deterministic',
      note: 'Generated only from fetched market-data + headline-derived macro signals; no free-form AI text generation.',
    },
  }
}

// ── handler ───────────────────────────────────────────────────────────────────

export async function GET(request) {
  const now          = Date.now()
  const { searchParams } = new URL(request.url)
  const forceRefresh = searchParams.get('refresh') === 'true'

  if (!forceRefresh && briefCache.content && briefCache.expiresAt && now < briefCache.expiresAt) {
    return Response.json({ brief: briefCache.content, raw: briefCache.raw, generatedAt: briefCache.generatedAt, cached: true })
  }

  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
    const [ctx, newsRes] = await Promise.all([
      fetchMarketContext(base),
      fetch(`${base}/api/news`).then(r => r.json()).catch(() => ({ news: [] })),
    ])
    const newsHeadlines = (newsRes.news ?? []).map(n => n.headline)
    const macro = computeMacroBias(ctx, newsHeadlines)
    const raw = buildDeterministicFallback(ctx, macro)

    const clean = [
      raw.thesis,
      raw.oneLiner ? `One-liner: ${raw.oneLiner}` : null,
      raw.setups.shortSetup ? `Short: ${raw.setups.shortSetup}` : null,
      raw.setups.longSetup ? `Long: ${raw.setups.longSetup}` : null,
      raw.invalidation ? `Invalidation: ${raw.invalidation}` : null,
    ].filter(Boolean).join('\n').trim()

    briefCache = { content: clean, raw, generatedAt: new Date().toISOString(), expiresAt: now + CACHE_DURATION_MS }

    return Response.json({ brief: clean, raw, generatedAt: briefCache.generatedAt, cached: false, grounded: true })

  } catch (error) {
    console.error('[MarketBrief] Error:', error)
    if (briefCache.content) {
      return Response.json({ brief: briefCache.content, raw: briefCache.raw, generatedAt: briefCache.generatedAt, cached: true, stale: true })
    }
    try {
      const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin
      const [ctx, newsRes] = await Promise.all([
        fetchMarketContext(base),
        fetch(`${base}/api/news`).then(r => r.json()).catch(() => ({ news: [] })),
      ])
      const newsHeadlines = (newsRes.news ?? []).map(n => n.headline)
      const macro = computeMacroBias(ctx, newsHeadlines)
      const raw = buildDeterministicFallback(ctx, macro)
      const brief = [raw.thesis, `One-liner: ${raw.oneLiner}`, `Short: ${raw.setups.shortSetup}`, `Long: ${raw.setups.longSetup}`, `Invalidation: ${raw.invalidation}`].join('\n')
      return Response.json({ brief, raw, generatedAt: new Date().toISOString(), cached: false, fallback: true })
    } catch {
      return Response.json({ brief: 'Brief temporarily unavailable.', error: error.message }, { status: 500 })
    }
  }
}
