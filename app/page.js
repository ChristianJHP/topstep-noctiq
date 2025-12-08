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


function MarketStatusCard({ futures, etTime }) {
  const isOpen = futures?.isOpen
  const reason = futures?.reason || ''
  const hoursUntilOpen = futures?.hoursUntilOpen || 0
  const minutesUntilOpen = futures?.minutesUntilOpen || 0
  const hoursUntilClose = futures?.hoursUntilClose || 0
  const minutesUntilClose = futures?.minutesUntilClose || 0

  const formatCountdown = (hours, minutes) => {
    if (hours === 0 && minutes === 0) return null
    if (hours > 24) {
      const days = Math.floor(hours / 24)
      const remainingHours = hours % 24
      return `${days}d ${remainingHours}h`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
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
      {isOpen && formatCountdown(hoursUntilClose, minutesUntilClose) && (
        <p className="text-xs text-neutral-600 mt-2">
          Closes in {formatCountdown(hoursUntilClose, minutesUntilClose)}
        </p>
      )}
      {!isOpen && formatCountdown(hoursUntilOpen, minutesUntilOpen) && (
        <p className="text-xs text-neutral-600 mt-2">
          Opens in {formatCountdown(hoursUntilOpen, minutesUntilOpen)}
        </p>
      )}
      {etTime && (
        <p className="text-xs text-neutral-700 mt-2 font-mono">{etTime}</p>
      )}
    </div>
  )
}

function SystemStatusCard({ status, trading, futures }) {
  const isHealthy = status === 'healthy'
  const canTrade = trading?.canTrade
  const futuresOpen = futures?.isOpen

  let systemStatus = 'offline'
  let statusText = 'Offline'

  if (isHealthy) {
    if (canTrade) {
      systemStatus = 'online'
      statusText = 'Active'
    } else if (futuresOpen) {
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
    </div>
  )
}

function ExportButton() {
  const handleExport = async () => {
    try {
      // Open CSV download in new tab
      window.open('/api/trading/export?format=csv&days=30', '_blank');
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <button
      onClick={handleExport}
      className="hidden sm:block px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 rounded transition-colors"
      title="Export trade journal as CSV"
    >
      Export CSV
    </button>
  );
}

function AlertsFeed({ trades }) {
  const getActionLabel = (action) => {
    switch (action) {
      case 'buy': return { text: 'LONG', color: 'bg-emerald-500/20 text-emerald-400' }
      case 'sell': return { text: 'SHORT', color: 'bg-red-500/20 text-red-400' }
      case 'close': return { text: 'CLOSE', color: 'bg-amber-500/20 text-amber-400' }
      default: return { text: action?.toUpperCase() || 'ALERT', color: 'bg-neutral-500/20 text-neutral-400' }
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success': return { text: 'filled', color: 'text-emerald-500' }
      case 'partial': return { text: 'partial', color: 'text-amber-500' }
      case 'failed': return { text: 'failed', color: 'text-red-500' }
      case 'blocked': return { text: 'blocked', color: 'text-orange-500' }
      case 'pending': return { text: 'pending', color: 'text-amber-500' }
      default: return { text: status || '', color: 'text-neutral-500' }
    }
  }

  const getAccountLabel = (account) => {
    if (!account || account === 'default') return { text: 'TSX', color: 'text-blue-400' }
    if (account === 'tfd' || account === 'futuresdesk') return { text: 'TFD', color: 'text-purple-400' }
    return { text: account.toUpperCase().slice(0, 3), color: 'text-neutral-400' }
  }

  if (!trades || trades.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">MNQ Alerts</p>
        <p className="text-sm text-neutral-600 text-center py-8">No alerts received</p>
        <p className="text-xs text-neutral-700 text-center">Waiting for TradingView webhooks...</p>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">MNQ Alerts</p>
        <span className="text-xs text-neutral-600">{trades.length} today</span>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {trades.slice(0, 10).map((trade, index) => {
          const action = getActionLabel(trade.action)
          const status = getStatusBadge(trade.status)
          const account = getAccountLabel(trade.account)
          const time = new Date(trade.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          })

          return (
            <div key={trade.id || index} className="flex items-center justify-between py-2 border-b border-neutral-800/50 last:border-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono ${account.color}`}>{account.text}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${action.color}`}>
                  {action.text}
                </span>
                <span className="text-sm text-neutral-300">MNQ</span>
                {status.text && (
                  <span className={`text-xs ${status.color}`}>{status.text}</span>
                )}
              </div>
              <span className="text-xs text-neutral-600 font-mono">{time}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PnLCalendar({ daily = [] }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  // Get calendar data for the current month view
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const days = []

    // Add padding for days before the 1st
    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayData = daily.find(day => day.date === dateStr)
      days.push({
        day: d,
        date: dateStr,
        pnl: dayData?.pnl || 0,
        trades: dayData?.trades || 0,
        hasData: !!dayData
      })
    }

    return days
  }

  const days = getCalendarDays()
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const getPnLColor = (pnl, hasData) => {
    if (!hasData) return 'bg-neutral-900/30'
    if (pnl > 0) return 'bg-emerald-500/20 border-emerald-500/30'
    if (pnl < 0) return 'bg-red-500/20 border-red-500/30'
    return 'bg-neutral-800/50'
  }

  const getPnLTextColor = (pnl) => {
    if (pnl > 0) return 'text-emerald-400'
    if (pnl < 0) return 'text-red-400'
    return 'text-neutral-500'
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">P&L Calendar</p>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 text-neutral-500 hover:text-neutral-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-neutral-400 w-32 text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-1 text-neutral-500 hover:text-neutral-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-[10px] text-neutral-600 py-1">{day}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <div
            key={i}
            className={`aspect-square p-1 rounded border border-transparent ${day ? getPnLColor(day.pnl, day.hasData) : ''}`}
          >
            {day && (
              <div className="h-full flex flex-col justify-between">
                <span className="text-[10px] text-neutral-500">{day.day}</span>
                {day.hasData && (
                  <span className={`text-[10px] font-medium ${getPnLTextColor(day.pnl)}`}>
                    {day.pnl >= 0 ? '+' : ''}{day.pnl.toFixed(0)}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function TradingStats({ stats, periodPnl, target }) {
  if (!stats) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Trading Stats</p>
        <p className="text-sm text-neutral-600 text-center py-4">No data available</p>
      </div>
    )
  }

  const remaining = target - periodPnl
  const daysToTarget = stats.avgDailyPnl > 0 ? Math.ceil(remaining / stats.avgDailyPnl) : null
  const annualizedReturn = stats.annualizedReturn || 0

  const statItems = [
    { label: 'Win Rate', value: `${stats.winRate?.toFixed(1)}%`, color: stats.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400' },
    { label: 'Profit Factor', value: stats.profitFactor ? stats.profitFactor.toFixed(2) : 'N/A', color: stats.profitFactor > 1.5 ? 'text-emerald-400' : 'text-neutral-400' },
    { label: 'Sharpe Ratio', value: stats.sharpeRatio?.toFixed(2) || 'N/A', color: stats.sharpeRatio > 1 ? 'text-emerald-400' : 'text-neutral-400' },
    { label: 'Avg Win', value: `$${stats.avgWin?.toFixed(0) || 0}`, color: 'text-emerald-400' },
    { label: 'Avg Loss', value: `$${stats.avgLoss?.toFixed(0) || 0}`, color: 'text-red-400' },
    { label: 'Avg Daily P&L', value: `$${stats.avgDailyPnl?.toFixed(0) || 0}`, color: stats.avgDailyPnl > 0 ? 'text-emerald-400' : 'text-red-400' },
  ]

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-4">Trading Stats</p>

      {/* Key projections */}
      <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-neutral-800">
        <div>
          <p className="text-[10px] text-neutral-600 mb-1">Days to Target</p>
          <p className="text-xl font-semibold text-blue-400">
            {daysToTarget !== null && daysToTarget > 0 ? `${daysToTarget} days` : remaining <= 0 ? 'Complete!' : '--'}
          </p>
          <p className="text-[10px] text-neutral-600">
            {daysToTarget !== null && daysToTarget > 0 && stats.avgDailyPnl > 0
              ? `At $${stats.avgDailyPnl.toFixed(0)}/day avg`
              : ''}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-neutral-600 mb-1">Annualized Equiv.</p>
          <p className={`text-xl font-semibold ${annualizedReturn > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${Math.abs(annualizedReturn).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] text-neutral-600">Projected yearly</p>
        </div>
      </div>

      {/* Win/Loss breakdown */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${stats.winRate || 0}%` }}
          />
          <div
            className="h-full bg-red-500"
            style={{ width: `${100 - (stats.winRate || 0)}%` }}
          />
        </div>
        <span className="text-xs text-neutral-500">
          {stats.winningDays}W / {stats.losingDays}L
        </span>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-3 gap-3">
        {statItems.map(item => (
          <div key={item.label}>
            <p className="text-[10px] text-neutral-600">{item.label}</p>
            <p className={`text-sm font-medium ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketBrief() {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(null)

  const fetchBrief = async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? '/api/market/brief?refresh=true' : '/api/market/brief'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setBrief(data.brief)
        setGeneratedAt(data.generatedAt)
      }
    } catch (err) {
      console.error('Failed to fetch brief:', err)
    }
  }

  useEffect(() => {
    const loadBrief = async () => {
      await fetchBrief()
      setLoading(false)
    }
    loadBrief()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchBrief(true)
    setRefreshing(false)
  }

  const formatTimestamp = (isoString) => {
    if (!isoString) return ''
    const date = new Date(isoString)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    })

    if (isToday) {
      return `Today ${timeStr} ET`
    }

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    })
    return `${dateStr} ${timeStr} ET`
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">AI Market Brief</p>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-xs text-neutral-600">{formatTimestamp(generatedAt)}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-1 text-neutral-500 hover:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Refresh brief"
          >
            <svg
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
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
  const [realPnl, setRealPnl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Fetch real P&L from TopStepX Trade/search
  const fetchRealPnl = async () => {
    try {
      const res = await fetch('/api/trading/pnl?days=30')
      if (res.ok) {
        const data = await res.json()
        setRealPnl(data)
      }
    } catch (err) {
      console.error('Failed to fetch real P&L:', err)
    }
  }

  const fetchData = async () => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        fetch('/api/trading/status'),
        fetch('/api/trading/trades'),
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
    fetchRealPnl()
    const interval = setInterval(fetchData, 10000) // Poll every 10 seconds
    const realPnlInterval = setInterval(fetchRealPnl, 30000) // Real P&L every 30 seconds
    return () => {
      clearInterval(interval)
      clearInterval(realPnlInterval)
    }
  }, [])

  const futuresOpen = status?.futures?.isOpen || false

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="border-b border-neutral-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight">noctiq</h1>
              <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs ${futuresOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                {futuresOpen ? 'LIVE' : 'CLOSED'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <ExportButton />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <SystemStatusCard
            status={status?.status}
            trading={status?.trading}
            futures={status?.futures}
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

        {/* Alerts and Brief */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <AlertsFeed trades={trades} />
          <MarketBrief />
        </div>

        {/* Account P&L - TopStepX Only */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Account P&L</p>
          </div>
          {/* TopStepX Account */}
          {(() => {
            const tsx = realPnl?.brokers?.tsx
            const todayPnl = tsx?.today?.pnl || 0
            const periodPnl = tsx?.period?.pnl || 0
            const hasPnl = tsx?.connected
            const isPositiveToday = todayPnl >= 0
            const isPositivePeriod = periodPnl >= 0
            const trades = tsx?.today?.trades || 0
            const periodTrades = tsx?.period?.trades || 0
            const accountName = tsx?.account?.name || ''
            const balance = tsx?.account?.balance || 0
            const target = 3000  // TopStepX target profit
            const progress = Math.min(100, Math.max(0, (periodPnl / target) * 100))
            return (
              <div className={`rounded-lg p-4 border ${tsx?.connected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-neutral-800/30 border-neutral-700/30'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-blue-400">TSX</span>
                    <span className="text-xs text-neutral-500">TopStepX</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${tsx?.connected ? 'bg-blue-400' : 'bg-neutral-600'}`} />
                    <span className="text-xs text-neutral-500">{tsx?.connected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
                {accountName && <p className="text-[10px] text-neutral-600 font-mono mb-2">{accountName}</p>}
                {balance > 0 && <p className="text-[10px] text-neutral-500 mb-3">Balance: ${balance.toLocaleString()}</p>}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-[10px] text-neutral-600">Today</p>
                    <p className={`text-2xl font-semibold ${hasPnl ? (isPositiveToday ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-500'}`}>
                      {hasPnl ? `${isPositiveToday ? '+' : '-'}$${Math.abs(todayPnl).toFixed(0)}` : '--'}
                    </p>
                    <p className="text-[10px] text-neutral-700">{trades} trades</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-600">30 Day Total</p>
                    <p className={`text-2xl font-semibold ${hasPnl ? (isPositivePeriod ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-500'}`}>
                      {hasPnl ? `${isPositivePeriod ? '+' : '-'}$${Math.abs(periodPnl).toFixed(0)}` : '--'}
                    </p>
                    <p className="text-[10px] text-neutral-700">{periodTrades} trades</p>
                  </div>
                </div>
                {/* Target Progress */}
                {hasPnl && (
                  <div className="mt-3 pt-3 border-t border-neutral-800">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-neutral-500">Target: ${target.toLocaleString()}</span>
                      <span className={periodPnl >= target ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>{progress.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${periodPnl >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.abs(progress)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-neutral-600 mt-2">
                      {periodPnl >= 0 ? `$${(target - periodPnl).toFixed(0)} to go` : `$${target.toFixed(0)} to go`}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        {/* Calendar and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <PnLCalendar daily={realPnl?.brokers?.tsx?.daily || []} />
          <TradingStats
            stats={realPnl?.brokers?.tsx?.stats}
            periodPnl={realPnl?.brokers?.tsx?.period?.pnl || 0}
            target={3000}
          />
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
