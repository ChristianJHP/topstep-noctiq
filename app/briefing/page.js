'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── tokens ────────────────────────────────────────────────────────────────────
const C = {
  bg:     '#080808',
  panel:  '#0e0e0e',
  card:   '#121212',
  border: '#1c1c1c',
  text:   '#e2e2e2',
  dim:    '#555',
  muted:  '#888',
  green:  '#00e676',
  red:    '#ff1744',
  yellow: '#ffea00',
  blue:   '#448aff',
  orange: '#ff9100',
}

const INSTRUMENTS = [
  { key: 'NQ.c.0', label: 'NQ', full: 'E-mini Nasdaq 100 Futures' },
  { key: 'CL.c.0', label: 'CL', full: 'Crude Oil Futures'         },
  { key: 'GC.c.0', label: 'GC', full: 'Gold Futures'              },
]

function getInstrumentSeries(data, inst) {
  if (!data) return null
  if (Array.isArray(data?.[inst.key])) return data[inst.key]
  const matchKey = Object.keys(data).find(k => k === inst.key || k.startsWith(`${inst.label}.`) || k.startsWith(inst.label))
  return matchKey ? data[matchKey] : null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(v, d = 2) {
  const n = Number(v)
  if (isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function fmtChange(v) {
  const n = Number(v)
  if (isNaN(n)) return '—'
  return (n >= 0 ? '+' : '') + fmt(n)
}

function computePivots(bar) {
  if (!bar) return null
  const h = Number(bar.high), l = Number(bar.low), c = Number(bar.close)
  const p = (h + l + c) / 3
  return { pivot: p, r1: 2*p - l, r2: p + (h-l), s1: 2*p - h, s2: p - (h-l) }
}

function getBias(close, levels, open = null) {
  if (!close) return { label: 'AWAITING', color: C.dim }
  if (!levels) {
    if (open == null) return { label: 'AWAITING', color: C.dim }
    return Number(close) >= Number(open)
      ? { label: 'BULLISH', color: C.green }
      : { label: 'BEARISH', color: C.red }
  }
  const c = Number(close)
  if (c > levels.r1)    return { label: 'STRONG BULL', color: C.green  }
  if (c > levels.pivot) return { label: 'BULLISH',     color: C.green  }
  if (c < levels.s1)    return { label: 'STRONG BEAR', color: C.red    }
  if (c < levels.pivot) return { label: 'BEARISH',     color: C.red    }
  return c >= levels.pivot
    ? { label: 'BULLISH', color: C.green }
    : { label: 'BEARISH', color: C.red }
}

function getSession() {
  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const dow  = parts.find(p => p.type === 'weekday')?.value
  const h    = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m    = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const mins = h * 60 + m
  const etNow = new Date().toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  })
  if (dow === 'Sat' || dow === 'Sun')   return { label: 'CLOSED',      color: C.dim,    dot: '#333',   time: etNow }
  if (mins >= 570  && mins < 960)       return { label: 'MARKET OPEN', color: C.green,  dot: C.green,  time: etNow }
  if (mins >= 1020 || mins < 240)       return { label: 'GLOBEX',      color: C.blue,   dot: C.blue,   time: etNow }
  if (mins >= 240  && mins < 570)       return { label: 'PRE-MARKET',  color: C.yellow, dot: C.yellow, time: etNow }
  return                                       { label: 'AFTER HOURS', color: C.muted,  dot: '#555',   time: etNow }
}

function fmtAge(ts) {
  if (!ts) return ''
  const d = new Date(typeof ts === 'number' && ts < 2e10 ? ts * 1000 : ts)
  const diffH = (Date.now() - d) / 3_600_000
  if (diffH < 0.02) return 'just now'
  if (diffH < 1)    return `${Math.round(diffH * 60)}m ago`
  if (diffH < 24)   return `${Math.round(diffH)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── session level helpers (client-side) ───────────────────────────────────────

function etHourFromTs(ts) {
  return parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }).format(new Date(Number(ts) * 1000)))
}

function computeSessionLevels(bars1h) {
  if (!bars1h?.length) return null
  const london = [], overnight = [], prevDay = []

  // Today in ET
  const todayET = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  for (const b of bars1h) {
    const tsMs = Number(b.time) * 1000
    const dateET = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(tsMs))
    const h = etHourFromTs(b.time)
    const isToday = dateET === todayET

    if (isToday && h >= 3 && h < 9)  london.push(b)
    if (isToday && (h >= 18 || h < 3)) overnight.push(b)
    if (!isToday) prevDay.push(b)
  }

  const hi = arr => arr.length ? Math.max(...arr.map(b => Number(b.high))) : null
  const lo = arr => arr.length ? Math.min(...arr.map(b => Number(b.low)))  : null

  return {
    londonH:    hi(london),
    londonL:    lo(london),
    overnightH: hi(overnight),
    overnightL: lo(overnight),
    prevDayH:   hi(prevDay),
    prevDayL:   lo(prevDay),
  }
}

// ── chart ─────────────────────────────────────────────────────────────────────

function Chart({ candles, levels, sessionLvls, height = 110 }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!candles?.length) return
    let chart

    ;(async () => {
      const { createChart, CandlestickSeries } = await import('lightweight-charts')
      const el = ref.current
      if (!el) return

      chart = createChart(el, {
        width:  el.clientWidth,
        height,
        layout: { background: { color: 'transparent' }, textColor: C.dim },
        grid:   { vertLines: { color: '#161616' }, horzLines: { color: '#161616' } },
        crosshair:       { mode: 1 },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.06, bottom: 0.06 } },
        timeScale:       { borderColor: C.border, timeVisible: true, secondsVisible: false },
        handleScroll:    true,
        handleScale:     true,
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor: '#5aa2ff',
        downColor: '#8b93a6',
        borderVisible: false,
        wickUpColor: '#5aa2ff',
        wickDownColor: '#8b93a6',
      })

      const sorted = [...candles]
        .map(c => ({ time: Number(c.time), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
        .filter(c => c.open > 0 && c.time > 0)
        .sort((a, b) => a.time - b.time)

      series.setData(sorted)

      // Pivot levels
      if (levels) {
        const pivotLines = [
          { key: 'r2',    color: C.red,    label: 'R2', style: 2 },
          { key: 'r1',    color: '#e57373', label: 'R1', style: 2 },
          { key: 'pivot', color: C.blue,   label: 'PP', style: 0 },
          { key: 's1',    color: '#81c784', label: 'S1', style: 2 },
          { key: 's2',    color: C.green,  label: 'S2', style: 2 },
        ]
        for (const { key, color, label, style } of pivotLines) {
          const price = levels[key]
          if (!price) continue
          series.createPriceLine({ price: Number(price), color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title: label })
        }
      }

      // Session levels (London H/L, prev day H/L, overnight H/L)
      if (sessionLvls) {
        const sessionLines = [
          { price: sessionLvls.londonH,    color: C.orange, label: 'LON H', style: 3 },
          { price: sessionLvls.londonL,    color: C.orange, label: 'LON L', style: 3 },
          { price: sessionLvls.prevDayH,   color: '#9c27b0', label: 'PDH',   style: 3 },
          { price: sessionLvls.prevDayL,   color: '#9c27b0', label: 'PDL',   style: 3 },
          { price: sessionLvls.overnightH, color: '#607d8b', label: 'ONH',   style: 3 },
          { price: sessionLvls.overnightL, color: '#607d8b', label: 'ONL',   style: 3 },
        ]
        for (const { price, color, label, style } of sessionLines) {
          if (!price) continue
          series.createPriceLine({ price: Number(price), color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title: label })
        }
      }

      chart.timeScale().fitContent()
      chart.timeScale().scrollToRealTime()

      const ro = new ResizeObserver(() => {
        if (el && chart) chart.applyOptions({ width: el.clientWidth })
      })
      ro.observe(el)
      return () => ro.disconnect()
    })()

    return () => chart?.remove()
  }, [candles, levels, sessionLvls, height])

  return <div ref={ref} style={{ width: '100%', height, background: 'transparent' }} />
}

// ── instrument card ───────────────────────────────────────────────────────────

function InstrumentCard({ label, full, daily, candles1h }) {
  const hasData   = daily?.length >= 1
  const prevBar   = hasData ? (daily.length >= 2 ? daily[daily.length - 2] : null) : null
  const todayBar  = hasData ? daily[daily.length - 1] : null
  const levels    = computePivots(prevBar)
  const sessLvls  = computeSessionLevels(candles1h)
  const close     = todayBar ? Number(todayBar.close) : null
  const open      = todayBar ? Number(todayBar.open)  : null
  const change    = close != null && open != null ? close - open : null
  const changePct = change != null && open ? ((change / open) * 100).toFixed(2) : null
  const bias      = getBias(close, levels, open)
  const isUp      = change != null ? change >= 0 : null

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      {/* header */}
      <div style={{ padding: '12px 20px', background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 15, fontWeight: 700, color: C.text }}>{label}</span>
          <span style={{ fontSize: 11, color: C.dim }}>{full}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {hasData && (
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', fontFamily: 'ui-monospace,monospace', color: bias.color, border: `1px solid ${bias.color}`, padding: '2px 8px' }}>
              {bias.label}
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            {close != null
              ? <>
                  <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 16, fontWeight: 600, color: C.text }}>{fmt(close)}</div>
                  <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: isUp ? C.green : C.red }}>
                    {fmtChange(change)} ({isUp ? '+' : ''}{changePct}%)
                  </div>
                </>
              : <div style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, color: C.dim }}>AWAITING DATA</div>
            }
          </div>
        </div>
      </div>

      {/* chart */}
      <div style={{ background: C.card, minHeight: 110 }}>
        {candles1h?.length > 0
          ? <Chart candles={candles1h} levels={levels} sessionLvls={sessLvls} height={110} />
          : (
            <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.dim}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>LOADING CHART</span>
            </div>
          )
        }
      </div>

      {/* level rows */}
      <div style={{ background: C.panel, borderTop: `1px solid ${C.border}` }}>
        {/* pivot levels */}
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: `1px solid ${C.border}` }}>
          {levels
            ? [
                { k: 'R2', v: levels.r2,    c: C.red    },
                { k: 'R1', v: levels.r1,    c: '#e57373' },
                { k: 'PP', v: levels.pivot, c: C.blue   },
                { k: 'S1', v: levels.s1,    c: '#81c784' },
                { k: 'S2', v: levels.s2,    c: C.green  },
              ].map((l, i) => (
                <div key={l.k} style={{ flex: 1, padding: '7px 12px', textAlign: 'center', borderRight: i < 4 ? `1px solid ${C.border}` : 'none', minWidth: 75 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: l.c, fontFamily: 'ui-monospace,monospace', marginBottom: 3 }}>{l.k}</div>
                  <div style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: C.text }}>{fmt(l.v)}</div>
                </div>
              ))
            : <div style={{ flex: 1, padding: '8px 16px', fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>PIVOTS — AWAITING DATA</div>
          }
        </div>
        {/* session levels */}
        {sessLvls && (sessLvls.londonH || sessLvls.prevDayH) && (
          <div style={{ display: 'flex', gap: 16, padding: '7px 16px', overflowX: 'auto' }}>
            {sessLvls.londonH  && <><Tag color={C.orange} label="LON H" val={sessLvls.londonH}  /><Tag color={C.orange}  label="LON L" val={sessLvls.londonL}  /></>}
            {sessLvls.prevDayH && <><Tag color="#ab47bc" label="PDH"   val={sessLvls.prevDayH} /><Tag color="#ab47bc"    label="PDL"   val={sessLvls.prevDayL} /></>}
            {sessLvls.overnightH && <><Tag color="#78909c" label="ONH" val={sessLvls.overnightH} /><Tag color="#78909c"  label="ONL"   val={sessLvls.overnightL} /></>}
          </div>
        )}
      </div>
    </div>
  )
}

function Tag({ color, label, val }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color, fontFamily: 'ui-monospace,monospace' }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: C.text }}>{fmt(val)}</span>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [daily1d,    setDaily1d]    = useState(null)
  const [hourly1h,   setHourly1h]   = useState(null)
  const [news,       setNews]       = useState([])
  const [brief,      setBrief]      = useState(null)
  const [briefRaw,   setBriefRaw]   = useState(null)
  const [briefMeta,  setBriefMeta]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [session,    setSession]    = useState(() => getSession())
  const [fetchedAt,  setFetchedAt]  = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [dataError,  setDataError]  = useState(null)

  // live session clock
  useEffect(() => {
    const iv = setInterval(() => setSession(getSession()), 30_000)
    return () => clearInterval(iv)
  }, [])

  const load = async (refresh = false) => {
    setDataError(null)
    const qs = refresh ? '?refresh=true' : ''
    try {
      const safeJson = async (res) => {
        const text = await res.text()
        try { return JSON.parse(text) } catch { return { error: `Server error (${res.status})` } }
      }

      const [d1dRes, d1hRes, newsRes, briefRes] = await Promise.all([
        fetch(`/api/market-data?schema=1d${refresh ? '&refresh=true' : ''}`),
        fetch(`/api/market-data?schema=1h${refresh ? '&refresh=true' : ''}`),
        fetch(`/api/news${qs}`),
        fetch(`/api/market/brief${qs}`),
      ])
      const [d1d, d1h, newsJson, briefJson] = await Promise.all([
        safeJson(d1dRes), safeJson(d1hRes), safeJson(newsRes), safeJson(briefRes),
      ])

      if (d1d.error && !d1d.data) setDataError(d1d.error)
      setDaily1d(d1d.data ?? null)
      setHourly1h(d1h.data ?? null)
      setNews(newsJson.news ?? [])
      setBrief(briefJson.brief ?? null)
      setBriefRaw(briefJson.raw ?? null)
      setBriefMeta(briefJson)
      setFetchedAt(d1d.fetchedAt ?? null)
    } catch (e) {
      setDataError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Auto-refresh every hour so briefing stays current with hourly cache windows.
  useEffect(() => {
    const iv = setInterval(() => { load(true) }, 60 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await load(true)
    setRefreshing(false)
  }

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── nav ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 44, borderBottom: `1px solid ${C.border}`,
        background: C.panel, position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ fontSize: 11, color: C.dim, textDecoration: 'none', letterSpacing: '0.03em' }}>← HOME</Link>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: C.muted }}>NOCTIQ</span>
          <span style={{ fontSize: 11, color: C.dim }}>/</span>
          <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color: C.text }}>BRIEFING</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* session indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: session.dot }} />
            <span style={{ fontSize: 10, fontFamily: 'ui-monospace,monospace', color: session.color, letterSpacing: '0.06em' }}>
              {session.label}
            </span>
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
              {session.time} ET
            </span>
          </div>
          <span style={{ color: C.border }}>|</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontSize: 10, color: refreshing ? C.dim : C.muted,
              background: 'transparent', border: `1px solid ${C.border}`,
              padding: '4px 12px', cursor: refreshing ? 'wait' : 'pointer',
              fontFamily: 'ui-monospace,monospace', letterSpacing: '0.05em',
              transition: 'border-color 0.15s',
            }}
          >
            {refreshing ? '● REFRESHING' : '↻ REFRESH'}
          </button>
        </div>
      </div>

      {/* ── date bar ── */}
      <div style={{
        padding: '8px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: C.bg,
      }}>
        <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.04em' }}>
          {today.toUpperCase()}
        </span>
        {fetchedAt && (
          <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
            DATA {new Date(fetchedAt).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })} ET
          </span>
        )}
      </div>

      {/* ── error banner ── */}
      {dataError && (
        <div style={{ padding: '8px 20px', background: '#1a0008', borderBottom: `1px solid ${C.red}33` }}>
          <span style={{ fontSize: 11, color: C.red, fontFamily: 'ui-monospace,monospace' }}>
            ⚠ DATA ERROR: {dataError}
          </span>
        </div>
      )}

      {/* ── main layout: 2 columns ── */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 88px)' }}>

        {/* LEFT: instruments */}
        <div style={{ flex: '1 1 0', minWidth: 0, borderRight: `1px solid ${C.border}` }}>
          {INSTRUMENTS.map(inst => (
            <InstrumentCard
              key={inst.key}
              label={inst.label}
              full={inst.full}
              daily={getInstrumentSeries(daily1d, inst) ?? (loading ? null : [])}
              candles1h={getInstrumentSeries(hourly1h, inst) ?? []}
            />
          ))}

          {/* data attribution */}
          <div style={{ padding: '12px 20px' }}>
            <span style={{ fontSize: 9, color: '#333', fontFamily: 'ui-monospace,monospace', letterSpacing: '0.04em' }}>
              FUTURES DATA · DATABENTO GLBX.MDP3 · PIVOT LEVELS COMPUTED FROM PREV SESSION
            </span>
          </div>
        </div>

        {/* RIGHT: brief + news */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>

          {/* daily thesis */}
          {briefRaw?.thesis && (
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 18px', background: '#0b0b0b' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.dim, fontFamily: 'ui-monospace,monospace', marginBottom: 8 }}>
                DAILY THESIS
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: '#ddd' }}>{briefRaw.thesis}</p>
            </div>
          )}

          {/* AI brief / scenarios */}
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
                AI ANALYSIS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {briefRaw?.provenance?.mode === 'deterministic' && (
                  <span style={{ fontSize: 9, color: C.blue, fontFamily: 'ui-monospace,monospace' }}>GROUNDED</span>
                )}
                {briefMeta?.generatedAt && (
                  <span style={{ fontSize: 9, color: '#333', fontFamily: 'ui-monospace,monospace' }}>
                    {fmtAge(briefMeta.generatedAt)}
                  </span>
                )}
              </div>
            </div>
            {briefRaw?.primaryBias && (
              <div style={{ marginBottom: 10 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'ui-monospace,monospace',
                  color: briefRaw.primaryBias === 'BULLISH' ? C.green : C.red,
                  border: `1px solid ${briefRaw.primaryBias === 'BULLISH' ? C.green : C.red}`,
                  padding: '2px 8px',
                  letterSpacing: '0.08em',
                }}>
                  PRIMARY BIAS: {briefRaw.primaryBias}
                </span>
              </div>
            )}
            {briefRaw?.macroContext?.length > 0 && (
              <div style={{ padding: '8px 10px', background: '#121314', border: `1px solid ${C.border}`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.blue, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>MACRO CONTEXT</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {briefRaw.macroContext.map((x, i) => (
                    <li key={i} style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, marginBottom: 3 }}>{x}</li>
                  ))}
                </ul>
              </div>
            )}
            {briefRaw?.structure && (
              <div style={{ padding: '8px 10px', background: '#111111', border: `1px solid ${C.border}`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.orange, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>STRUCTURE</div>
                <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
                  <div>PDH: {briefRaw.structure.pdh} | PDL: {briefRaw.structure.pdl}</div>
                  <div>Asia: {briefRaw.structure.asiaRange}</div>
                  <div>London: {briefRaw.structure.londonRange}</div>
                </div>
              </div>
            )}
            {briefRaw?.liquidityIntent && (
              <div style={{ padding: '8px 10px', background: '#111111', border: `1px solid ${C.border}`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.yellow, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>LIQUIDITY + INTENT</div>
                <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, margin: 0 }}>{briefRaw.liquidityIntent}</p>
              </div>
            )}
            {briefRaw?.setups?.shortSetup && (
              <div style={{ padding: '8px 10px', background: '#1a0008', border: `1px solid ${C.red}22`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.red, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>SHORT SETUP</div>
                <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, margin: 0 }}>{briefRaw.setups.shortSetup}</p>
              </div>
            )}
            {briefRaw?.setups?.longSetup && (
              <div style={{ padding: '8px 10px', background: '#001a0d', border: `1px solid ${C.green}22`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.green, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>LONG SETUP</div>
                <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, margin: 0 }}>{briefRaw.setups.longSetup}</p>
              </div>
            )}
            {briefRaw?.invalidation && (
              <div style={{ padding: '8px 10px', background: '#141100', border: `1px solid ${C.yellow}33`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.yellow, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>INVALIDATION</div>
                <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, margin: 0 }}>{briefRaw.invalidation}</p>
              </div>
            )}
            {brief && (
              <div style={{ padding: '8px 10px', background: '#101010', border: `1px solid ${C.border}`, marginBottom: 6 }}>
                <div style={{ fontSize: 9, color: C.muted, fontFamily: 'ui-monospace,monospace', fontWeight: 700, marginBottom: 4 }}>SUMMARY</div>
                <p style={{ fontSize: 11, color: '#aaa', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{brief}</p>
              </div>
            )}
            {!brief && (
              <div style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>GENERATING...</div>
            )}
          </div>

          {/* what to watch */}
          {briefRaw?.watch?.length > 0 && (
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 18px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.dim, fontFamily: 'ui-monospace,monospace', marginBottom: 10 }}>
                WATCH TODAY
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {briefRaw.watch.map((w, i) => (
                  <span key={i} style={{ fontSize: 10, fontFamily: 'ui-monospace,monospace', color: C.muted, background: '#1a1a1a', padding: '3px 8px', border: `1px solid ${C.border}` }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* news feed */}
          <div style={{ flex: 1, padding: '14px 18px', overflow: 'auto' }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.dim, fontFamily: 'ui-monospace,monospace', marginBottom: 12 }}>
              MACRO HEADLINES
            </div>
            {news.length === 0
              ? <div style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>NO HEADLINES</div>
              : news.map((n, i) => (
                  <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < news.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
                        {fmtAge(n.datetime)}
                      </span>
                      <span style={{ fontSize: 9, color: '#333', fontFamily: 'ui-monospace,monospace' }}>{n.source}</span>
                    </div>
                    <a
                      href={n.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5, textDecoration: 'none', display: 'block' }}
                    >
                      {n.headline}
                    </a>
                  </div>
                ))
            }
          </div>

          {/* footer */}
          <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.border}`, background: C.panel }}>
            <span style={{ fontSize: 9, color: '#2a2a2a', fontFamily: 'ui-monospace,monospace' }}>
              NEWS · FINNHUB · AI · CLAUDE
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
      `}</style>
    </div>
  )
}
