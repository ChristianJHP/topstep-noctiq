'use client'

import { useState, useEffect, useRef } from 'react'

// Utility to mask sensitive data
function mask(value, authenticated) {
  if (authenticated) return value
  return '****'
}

function StatusIndicator({ active }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-neutral-500'}`} />
  )
}

function LoginModal({ onLogin, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (data.success) {
        onLogin()
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold text-white mb-4">Login</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-neutral-600"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-neutral-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-neutral-600"
              required
            />
          </div>
          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 px-4 bg-white hover:bg-neutral-200 text-black text-sm rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
      symbol: "PEPPERSTONE:US500",
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
    <div className="tradingview-widget-container" style={{ height: '350px', width: '100%' }}>
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
      symbol: "PEPPERSTONE:US500",
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

function PositionCard({ position, authenticated }) {
  if (!position?.active) {
    return (
      <div className="border border-neutral-800 rounded-lg p-4 sm:p-6">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Position</h2>
        <p className="text-neutral-500 text-center py-6">No open position</p>
      </div>
    )
  }

  const isLong = position.side === 'BUY'
  const pnl = position.currentPnL || 0
  const isProfitable = pnl >= 0

  return (
    <div className="border border-neutral-800 rounded-lg p-4 sm:p-6">
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Position</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">Side</span>
          <span className={`font-mono font-medium ${isLong ? 'text-emerald-500' : 'text-red-500'}`}>
            {authenticated ? (isLong ? 'LONG' : 'SHORT') : '****'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">Contracts</span>
          <span className="font-mono text-white">{mask(position.contracts, authenticated)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">Entry</span>
          <span className="font-mono text-white">{mask(position.entryPrice?.toFixed(2), authenticated)}</span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
          <span className="text-neutral-400 text-sm">P&L</span>
          <span className={`font-mono font-medium ${isProfitable ? 'text-emerald-500' : 'text-red-500'}`}>
            {authenticated ? `${isProfitable ? '+' : ''}${pnl.toFixed(2)}` : '****'}
          </span>
        </div>
      </div>
    </div>
  )
}

function StatsCard({ dailyStats, authenticated }) {
  if (!dailyStats) return null

  const pnl = dailyStats.totalProfit - dailyStats.totalLoss

  return (
    <div className="border border-neutral-800 rounded-lg p-4 sm:p-6">
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Today's Stats</h2>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">Trades</span>
          <span className="font-mono text-white">
            {authenticated ? `${dailyStats.tradesExecuted} / ${dailyStats.maxTrades}` : '****'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">P&L</span>
          <span className={`font-mono ${pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {authenticated ? `$${pnl.toFixed(2)}` : '****'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-neutral-400 text-sm">Loss Limit</span>
          <span className="font-mono text-white">
            {authenticated ? `$${dailyStats.lossRemaining} left` : '****'}
          </span>
        </div>
      </div>
    </div>
  )
}

function TradeHistoryCard({ trades, authenticated }) {
  if (!authenticated) {
    return (
      <div className="border border-neutral-800 rounded-lg p-4 sm:p-6">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Trade History</h2>
        <p className="text-neutral-500 text-center py-6 text-sm">Login to view trade history</p>
      </div>
    )
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="border border-neutral-800 rounded-lg p-4 sm:p-6">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Trade History</h2>
        <p className="text-neutral-500 text-center py-6 text-sm">No trades yet</p>
      </div>
    )
  }

  return (
    <div className="border border-neutral-800 rounded-lg p-4 sm:p-6">
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">
        Trade History <span className="text-neutral-600">({trades.length})</span>
      </h2>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {trades.map((trade, index) => {
          const isLong = trade.action === 'buy'
          const time = new Date(trade.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
          const date = new Date(trade.timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })

          return (
            <div key={trade.id || index} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${isLong ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                  {isLong ? 'BUY' : 'SELL'}
                </span>
                <div className="text-xs">
                  <span className="text-neutral-400">{date}</span>
                  <span className="text-neutral-600 mx-1">at</span>
                  <span className="text-neutral-400">{time}</span>
                </div>
              </div>
              <div className="text-right">
                {trade.stopPrice && (
                  <div className="text-xs text-neutral-500">
                    SL: {trade.stopPrice} | TP: {trade.takeProfitPrice}
                  </div>
                )}
                {trade.pnl !== null && trade.pnl !== undefined && (
                  <span className={`text-xs font-mono ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth')
        const data = await res.json()
        setAuthenticated(data.authenticated)
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' })
      setAuthenticated(false)
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

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
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  const isConnected = status?.status === 'healthy'
  const futuresOpen = status?.futures?.isOpen
  const hoursUntil = status?.futures?.hoursUntilOpen || 0
  const minutesUntil = status?.futures?.minutesUntilOpen || 0
  const nextOpenTime = status?.futures?.nextOpenTime
  const closedReason = status?.futures?.closedReason

  const formatCountdown = () => {
    if (futuresOpen) return null
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
    <div className="min-h-screen bg-neutral-950">
      {/* Login Modal */}
      {showLogin && (
        <LoginModal
          onLogin={() => {
            setAuthenticated(true)
            setShowLogin(false)
          }}
          onClose={() => setShowLogin(false)}
        />
      )}

      {/* Header */}
      <header className="border-b border-neutral-800 sticky top-0 bg-neutral-950/95 backdrop-blur z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          {/* Mobile: Stack vertically */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <span className="text-lg font-semibold text-white">noctiq</span>
              <span className="text-neutral-600 hidden sm:inline">|</span>
              <div className="flex items-center gap-2">
                <StatusIndicator active={isConnected} />
                <span className="text-sm text-neutral-400">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {/* Login/Logout button */}
              {authChecked && (
                <button
                  onClick={() => authenticated ? handleLogout() : setShowLogin(true)}
                  className="text-xs px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 transition-colors ml-2"
                >
                  {authenticated ? 'Logout' : 'Login'}
                </button>
              )}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-sm">
              <div className="flex items-center gap-2">
                <StatusIndicator active={futuresOpen} />
                <span className={`${futuresOpen ? 'text-emerald-500' : 'text-neutral-500'}`}>
                  {futuresOpen ? 'Open' : 'Closed'}
                </span>
              </div>
              {!futuresOpen && formatCountdown() && (
                <span className="text-neutral-400 text-xs sm:text-sm">
                  Opens in {formatCountdown()}
                </span>
              )}
              <span className="text-neutral-600 text-xs sm:text-sm">{status?.etTime || '--:--'}</span>
            </div>
          </div>
          {/* Closed reason - hidden on mobile */}
          {!futuresOpen && closedReason && (
            <div className="mt-2 text-xs text-neutral-500 text-right hidden sm:block">
              {closedReason} {nextOpenTime && `- Opens ${nextOpenTime}`}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* MES Price Ticker */}
        <div className="mb-4 sm:mb-6">
          <TradingViewTicker />
        </div>

        {/* Chart */}
        <div className="border border-neutral-800 rounded-lg overflow-hidden mb-4 sm:mb-8">
          <TradingViewChart />
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <PositionCard position={status?.position} authenticated={authenticated} />
          <StatsCard dailyStats={status?.dailyStats} authenticated={authenticated} />
        </div>

        {/* Trade History - Full width */}
        <div className="mt-4 sm:mt-6">
          <TradeHistoryCard trades={trades} authenticated={authenticated} />
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <p className="text-center text-xs text-neutral-600 mt-6 sm:mt-8">
            Updated {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  )
}
