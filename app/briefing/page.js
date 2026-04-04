'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0a0a',
  card:     '#111111',
  border:   '#1e1e1e',
  muted:    '#333333',
  text:     '#e0e0e0',
  dim:      '#666666',
  green:    '#00ff87',
  red:      '#ff3b5c',
  yellow:   '#ffd60a',
  blue:     '#3b82f6',
}

const INSTRUMENTS = [
  { key: 'nq', label: 'NQ', full: 'E-mini Nasdaq 100', proxy: 'QQQ' },
  { key: 'cl', label: 'CL', full: 'Crude Oil',          proxy: 'USO' },
  { key: 'gc', label: 'GC', full: 'Gold',               proxy: 'GLD' },
]

const LEVEL_STYLE = {
  r2:    { color: C.red,    dash: 2, title: 'R2' },
  r1:    { color: '#ff8a80', dash: 2, title: 'R1' },
  pivot: { color: C.blue,   dash: 0, title: 'PP' },
  s1:    { color: '#69f0ae', dash: 2, title: 'S1' },
  s2:    { color: C.green,  dash: 2, title: 'S2' },
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(v, decimals = 2) {
  const n = Number(v)
  if (isNaN(n)) return '—'
  if (n % 1 === 0 && n > 500) return n.toLocaleString()
  return n.toFixed(decimals)
}

function getSessionInfo() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const dow  = parts.find(p => p.type === 'weekday')?.value
  const h    = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m    = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const mins = h * 60 + m

  if (dow === 'Sat' || dow === 'Sun')
    return { label: 'CLOSED', color: C.dim, bg: '#1a1a1a' }
  if (mins >= 570 && mins < 960)
    return { label: 'MARKET OPEN', color: C.green, bg: '#001a0d' }
  if (mins >= 240 && mins < 570)
    return { label: 'PRE-MARKET', color: C.yellow, bg: '#1a1700' }
  return { label: 'AFTER HOURS', color: C.dim, bg: '#141414' }
}

function riskColor(s) {
  if (s === 'RISK_ON')  return C.green
  if (s === 'RISK_OFF') return C.red
  return C.yellow
}

function biasColor(label) {
  if (label === 'BULLISH') return C.green
  if (label === 'BEARISH') return C.red
  return C.yellow
}

function fmtCalTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch { return iso }
}

function fmtNewsTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffH = (now - d) / 3_600_000
    if (diffH < 1)  return `${Math.round(diffH * 60)}m ago`
    if (diffH < 24) return `${Math.round(diffH)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch { return '' }
}

// ── chart ─────────────────────────────────────────────────────────────────────

function LevelChart({ candles, levels }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!candles?.length || !levels) return
    let chart

    ;(async () => {
      const { createChart, CandlestickSeries } = await import('lightweight-charts')
      const el = ref.current
      if (!el) return

      chart = createChart(el, {
        width:  el.clientWidth,
        height: 240,
        layout: { background: { color: C.card }, textColor: C.dim },
        grid:   { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor:     C.green,
        downColor:   C.red,
        borderVisible: false,
        wickUpColor:   C.green,
        wickDownColor: C.red,
      })

      const sorted = [...candles]
        .map(c => ({
          time:  Number(c.time),
          open:  Number(c.open),
          high:  Number(c.high),
          low:   Number(c.low),
          close: Number(c.close),
        }))
        .filter(c => c.open > 0)
        .sort((a, b) => a.time - b.time)

      series.setData(sorted)

      for (const [key, style] of Object.entries(LEVEL_STYLE)) {
        const price = levels[key === 'pivot' ? 'pivot' : key]
        if (!price) continue
        series.createPriceLine({
          price:              Number(price),
          color:              style.color,
          lineWidth:          1,
          lineStyle:          style.dash,
          axisLabelVisible:   true,
          title:              style.title,
        })
      }

      chart.timeScale().fitContent()

      const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }))
      ro.observe(el)
      return () => ro.disconnect()
    })()

    return () => chart?.remove()
  }, [candles, levels])

  return <div ref={ref} className="w-full" style={{ background: C.card }} />
}

// ── sub-components ────────────────────────────────────────────────────────────

function Mono({ children, color, style }) {
  return (
    <span style={{ fontFamily: 'ui-monospace,monospace', color: color ?? C.text, ...style }}>
      {children}
    </span>
  )
}

function CalendarStrip({ events }) {
  if (!events?.length) {
    return (
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 24px' }}>
        <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
          NO HIGH-IMPACT EVENTS TODAY
        </span>
      </div>
    )
  }

  return (
    <div
      style={{ borderBottom: `1px solid ${C.border}`, padding: '10px 24px', overflowX: 'auto' }}
      className="flex gap-3 no-scrollbar"
    >
      {events.map((e, i) => {
        const hasActual   = e.actual != null
        const beatEst     = hasActual && e.estimate != null && e.actual > e.estimate
        const missedEst   = hasActual && e.estimate != null && e.actual < e.estimate
        return (
          <div
            key={i}
            style={{
              flexShrink: 0,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderTop: `2px solid ${C.red}`,
              padding: '8px 12px',
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 3, fontFamily: 'ui-monospace,monospace' }}>
              {fmtCalTime(e.time)} ET
            </div>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>
              {e.event}
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 10, fontFamily: 'ui-monospace,monospace' }}>
              {e.estimate != null && (
                <span style={{ color: C.dim }}>est <span style={{ color: C.text }}>{e.estimate}{e.unit}</span></span>
              )}
              {e.prev != null && (
                <span style={{ color: C.dim }}>prev <span style={{ color: C.text }}>{e.prev}{e.unit}</span></span>
              )}
            </div>
            {hasActual && (
              <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'ui-monospace,monospace' }}>
                <span style={{ color: beatEst ? C.green : missedEst ? C.red : C.yellow, fontWeight: 700 }}>
                  {e.actual}{e.unit}
                </span>
                <span style={{ color: C.dim, fontSize: 10, marginLeft: 4 }}>actual</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InstrumentSection({ data, label, full, proxy }) {
  if (!data) return null
  const { ohlcv, levels, bias, candles, briefing, news } = data
  const isUp    = Number(ohlcv.close) >= Number(ohlcv.open)
  const change  = Number(ohlcv.close) - Number(ohlcv.open)
  const changePct = ((change / Number(ohlcv.open)) * 100).toFixed(2)
  const bc      = biasColor(bias?.label)

  const filteredNews = (news ?? []).filter(n =>
    INSTRUMENTS.find(i => i.key === label.toLowerCase())
      ? true // show all for now; news is already filtered macro-only
      : false
  ).slice(0, 5)

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      {/* instrument header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: `1px solid ${C.border}`,
        background: '#0d0d0d',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: 'ui-monospace,monospace' }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: C.dim }}>{full}</span>
          <span style={{ fontSize: 10, color: '#444', fontFamily: 'ui-monospace,monospace' }}>via {proxy}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* bias badge */}
          <div style={{
            border: `1px solid ${bc}`,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: bc,
            fontFamily: 'ui-monospace,monospace',
            letterSpacing: '0.05em',
          }}>
            {bias?.label} {bias?.pct}%
          </div>
          {/* price */}
          <div style={{ textAlign: 'right' }}>
            <Mono style={{ fontSize: 16, fontWeight: 600 }}>{fmt(ohlcv.close)}</Mono>
            <div style={{ fontSize: 11, color: isUp ? C.green : C.red, fontFamily: 'ui-monospace,monospace' }}>
              {isUp ? '+' : ''}{fmt(change)} ({isUp ? '+' : ''}{changePct}%)
            </div>
          </div>
        </div>
      </div>

      {/* chart */}
      <LevelChart candles={candles} levels={levels} />

      {/* levels bar */}
      <div style={{
        display: 'flex', gap: 24, padding: '10px 24px',
        borderTop: `1px solid ${C.border}`, background: '#0d0d0d',
        overflowX: 'auto', flexWrap: 'nowrap',
      }}>
        {[
          { k: 'R2', v: levels.r2,    c: C.red      },
          { k: 'R1', v: levels.r1,    c: '#ff8a80'  },
          { k: 'PP', v: levels.pivot, c: C.blue     },
          { k: 'S1', v: levels.s1,    c: '#69f0ae'  },
          { k: 'S2', v: levels.s2,    c: C.green    },
        ].map(l => (
          <div key={l.k} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: l.c, fontFamily: 'ui-monospace,monospace' }}>{l.k}</span>
            <Mono style={{ fontSize: 12 }}>{fmt(l.v)}</Mono>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: C.dim }}>PREV CLOSE</span>
          <Mono style={{ fontSize: 12 }}>{fmt(ohlcv.close)}</Mono>
        </div>
      </div>

      {/* briefing text */}
      {briefing && (
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${C.border}` }}>
          <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, margin: 0 }}>{briefing}</p>
        </div>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [session, setSession] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    setSession(getSessionInfo())
    const iv = setInterval(() => setSession(getSessionInfo()), 30_000)
    return () => clearInterval(iv)
  }, [])

  const load = () => {
    setLoading(true)
    fetch('/api/briefing')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetch('/api/briefing/generate')
    load()
    setRefreshing(false)
  }

  const meta        = data?.meta ?? {}
  const riskColor_  = riskColor(meta.riskSentiment)
  const generatedAt = data?.generated_at
    ? new Date(data.generated_at).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        hour12: true, timeZoneName: 'short',
      })
    : null

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,sans-serif' }}>

      {/* top nav bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', borderBottom: `1px solid ${C.border}`,
        background: '#0d0d0d', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ fontSize: 11, color: C.dim, textDecoration: 'none' }}>
            ← back
          </Link>
          <span style={{ fontSize: 11, color: C.dim }}>noctiq.ai</span>
          <span style={{ fontSize: 11, color: '#333' }}>/ briefing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {generatedAt && (
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
              GEN {generatedAt}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontSize: 10, color: C.dim, background: 'transparent',
              border: `1px solid ${C.border}`, padding: '4px 10px',
              cursor: refreshing ? 'wait' : 'pointer', fontFamily: 'ui-monospace,monospace',
            }}
          >
            {refreshing ? 'GENERATING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* session + risk bar */}
      {session && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 24px', borderBottom: `1px solid ${C.border}`,
          background: session.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: session.color,
              fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em',
            }}>
              {session.label}
            </span>
            <span style={{ fontSize: 10, color: C.dim }}>
              {new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          {meta.riskSentiment && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: riskColor_,
                fontFamily: 'ui-monospace,monospace', letterSpacing: '0.1em',
                border: `1px solid ${riskColor_}`,
                padding: '3px 12px',
              }}>
                {meta.riskSentiment?.replace('_', ' ')}
              </div>
              {meta.riskReason && (
                <span style={{ fontSize: 11, color: C.dim, maxWidth: 400 }}>{meta.riskReason}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* economic calendar strip */}
      <CalendarStrip events={meta.calendar ?? []} />

      {/* macro context */}
      {meta.macroContext && (
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: '#0d0d0d' }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace', marginBottom: 8, letterSpacing: '0.08em' }}>
            MACRO CONTEXT
          </div>
          <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.8, margin: 0, maxWidth: 860 }}>
            {meta.macroContext}
          </p>
        </div>
      )}

      {/* loading / error */}
      {loading && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
            LOADING BRIEFING...
          </span>
        </div>
      )}

      {error && (
        <div style={{ margin: 24, padding: '12px 16px', border: `1px solid ${C.red}`, fontSize: 12, color: C.red }}>
          {error}
        </div>
      )}

      {/* instrument sections */}
      {!loading && data && INSTRUMENTS.map(inst => (
        <InstrumentSection
          key={inst.key}
          data={data[inst.key]}
          label={inst.label}
          full={inst.full}
          proxy={inst.proxy}
        />
      ))}

      {/* headlines */}
      {!loading && data?.nq?.news?.length > 0 && (
        <div style={{ padding: '20px 24px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em', marginBottom: 14 }}>
            MACRO HEADLINES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(data.nq.news ?? []).map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace', flexShrink: 0 }}>
                  {fmtNewsTime(n.time)}
                </span>
                <span style={{ fontSize: 12, color: '#ccc', lineHeight: 1.4 }}>{n.title}</span>
                {n.source && (
                  <span style={{ fontSize: 10, color: '#444', flexShrink: 0, marginLeft: 'auto' }}>{n.source}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* footer */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: '#333', fontFamily: 'ui-monospace,monospace' }}>
          DATA VIA POLYGON.IO · CALENDAR VIA FINNHUB · REFRESHES 7:45AM ET
        </span>
        <Link href="/dashboard" style={{ fontSize: 10, color: C.dim, textDecoration: 'none' }}>
          LIVE CHARTS →
        </Link>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
