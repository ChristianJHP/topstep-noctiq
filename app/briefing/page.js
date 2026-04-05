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

function getBias(close, levels) {
  if (!levels || !close) return { label: 'NEUTRAL', color: C.yellow }
  const c = Number(close)
  if (c > levels.r1)    return { label: 'STRONG BULL', color: C.green  }
  if (c > levels.pivot) return { label: 'BULLISH',     color: C.green  }
  if (c < levels.s1)    return { label: 'STRONG BEAR', color: C.red    }
  if (c < levels.pivot) return { label: 'BEARISH',     color: C.red    }
  return                       { label: 'NEUTRAL',     color: C.yellow }
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

// ── chart ─────────────────────────────────────────────────────────────────────

function Chart({ candles, levels, height = 200 }) {
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
        upColor: C.green, downColor: C.red,
        borderVisible: false, wickUpColor: C.green, wickDownColor: C.red,
      })

      const sorted = [...candles]
        .map(c => ({ time: Number(c.time), open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) }))
        .filter(c => c.open > 0 && c.time > 0)
        .sort((a, b) => a.time - b.time)

      series.setData(sorted)

      if (levels) {
        const lines = [
          { key: 'r2',    color: C.red,    label: 'R2', style: 2 },
          { key: 'r1',    color: '#e57373', label: 'R1', style: 2 },
          { key: 'pivot', color: C.blue,   label: 'PP', style: 0 },
          { key: 's1',    color: '#81c784', label: 'S1', style: 2 },
          { key: 's2',    color: C.green,  label: 'S2', style: 2 },
        ]
        for (const { key, color, label, style } of lines) {
          const price = levels[key]
          if (!price) continue
          series.createPriceLine({ price: Number(price), color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title: label })
        }
      }

      chart.timeScale().fitContent()

      const ro = new ResizeObserver(() => {
        if (el && chart) chart.applyOptions({ width: el.clientWidth })
      })
      ro.observe(el)
      return () => ro.disconnect()
    })()

    return () => chart?.remove()
  }, [candles, levels, height])

  return <div ref={ref} style={{ width: '100%', height, background: 'transparent' }} />
}

// ── instrument card ───────────────────────────────────────────────────────────

function InstrumentCard({ label, full, daily, candles1h }) {
  const hasData = daily?.length >= 1

  const prevBar   = hasData ? (daily.length >= 2 ? daily[daily.length - 2] : null) : null
  const todayBar  = hasData ? daily[daily.length - 1] : null
  const levels    = computePivots(prevBar)
  const close     = todayBar ? Number(todayBar.close) : null
  const open      = todayBar ? Number(todayBar.open)  : null
  const change    = close != null && open != null ? close - open : null
  const changePct = change != null && open ? ((change / open) * 100).toFixed(2) : null
  const bias      = getBias(close, levels)
  const isUp      = change != null ? change >= 0 : null

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      {/* header row */}
      <div style={{ padding: '14px 20px', background: C.panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 15, fontWeight: 700, color: C.text }}>{label}</span>
          <span style={{ fontSize: 11, color: C.dim }}>{full}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {hasData && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
              fontFamily: 'ui-monospace,monospace',
              color: bias.color, border: `1px solid ${bias.color}`,
              padding: '2px 8px',
            }}>
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
      <div style={{ background: C.card, minHeight: 200 }}>
        {candles1h?.length > 0
          ? <Chart candles={candles1h} levels={levels} height={200} />
          : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.dim}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>LOADING CHART</span>
            </div>
          )
        }
      </div>

      {/* pivot levels */}
      <div style={{ display: 'flex', gap: 0, borderTop: `1px solid ${C.border}`, background: C.panel, overflowX: 'auto' }}>
        {levels
          ? [
              { k: 'R2', v: levels.r2,    c: C.red    },
              { k: 'R1', v: levels.r1,    c: '#e57373' },
              { k: 'PP', v: levels.pivot, c: C.blue   },
              { k: 'S1', v: levels.s1,    c: '#81c784' },
              { k: 'S2', v: levels.s2,    c: C.green  },
            ].map((l, i) => (
              <div key={l.k} style={{
                flex: 1, padding: '8px 12px', textAlign: 'center',
                borderRight: i < 4 ? `1px solid ${C.border}` : 'none',
                minWidth: 80,
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: l.c, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.05em', marginBottom: 3 }}>{l.k}</div>
                <div style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: C.text }}>{fmt(l.v)}</div>
              </div>
            ))
          : (
            <div style={{ flex: 1, padding: '8px 16px', fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
              PIVOT LEVELS — AWAITING DAILY DATA
            </div>
          )
        }
      </div>
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [daily1d,    setDaily1d]    = useState(null)
  const [hourly1h,   setHourly1h]   = useState(null)
  const [news,       setNews]       = useState([])
  const [brief,      setBrief]      = useState(null)
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
      const [d1dRes, d1hRes, newsRes, briefRes] = await Promise.all([
        fetch(`/api/market-data?schema=1d${refresh ? '&refresh=true' : ''}`),
        fetch(`/api/market-data?schema=1h${refresh ? '&refresh=true' : ''}`),
        fetch(`/api/news${qs}`),
        fetch(`/api/market/brief${qs}`),
      ])
      const [d1d, d1h, newsJson, briefJson] = await Promise.all([
        d1dRes.json(), d1hRes.json(), newsRes.json(), briefRes.json(),
      ])

      if (d1d.error && !d1d.data) setDataError(d1d.error)
      setDaily1d(d1d.data ?? null)
      setHourly1h(d1h.data ?? null)
      setNews(newsJson.news ?? [])
      setBrief(briefJson.brief ?? null)
      setBriefMeta(briefJson)
      setFetchedAt(d1d.fetchedAt ?? null)
    } catch (e) {
      setDataError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
              daily={daily1d?.[inst.key] ?? (loading ? null : [])}
              candles1h={hourly1h?.[inst.key] ?? []}
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

          {/* AI brief */}
          <div style={{ borderBottom: `1px solid ${C.border}`, padding: '16px 18px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
                AI MARKET BRIEF
              </span>
              {briefMeta?.generatedAt && (
                <span style={{ fontSize: 9, color: '#333', fontFamily: 'ui-monospace,monospace' }}>
                  {fmtAge(briefMeta.generatedAt)}
                </span>
              )}
            </div>
            {brief
              ? brief.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} style={{ fontSize: 12, color: '#bbb', lineHeight: 1.75, margin: '0 0 6px', letterSpacing: '0.01em' }}>
                    {line}
                  </p>
                ))
              : (
                <div style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
                  GENERATING BRIEF...
                </div>
              )
            }
          </div>

          {/* what to watch */}
          {daily1d && (
            <div style={{ borderBottom: `1px solid ${C.border}`, padding: '14px 18px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: C.dim, fontFamily: 'ui-monospace,monospace', marginBottom: 12 }}>
                KEY LEVELS TO WATCH
              </div>
              {INSTRUMENTS.map(inst => {
                const bars   = daily1d[inst.key]
                if (!bars?.length) return null
                const prevBar = bars.length >= 2 ? bars[bars.length - 2] : null
                const today   = bars[bars.length - 1]
                const levels  = computePivots(prevBar)
                if (!levels) return null
                return (
                  <div key={inst.key} style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: 'ui-monospace,monospace' }}>{inst.label}  </span>
                    <span style={{ fontSize: 10, color: C.blue,   fontFamily: 'ui-monospace,monospace' }}>PP {fmt(levels.pivot)}  </span>
                    <span style={{ fontSize: 10, color: '#e57373', fontFamily: 'ui-monospace,monospace' }}>R1 {fmt(levels.r1)}  </span>
                    <span style={{ fontSize: 10, color: '#81c784', fontFamily: 'ui-monospace,monospace' }}>S1 {fmt(levels.s1)}</span>
                  </div>
                )
              })}
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
