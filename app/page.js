'use client'

import { useState, useEffect, useRef } from 'react'

function StatusIndicator({ active }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-neutral-500'}`} />
  )
}

function TradingViewChart() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clear any existing content
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "CME_MINI:MES1!",
      interval: "5",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(40, 40, 40, 1)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: "https://www.tradingview.com"
    })

    containerRef.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container" style={{ height: '400px', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} className="tradingview-widget-container__widget" />
    </div>
  )
}

function TradingViewTicker() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbol: "CME_MINI:MES1!",
      width: "100%",
      isTransparent: true,
      colorTheme: "dark",
      locale: "en"
    })

    containerRef.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container">
      <div ref={containerRef} className="tradingview-widget-container__widget" />
    </div>
  )
}

function PositionCard({ position }) {
  if (!position?.active) {
    return (
      <div className="border border-neutral-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Position</h2>
        <p className="text-neutral-500 text-center py-8">No open position</p>
      </div>
    )
  }

  const isLong = position.side === 'BUY'
  const pnl = position.currentPnL || 0
  const isProfitable = pnl >= 0

  return (
    <div className="border border-neutral-800 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Position</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Side</span>
          <span className={`font-mono font-medium ${isLong ? 'text-emerald-500' : 'text-red-500'}`}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Contracts</span>
          <span className="font-mono text-white">{position.contracts}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Entry</span>
          <span className="font-mono text-white">{position.entryPrice?.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
          <span className="text-neutral-400">P&L</span>
          <span className={`font-mono font-medium ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
            {isProfitable ? '+' : ''}{pnl.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatsCard({ dailyStats }) {
  if (!dailyStats) return null

  return (
    <div className="border border-neutral-800 rounded-lg p-6">
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Today's Stats</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Trades</span>
          <span className="font-mono text-white">{dailyStats.tradesExecuted} / {dailyStats.maxTrades}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">P&L</span>
          <span className={`font-mono ${(dailyStats.totalProfit - dailyStats.totalLoss) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            ${(dailyStats.totalProfit - dailyStats.totalLoss).toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Loss Limit</span>
          <span className="font-mono text-white">${dailyStats.lossRemaining} left</span>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = async () => {
    try {
      const statusRes = await fetch('/api/trading/status')
      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
      }
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to fetch:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const isConnected = status?.status === 'healthy'
  const isMarketOpen = status?.trading?.withinRTH

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-800">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold text-white">noctiq</span>
              <span className="text-neutral-600">|</span>
              <div className="flex items-center gap-2">
                <StatusIndicator active={isConnected} />
                <span className="text-sm text-neutral-400">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={`${isMarketOpen ? 'text-emerald-500' : 'text-neutral-500'}`}>
                {isMarketOpen ? 'Market Open' : 'Market Closed'}
              </span>
              <span className="text-neutral-600">{status?.etTime || '--:--'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* MES Price Ticker */}
        <div className="mb-6">
          <TradingViewTicker />
        </div>

        {/* Chart */}
        <div className="border border-neutral-800 rounded-lg overflow-hidden mb-8">
          <TradingViewChart />
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PositionCard position={status?.position} />
          <StatsCard dailyStats={status?.dailyStats} />
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <p className="text-center text-xs text-neutral-600 mt-8">
            Updated {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  )
}
