'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// ── design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:    '#0a0a0a',
  card:  '#111111',
  border:'#1e1e1e',
  text:  '#e0e0e0',
  dim:   '#666666',
  green: '#00ff87',
  red:   '#ff3b5c',
  yellow:'#ffd60a',
  blue:  '#3b82f6',
}

const INSTRUMENTS = [
  { key: 'NQ.c.0', label: 'NQ', full: 'E-mini Nasdaq 100' },
  { key: 'CL.c.0', label: 'CL', full: 'Crude Oil'         },
  { key: 'GC.c.0', label: 'GC', full: 'Gold'              },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(v, decimals = 2) {
  const n = Number(v)
  if (isNaN(n)) return '—'
  if (n > 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n.toFixed(decimals)
}

function computePivots(bar) {
  if (!bar) return null
  const h = Number(bar.high), l = Number(bar.low), c = Number(bar.close)
  const pivot = (h + l + c) / 3
  return {
    pivot,
    r1: 2 * pivot - l,
    r2: pivot + (h - l),
    s1: 2 * pivot - h,
    s2: pivot - (h - l),
  }
}

function getBias(close, levels) {
  if (!levels) return { label: 'NEUTRAL', pct: 50 }
  const c = Number(close)
  if (c > levels.r1)    return { label: 'BULLISH', pct: 85 }
  if (c > levels.pivot) return { label: 'BULLISH', pct: 65 }
  if (c < levels.s1)    return { label: 'BEARISH', pct: 15 }
  if (c < levels.pivot) return { label: 'BEARISH', pct: 35 }
  return { label: 'NEUTRAL', pct: 50 }
}

function biasColor(label) {
  if (label === 'BULLISH') return C.green
  if (label === 'BEARISH') return C.red
  return C.yellow
}

function getSessionInfo() {
  const now   = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const dow  = parts.find(p => p.type === 'weekday')?.value
  const h    = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0')
  const m    = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0')
  const mins = h * 60 + m
  if (dow === 'Sat' || dow === 'Sun')   return { label: 'CLOSED',      color: C.dim,    bg: '#1a1a1a'  }
  if (mins >= 570 && mins < 960)        return { label: 'MARKET OPEN', color: C.green,  bg: '#001a0d'  }
  if (mins >= 240 && mins < 570)        return { label: 'PRE-MARKET',  color: C.yellow, bg: '#1a1700'  }
  return                                       { label: 'AFTER HOURS', color: C.dim,    bg: '#141414'  }
}

function fmtNewsTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso), now = new Date()
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
        height: 220,
        layout: { background: { color: C.card }, textColor: C.dim },
        grid:   { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
      })

      const series = chart.addSeries(CandlestickSeries, {
        upColor: C.green, downColor: C.red,
        borderVisible: false, wickUpColor: C.green, wickDownColor: C.red,
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

      const lineStyles = {
        r2: { color: C.red,     title: 'R2', lineStyle: 2 },
        r1: { color: '#ff8a80', title: 'R1', lineStyle: 2 },
        pivot: { color: C.blue, title: 'PP', lineStyle: 0 },
        s1: { color: '#69f0ae', title: 'S1', lineStyle: 2 },
        s2: { color: C.green,   title: 'S2', lineStyle: 2 },
      }
      for (const [k, style] of Object.entries(lineStyles)) {
        const price = levels[k]
        if (!price) continue
        series.createPriceLine({ price: Number(price), color: style.color, lineWidth: 1, lineStyle: style.lineStyle, axisLabelVisible: true, title: style.title })
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

// ── instrument section ────────────────────────────────────────────────────────

function InstrumentSection({ label, full, candles1h, daily }) {
  if (!daily?.length) return null

  const prevBar    = daily[daily.length - 2] ?? daily[daily.length - 1]
  const latestBar  = daily[daily.length - 1]
  const levels     = computePivots(prevBar)
  const close      = Number(latestBar.close)
  const open       = Number(latestBar.open)
  const change     = close - open
  const changePct  = ((change / open) * 100).toFixed(2)
  const isUp       = change >= 0
  const bias       = getBias(close, levels)
  const bc         = biasColor(bias.label)

  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      {/* header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: '#0d0d0d',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: 'ui-monospace,monospace' }}>{label}</span>
          <span style={{ fontSize: 11, color: C.dim }}>{full}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            border: `1px solid ${bc}`, padding: '3px 10px',
            fontSize: 11, fontWeight: 700, color: bc,
            fontFamily: 'ui-monospace,monospace', letterSpacing: '0.05em',
          }}>
            {bias.label}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 16, fontWeight: 600, fontFamily: 'ui-monospace,monospace', color: C.text }}>
              {fmt(close)}
            </span>
            <div style={{ fontSize: 11, color: isUp ? C.green : C.red, fontFamily: 'ui-monospace,monospace' }}>
              {isUp ? '+' : ''}{fmt(change)} ({isUp ? '+' : ''}{changePct}%)
            </div>
          </div>
        </div>
      </div>

      {/* chart */}
      {candles1h?.length > 0
        ? <LevelChart candles={candles1h} levels={levels} />
        : <div style={{ height: 220, background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>NO INTRADAY DATA</span>
          </div>
      }

      {/* levels bar */}
      {levels && (
        <div style={{
          display: 'flex', gap: 24, padding: '10px 24px',
          borderTop: `1px solid ${C.border}`, background: '#0d0d0d',
          overflowX: 'auto',
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
              <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: C.text }}>{fmt(l.v)}</span>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>PREV CLOSE</span>
            <span style={{ fontSize: 12, fontFamily: 'ui-monospace,monospace', color: C.text }}>{fmt(prevBar.close)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [dailyData,  setDailyData]  = useState(null)   // from /api/market-data?schema=1d
  const [hourlyData, setHourlyData] = useState(null)   // from /api/market-data?schema=1h
  const [news,       setNews]       = useState([])
  const [brief,      setBrief]      = useState(null)   // from /api/market/brief
  const [loading,    setLoading]    = useState(true)
  const [session,    setSession]    = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchedAt,  setFetchedAt]  = useState(null)

  useEffect(() => {
    setSession(getSessionInfo())
    const iv = setInterval(() => setSession(getSessionInfo()), 30_000)
    return () => clearInterval(iv)
  }, [])

  const load = async (refresh = false) => {
    const qs = refresh ? '?refresh=true' : ''
    try {
      const [d1dRes, d1hRes, newsRes, briefRes] = await Promise.all([
        fetch(`/api/market-data?schema=1d${refresh ? '&refresh=true' : ''}`),
        fetch(`/api/market-data?schema=1h${refresh ? '&refresh=true' : ''}`),
        fetch(`/api/news${qs}`),
        fetch(`/api/market/brief${qs}`),
      ])

      const [d1d, d1h, newsJson, briefJson] = await Promise.all([
        d1dRes.json(),
        d1hRes.json(),
        newsRes.json(),
        briefRes.json(),
      ])

      setDailyData(d1d.data ?? null)
      setHourlyData(d1h.data ?? null)
      setNews(newsJson.news ?? [])
      setBrief(briefJson.brief ?? null)
      setFetchedAt(d1d.fetchedAt ?? null)
    } catch (e) {
      console.error('[briefing] fetch error:', e)
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

  const fmtFetchedAt = fetchedAt
    ? new Date(fetchedAt).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        hour12: true, timeZoneName: 'short',
      })
    : null

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui,sans-serif' }}>

      {/* nav */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', borderBottom: `1px solid ${C.border}`,
        background: '#0d0d0d', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link href="/" style={{ fontSize: 11, color: C.dim, textDecoration: 'none' }}>← back</Link>
          <span style={{ fontSize: 11, color: C.dim }}>noctiq.ai</span>
          <span style={{ fontSize: 11, color: '#333' }}>/ briefing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {fmtFetchedAt && (
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
              {fmtFetchedAt}
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
            {refreshing ? 'REFRESHING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* session bar */}
      {session && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '10px 24px', borderBottom: `1px solid ${C.border}`,
          background: session.bg,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: session.color,
            fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em',
          }}>
            {session.label}
          </span>
          <span style={{ fontSize: 10, color: C.dim }}>
            {new Date().toLocaleDateString('en-US', {
              timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric',
            })}
          </span>
        </div>
      )}

      {/* AI brief */}
      {brief && (
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}`, background: '#0d0d0d' }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace', marginBottom: 10, letterSpacing: '0.08em' }}>
            AI MARKET BRIEF
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {brief.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} style={{ fontSize: 12, color: '#aaa', lineHeight: 1.7, margin: 0 }}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* loading */}
      {loading && (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace' }}>
            LOADING MARKET DATA...
          </span>
        </div>
      )}

      {/* instrument sections */}
      {!loading && INSTRUMENTS.map(inst => (
        <InstrumentSection
          key={inst.key}
          label={inst.label}
          full={inst.full}
          candles1h={hourlyData?.[inst.key] ?? []}
          daily={dailyData?.[inst.key] ?? []}
        />
      ))}

      {/* news */}
      {news.length > 0 && (
        <div style={{ padding: '20px 24px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.dim, fontFamily: 'ui-monospace,monospace', letterSpacing: '0.08em', marginBottom: 14 }}>
            MACRO HEADLINES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {news.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
                <span style={{ fontSize: 11, color: C.dim, fontFamily: 'ui-monospace,monospace', flexShrink: 0 }}>
                  {fmtNewsTime(n.datetime)}
                </span>
                <a
                  href={n.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#ccc', lineHeight: 1.4, textDecoration: 'none' }}
                >
                  {n.headline}
                </a>
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
          FUTURES DATA VIA DATABENTO · NEWS VIA FINNHUB · AI BRIEF VIA CLAUDE
        </span>
        <Link href="/" style={{ fontSize: 10, color: C.dim, textDecoration: 'none' }}>
          HOME →
        </Link>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
