'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const INSTRUMENTS = [
  { key: 'nq', label: 'NQ', full: 'E-mini Nasdaq 100' },
  { key: 'cl', label: 'CL', full: 'Crude Oil' },
  { key: 'gc', label: 'GC', full: 'Gold' },
]

const LEVEL_COLORS = {
  r2: '#f87171',
  r1: '#fca5a5',
  pivot: '#60a5fa',
  s1: '#86efac',
  s2: '#4ade80',
}

function LevelChart({ candles, levels }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!candles?.length || !levels) return

    let chart
    ;(async () => {
      const { createChart } = await import('lightweight-charts')
      const el = containerRef.current
      if (!el) return

      chart = createChart(el, {
        width: el.clientWidth,
        height: 260,
        layout: {
          background: { color: '#0a0e17' },
          textColor: '#6b7280',
        },
        grid: {
          vertLines: { color: 'rgba(59,130,246,0.06)' },
          horzLines: { color: 'rgba(59,130,246,0.06)' },
        },
        crosshair: { mode: 1 },
        rightPriceScale: {
          borderColor: 'rgba(255,255,255,0.06)',
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: 'rgba(255,255,255,0.06)',
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      })

      const series = chart.addCandlestickSeries({
        upColor: '#4ade80',
        downColor: '#f87171',
        borderVisible: false,
        wickUpColor: '#4ade80',
        wickDownColor: '#f87171',
      })

      // ensure timestamps are numbers (JSONB from Supabase may return strings)
      const sorted = [...candles]
        .map(c => ({
          time: Number(c.time),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
        }))
        .sort((a, b) => a.time - b.time)

      series.setData(sorted)

      // draw levels as price lines on the candle series
      const levelEntries = [
        ['r2', levels.r2, 'R2'],
        ['r1', levels.r1, 'R1'],
        ['pivot', levels.pivot, 'PP'],
        ['s1', levels.s1, 'S1'],
        ['s2', levels.s2, 'S2'],
      ]

      for (const [key, price, title] of levelEntries) {
        series.createPriceLine({
          price: Number(price),
          color: LEVEL_COLORS[key],
          lineWidth: 1,
          lineStyle: key === 'pivot' ? 0 : 2,
          axisLabelVisible: true,
          title,
        })
      }

      chart.timeScale().fitContent()

      const ro = new ResizeObserver(() => {
        chart.applyOptions({ width: el.clientWidth })
      })
      ro.observe(el)

      return () => ro.disconnect()
    })()

    return () => chart?.remove()
  }, [candles, levels])

  return <div ref={containerRef} className="w-full rounded-xl overflow-hidden" />
}

function fmt(val) {
  const n = Number(val)
  // use 2 decimals, but drop .00 for large whole numbers (NQ, GC)
  return n % 1 === 0 && n > 1000 ? n.toLocaleString() : n.toFixed(2)
}

function InstrumentCard({ data, label, full }) {
  if (!data) return null
  const { ohlcv, levels, candles, briefing } = data

  const isUp = Number(ohlcv.close) >= Number(ohlcv.open)
  const change = Number(ohlcv.close) - Number(ohlcv.open)
  const changePct = ((change / Number(ohlcv.open)) * 100).toFixed(2)

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0e17] overflow-hidden">
      {/* header */}
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{label}</span>
          <span className="text-xs text-neutral-500">{full}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            {fmt(ohlcv.close)}
          </span>
          <span className={`text-xs font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}{fmt(change)} ({isUp ? '+' : ''}{changePct}%)
          </span>
        </div>
      </div>

      {/* chart */}
      <div className="px-2 pt-3 pb-1">
        <LevelChart candles={candles} levels={levels} />
      </div>

      {/* levels */}
      <div className="px-5 py-3 flex items-center gap-4 flex-wrap border-t border-white/[0.04]">
        {[
          { label: 'R2', value: levels.r2, color: 'text-red-400' },
          { label: 'R1', value: levels.r1, color: 'text-red-300' },
          { label: 'PP', value: levels.pivot, color: 'text-blue-400' },
          { label: 'S1', value: levels.s1, color: 'text-green-300' },
          { label: 'S2', value: levels.s2, color: 'text-green-400' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold ${l.color}`}>{l.label}</span>
            <span className="text-xs text-neutral-400 font-mono">{fmt(l.value)}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10px] text-neutral-600">prev close</span>
          <span className="text-xs text-neutral-400 font-mono">{fmt(ohlcv.close)}</span>
        </div>
      </div>

      {/* briefing */}
      <div className="px-5 py-4 border-t border-white/[0.06]">
        <p className="text-xs text-neutral-400 leading-relaxed">{briefing}</p>
      </div>
    </div>
  )
}

export default function BriefingPage() {
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/briefing')
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setBriefing(data)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const generatedAt = briefing?.generated_at
    ? new Date(briefing.generated_at).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        hour12: true, timeZoneName: 'short',
      })
    : null

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* grid bg */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)`,
          backgroundSize: '52px 52px',
        }}
      />
      <div
        className="fixed -z-10 rounded-full pointer-events-none"
        style={{
          width: 560, height: 400,
          top: '-80px', left: '50%', marginLeft: '-280px',
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.09) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-3xl mx-auto px-6 py-10 pb-24">

        {/* nav */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition-colors duration-200"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            back
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors duration-200 border border-white/[0.06] px-3 py-1.5 rounded-lg"
          >
            live charts →
          </Link>
        </div>

        {/* header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
            </span>
            <span className="text-xs text-neutral-500 font-mono">daily pre-market briefing</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Pre-Market Levels</h1>
          <div className="flex items-center gap-3 mt-2">
            {generatedAt && (
              <span className="text-[11px] text-neutral-600">Generated {generatedAt}</span>
            )}
            <span className="text-neutral-800">·</span>
            <span className="text-[11px] text-neutral-600">Refreshes 8am ET daily</span>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 py-20 justify-center">
            <span className="animate-pulse">Loading briefing…</span>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-xs text-red-400">
            {error}
          </div>
        )}

        {briefing && (
          <div className="space-y-6">
            {INSTRUMENTS.map(inst => (
              <InstrumentCard
                key={inst.key}
                data={briefing[inst.key]}
                label={inst.label}
                full={inst.full}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
