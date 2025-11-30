'use client'

import { useState, useEffect, useRef } from 'react'

function LiveClock({ timezone = 'America/New_York' }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [timezone])

  return <span className="font-mono">{time}</span>
}

function RTHCountdown({ withinRTH }) {
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date()
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const hours = et.getHours()
      const minutes = et.getMinutes()
      const seconds = et.getSeconds()
      const currentSeconds = hours * 3600 + minutes * 60 + seconds

      const rthStart = 9 * 3600 + 30 * 60 // 9:30 AM
      const rthEnd = 16 * 3600 // 4:00 PM

      let targetSeconds, label
      if (currentSeconds < rthStart) {
        // Before RTH - count to open
        targetSeconds = rthStart - currentSeconds
        label = 'opens'
      } else if (currentSeconds < rthEnd) {
        // During RTH - count to close
        targetSeconds = rthEnd - currentSeconds
        label = 'closes'
      } else {
        // After RTH - count to next day open
        targetSeconds = (24 * 3600 - currentSeconds) + rthStart
        label = 'opens'
      }

      const h = Math.floor(targetSeconds / 3600)
      const m = Math.floor((targetSeconds % 3600) / 60)
      const s = targetSeconds % 60

      if (h > 0) {
        setCountdown(`${label} in ${h}h ${m}m`)
      } else if (m > 0) {
        setCountdown(`${label} in ${m}m ${s}s`)
      } else {
        setCountdown(`${label} in ${s}s`)
      }
    }

    calculateCountdown()
    const interval = setInterval(calculateCountdown, 1000)
    return () => clearInterval(interval)
  }, [withinRTH])

  return <span className="text-xs text-neutral-500">{countdown}</span>
}

function StatusDot({ status }) {
  const colors = {
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
    idle: 'bg-amber-500',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-neutral-500'}`} />
  )
}

function TradingViewChart() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "PEPPERSTONE:NAS100",
      interval: "5",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(30, 30, 30, 1)",
      hide_top_toolbar: false,
      hide_legend: true,
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

function MiniTickerBar() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "PEPPERSTONE:NAS100", title: "NAS100" },
        { proName: "PEPPERSTONE:US500", title: "S&P500" },
      ],
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: "compact",
      colorTheme: "dark",
      locale: "en"
    })

    containerRef.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container h-10 overflow-hidden">
      <div ref={containerRef} className="tradingview-widget-container__widget" />
    </div>
  )
}

function StatCard({ label, value, subtext, highlight }) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-mono font-semibold ${highlight ? 'text-emerald-500' : 'text-white'}`}>
        {value}
      </p>
      {subtext && <p className="text-xs text-neutral-600 mt-1">{subtext}</p>}
    </div>
  )
}

function MarketStatusCard({ futures, etTime }) {
  const isOpen = futures?.isOpen
  const reason = futures?.reason || ''
  const hoursUntil = futures?.hoursUntilOpen || 0
  const minutesUntil = futures?.minutesUntilOpen || 0

  const formatCountdown = () => {
    if (isOpen) return null
    if (hoursUntil === 0 && minutesUntil === 0) return null
    if (hoursUntil > 24) {
      const days = Math.floor(hoursUntil / 24)
      const remainingHours = hoursUntil % 24
      return `${days}d ${remainingHours}h`
    }
    if (hoursUntil > 0) {
      return `${hoursUntil}h ${minutesUntil}m`
    }
    return `${minutesUntil}m`
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">Futures Market</p>
        <div className="flex items-center gap-2">
          <StatusDot status={isOpen ? 'online' : 'offline'} />
          <span className={`text-sm font-medium ${isOpen ? 'text-emerald-500' : 'text-neutral-500'}`}>
            {isOpen ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
      <p className="text-sm text-neutral-400">{reason}</p>
      {!isOpen && formatCountdown() && (
        <p className="text-xs text-neutral-600 mt-2">
          Opens in {formatCountdown()}
        </p>
      )}
      {etTime && (
        <p className="text-xs text-neutral-700 mt-2 font-mono">{etTime}</p>
      )}
    </div>
  )
}

function SystemStatusCard({ status, trading }) {
  const isHealthy = status === 'healthy'
  const canTrade = trading?.canTrade
  const withinRTH = trading?.withinRTH

  let systemStatus = 'offline'
  let statusText = 'Offline'

  if (isHealthy) {
    if (canTrade) {
      systemStatus = 'online'
      statusText = 'Active'
    } else if (withinRTH) {
      systemStatus = 'idle'
      statusText = 'Ready'
    } else {
      systemStatus = 'idle'
      statusText = 'Standby'
    }
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">System</p>
        <div className="flex items-center gap-2">
          <StatusDot status={systemStatus} />
          <span className={`text-sm font-medium ${
            systemStatus === 'online' ? 'text-emerald-500' :
            systemStatus === 'idle' ? 'text-amber-500' : 'text-red-500'
          }`}>
            {statusText}
          </span>
        </div>
      </div>
      <p className="text-sm text-neutral-400">
        {isHealthy ? 'All systems operational' : 'System unavailable'}
      </p>
      <p className="text-xs text-neutral-600 mt-2">
        RTH: 9:30 AM - 4:00 PM ET
      </p>
    </div>
  )
}

function ActivityFeed({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Recent Activity</p>
        <p className="text-sm text-neutral-600 text-center py-4">No activity today</p>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Recent Activity</p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {trades.slice(0, 5).map((trade, index) => {
          const isLong = trade.action === 'buy'
          const time = new Date(trade.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })

          return (
            <div key={trade.id || index} className="flex items-center justify-between py-2 border-b border-neutral-800/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-sm text-neutral-400">
                  {isLong ? 'Long' : 'Short'} position opened
                </span>
              </div>
              <span className="text-xs text-neutral-600 font-mono">{time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MarketBrief() {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generatedAt, setGeneratedAt] = useState(null)

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const res = await fetch('/api/market/brief')
        if (res.ok) {
          const data = await res.json()
          setBrief(data.brief)
          setGeneratedAt(data.generatedAt)
        }
      } catch (err) {
        console.error('Failed to fetch brief:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBrief()
  }, [])

  const formatTime = (isoString) => {
    if (!isoString) return ''
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    })
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">AI Market Brief</p>
        {generatedAt && (
          <span className="text-xs text-neutral-700">{formatTime(generatedAt)} ET</span>
        )}
      </div>
      {loading ? (
        <div className="py-4 text-center">
          <div className="inline-block w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
        </div>
      ) : brief ? (
        <div className="text-sm text-neutral-400 leading-relaxed whitespace-pre-line">
          {brief}
        </div>
      ) : (
        <p className="text-sm text-neutral-600 text-center py-4">Brief unavailable</p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = async () => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        fetch('/api/trading/status'),
        fetch('/api/trading/trades')
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
      }

      if (tradesRes.ok) {
        const data = await tradesRes.json()
        setTrades(data.trades || [])
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
    const interval = setInterval(fetchData, 10000) // Poll every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const dailyStats = status?.dailyStats || {}
  const todayTrades = dailyStats.tradesExecuted || 0

  const withinRTH = status?.trading?.withinRTH || false

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Ticker Bar */}
      <div className="border-b border-neutral-800/30 bg-neutral-900/30">
        <div className="max-w-6xl mx-auto">
          <MiniTickerBar />
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-neutral-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold tracking-tight">noctiq</h1>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded ${withinRTH ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                  {withinRTH ? 'LIVE' : 'STANDBY'}
                </span>
                <RTHCountdown withinRTH={withinRTH} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-neutral-600">ET</p>
                <p className="text-sm text-neutral-400"><LiveClock /></p>
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={status?.status === 'healthy' ? 'online' : 'offline'} />
                <span className="text-sm text-neutral-500">
                  {status?.status === 'healthy' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Today's Trades"
            value={todayTrades}
            subtext={`of ${dailyStats.maxTrades || 8} max`}
          />
          <StatCard
            label="Trades Available"
            value={dailyStats.tradesRemaining || 8}
            highlight={dailyStats.tradesRemaining > 0}
          />
          <SystemStatusCard
            status={status?.status}
            trading={status?.trading}
          />
          <MarketStatusCard
            futures={status?.futures}
            etTime={status?.etTime}
          />
        </div>

        {/* Chart */}
        <div className="border border-neutral-800 rounded-lg overflow-hidden mb-6">
          <TradingViewChart />
        </div>

        {/* AI Market Brief */}
        <div className="mb-6">
          <MarketBrief />
        </div>

        {/* Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityFeed trades={trades} />
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Session Info</p>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Strategy</span>
                <span className="text-sm text-neutral-300">Supertrend</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Instrument</span>
                <span className="text-sm text-neutral-300">MNQ</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Position Size</span>
                <span className="text-sm text-neutral-300">1 contract</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-500">Risk:Reward</span>
                <span className="text-sm text-neutral-300">1:6</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        {lastUpdate && (
          <p className="text-center text-xs text-neutral-700 mt-8">
            Last updated {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  )
}
