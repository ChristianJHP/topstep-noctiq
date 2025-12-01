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
      case 'failed': return { text: 'failed', color: 'text-red-500' }
      case 'pending': return { text: 'pending', color: 'text-amber-500' }
      default: return { text: status || '', color: 'text-neutral-500' }
    }
  }

  const getAccountLabel = (account) => {
    if (!account || account === 'default') return { text: 'TSX', color: 'text-blue-400' }
    if (account === 'tfd') return { text: 'TFD', color: 'text-purple-400' }
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
  const [accountsStatus, setAccountsStatus] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = async () => {
    try {
      const [statusRes, tradesRes, accountsRes] = await Promise.all([
        fetch('/api/trading/status'),
        fetch('/api/trading/trades'),
        fetch('/api/trading/accounts/status')
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
      }

      if (tradesRes.ok) {
        const data = await tradesRes.json()
        setTrades(data.trades || [])
      }

      if (accountsRes.ok) {
        const data = await accountsRes.json()
        setAccountsStatus(data.accounts || [])
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

  const futuresOpen = status?.futures?.isOpen || false

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <header className="border-b border-neutral-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold tracking-tight">noctiq</h1>
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded ${futuresOpen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500'}`}>
                  {futuresOpen ? 'LIVE' : 'CLOSED'}
                </span>
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

        {/* Active Accounts */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Active Accounts</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* TopStepX Account */}
            {(() => {
              const tsxStatus = accountsStatus.find(a => a.id === 'default') || {}
              const isConnected = tsxStatus.connected
              const balance = tsxStatus.balance
              const formatBalance = (bal) => {
                if (bal === null || bal === undefined) return '--'
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(bal)
              }
              return (
                <div className={`rounded-lg p-3 border ${isConnected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-neutral-800/30 border-neutral-700/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-blue-400">TSX</span>
                      <span className="text-sm text-neutral-300">TopStepX</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-blue-400' : 'bg-neutral-600'}`} />
                      <span className={`text-xs ${isConnected ? 'text-blue-400' : 'text-neutral-600'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  {isConnected && balance !== null && (
                    <div className="mb-2">
                      <span className="text-lg font-semibold text-blue-400">{formatBalance(balance)}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-600">Strategy</span>
                      <p className="text-neutral-400">Supertrend</p>
                    </div>
                    <div>
                      <span className="text-neutral-600">R:R</span>
                      <p className="text-neutral-400">1:6</p>
                    </div>
                    <div>
                      <span className="text-neutral-600">Trades</span>
                      <p className="text-blue-400">{tsxStatus.dailyStats?.tradeCount || 0}/8</p>
                    </div>
                    <div>
                      <span className="text-neutral-600">Today P&L</span>
                      <p className={tsxStatus.dailyStats?.totalProfit > tsxStatus.dailyStats?.totalLoss ? 'text-emerald-400' : tsxStatus.dailyStats?.totalLoss > 0 ? 'text-red-400' : 'text-neutral-400'}>
                        {(() => {
                          const profit = tsxStatus.dailyStats?.totalProfit || 0
                          const loss = tsxStatus.dailyStats?.totalLoss || 0
                          const net = profit - loss
                          if (net === 0) return '--'
                          return net > 0 ? `+$${net}` : `-$${Math.abs(net)}`
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
            {/* The Futures Desk Account */}
            {(() => {
              const tfdStatus = accountsStatus.find(a => a.id === 'tfd') || {}
              const isConnected = tfdStatus.connected
              const balance = tfdStatus.balance
              const formatBalance = (bal) => {
                if (bal === null || bal === undefined) return '--'
                return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(bal)
              }
              return (
                <div className={`rounded-lg p-3 border ${isConnected ? 'bg-purple-500/5 border-purple-500/20' : 'bg-neutral-800/30 border-neutral-700/30'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-400">TFD</span>
                      <span className="text-sm text-neutral-300">The Futures Desk</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-purple-400' : 'bg-neutral-600'}`} />
                      <span className={`text-xs ${isConnected ? 'text-purple-400' : 'text-neutral-600'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  {isConnected && balance !== null && (
                    <div className="mb-2">
                      <span className="text-lg font-semibold text-purple-400">{formatBalance(balance)}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-600">Strategy</span>
                      <p className="text-neutral-400">ORB</p>
                    </div>
                    <div>
                      <span className="text-neutral-600">R:R</span>
                      <p className="text-neutral-400">ATR-based</p>
                    </div>
                    <div>
                      <span className="text-neutral-600">Trades</span>
                      <p className="text-purple-400">{tfdStatus.dailyStats?.tradeCount || 0}/8</p>
                    </div>
                    <div>
                      <span className="text-neutral-600">Today P&L</span>
                      <p className={tfdStatus.dailyStats?.totalProfit > tfdStatus.dailyStats?.totalLoss ? 'text-emerald-400' : tfdStatus.dailyStats?.totalLoss > 0 ? 'text-red-400' : 'text-neutral-400'}>
                        {(() => {
                          const profit = tfdStatus.dailyStats?.totalProfit || 0
                          const loss = tfdStatus.dailyStats?.totalLoss || 0
                          const net = profit - loss
                          if (net === 0) return '--'
                          return net > 0 ? `+$${net}` : `-$${Math.abs(net)}`
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}
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
