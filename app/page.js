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

function StrategyComparison({ pnlData, accountsStatus }) {
  // Calculate strategy metrics from P&L history
  const getStrategyStats = (accountId, strategyName) => {
    const accountData = pnlData.filter(d =>
      d.accounts && d.accounts[accountId]
    ).map(d => ({
      ...d,
      accountPnL: d.accounts[accountId].pnl,
      cumulativePnL: d.accounts[accountId].cumulativePnL,
      tradeCount: d.accounts[accountId].tradeCount,
    }));

    if (accountData.length === 0) {
      return {
        name: strategyName,
        totalPnL: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        totalTrades: 0,
        winningDays: 0,
        losingDays: 0,
        maxDrawdown: 0,
        sharpe: 0,
      };
    }

    const wins = accountData.filter(d => d.accountPnL > 0);
    const losses = accountData.filter(d => d.accountPnL < 0);
    const totalPnL = accountData.reduce((sum, d) => sum + d.accountPnL, 0);
    const totalTrades = accountData.reduce((sum, d) => sum + (d.tradeCount || 0), 0);

    // Calculate max drawdown
    let peak = 0;
    let maxDrawdown = 0;
    accountData.forEach(d => {
      const cumPnL = d.cumulativePnL || 0;
      if (cumPnL > peak) peak = cumPnL;
      const drawdown = peak - cumPnL;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });

    // Simplified Sharpe ratio (daily returns std dev)
    const returns = accountData.map(d => d.accountPnL);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance) || 1;
    const sharpe = (avgReturn / stdDev) * Math.sqrt(252); // Annualized

    return {
      name: strategyName,
      totalPnL,
      winRate: accountData.length > 0 ? (wins.length / accountData.length) * 100 : 0,
      avgWin: wins.length > 0 ? wins.reduce((s, d) => s + d.accountPnL, 0) / wins.length : 0,
      avgLoss: losses.length > 0 ? losses.reduce((s, d) => s + d.accountPnL, 0) / losses.length : 0,
      totalTrades,
      winningDays: wins.length,
      losingDays: losses.length,
      maxDrawdown,
      sharpe: isNaN(sharpe) ? 0 : sharpe,
    };
  };

  const tsxStats = getStrategyStats('default', 'Supertrend')
  const tfdStats = getStrategyStats('tfd', 'ORB')

  const hasData = pnlData.length > 0

  const StatRow = ({ label, tsx, tfd, format = 'number', higherBetter = true }) => {
    const tsxVal = tsx || 0
    const tfdVal = tfd || 0
    const tsxBetter = higherBetter ? tsxVal > tfdVal : tsxVal < tfdVal
    const tfdBetter = higherBetter ? tfdVal > tsxVal : tfdVal < tsxVal

    const formatValue = (val) => {
      if (format === 'percent') return `${val.toFixed(1)}%`
      if (format === 'currency') return val >= 0 ? `+$${val.toFixed(0)}` : `-$${Math.abs(val).toFixed(0)}`
      if (format === 'ratio') return val.toFixed(2)
      return val.toFixed(0)
    }

    return (
      <div className="flex items-center justify-between py-2 border-b border-neutral-800/30 last:border-0">
        <span className="text-[11px] sm:text-xs text-neutral-500 w-16 sm:w-24 flex-shrink-0">{label}</span>
        <div className="flex gap-4 sm:gap-8">
          <span className={`text-[11px] sm:text-xs w-12 sm:w-16 text-right ${tsxBetter && hasData ? 'text-blue-400 font-medium' : 'text-neutral-400'}`}>
            {hasData ? formatValue(tsxVal) : '--'}
          </span>
          <span className={`text-[11px] sm:text-xs w-12 sm:w-16 text-right ${tfdBetter && hasData ? 'text-purple-400 font-medium' : 'text-neutral-400'}`}>
            {hasData ? formatValue(tfdVal) : '--'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Strategy Comparison</p>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-700">
        <span className="text-[11px] sm:text-xs text-neutral-600 w-16 sm:w-24">Metric</span>
        <div className="flex gap-4 sm:gap-8">
          <div className="w-12 sm:w-16 text-right">
            <span className="text-[11px] sm:text-xs font-medium text-blue-400">TSX</span>
            <p className="text-[9px] sm:text-[10px] text-neutral-600 hidden sm:block">Supertrend</p>
          </div>
          <div className="w-12 sm:w-16 text-right">
            <span className="text-[11px] sm:text-xs font-medium text-purple-400">TFD</span>
            <p className="text-[9px] sm:text-[10px] text-neutral-600 hidden sm:block">ORB</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-0">
        <StatRow label="Total P&L" tsx={tsxStats.totalPnL} tfd={tfdStats.totalPnL} format="currency" />
        <StatRow label="Win Rate" tsx={tsxStats.winRate} tfd={tfdStats.winRate} format="percent" />
        <StatRow label="Avg Win" tsx={tsxStats.avgWin} tfd={tfdStats.avgWin} format="currency" />
        <StatRow label="Avg Loss" tsx={tsxStats.avgLoss} tfd={tfdStats.avgLoss} format="currency" higherBetter={false} />
        <StatRow label="Win Days" tsx={tsxStats.winningDays} tfd={tfdStats.winningDays} />
        <StatRow label="Loss Days" tsx={tsxStats.losingDays} tfd={tfdStats.losingDays} higherBetter={false} />
        <StatRow label="Max DD" tsx={tsxStats.maxDrawdown} tfd={tfdStats.maxDrawdown} format="currency" higherBetter={false} />
        <StatRow label="Sharpe" tsx={tsxStats.sharpe} tfd={tfdStats.sharpe} format="ratio" />
      </div>

      {!hasData && (
        <p className="text-xs text-neutral-700 text-center mt-3">
          Stats will populate as P&L data is recorded
        </p>
      )}
    </div>
  )
}

function PnLChart({ data, loading }) {
  // Simple SVG line chart for P&L history
  if (loading) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">P&L History</p>
        <div className="h-40 sm:h-48 flex items-center justify-center">
          <div className="inline-block w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
        <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">P&L History</p>
        <div className="h-40 sm:h-48 flex flex-col items-center justify-center">
          <p className="text-sm text-neutral-600">No P&L data yet</p>
          <p className="text-xs text-neutral-700 mt-1">Data will appear after trades are recorded</p>
        </div>
      </div>
    )
  }

  // Chart dimensions
  const width = 400
  const height = 160
  const padding = { top: 20, right: 20, bottom: 30, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Get cumulative P&L values
  const values = data.map(d => d.cumulativeTotal || 0)
  const minVal = Math.min(0, ...values)
  const maxVal = Math.max(0, ...values)
  const range = maxVal - minVal || 1

  // Scale functions
  const xScale = (i) => padding.left + (i / (data.length - 1 || 1)) * chartWidth
  const yScale = (v) => padding.top + chartHeight - ((v - minVal) / range) * chartHeight

  // Zero line position
  const zeroY = yScale(0)

  // Generate path
  const pathPoints = data.map((d, i) => {
    const x = xScale(i)
    const y = yScale(d.cumulativeTotal || 0)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  // Area fill path (from line to zero)
  const areaPath = pathPoints + ` L ${xScale(data.length - 1)} ${zeroY} L ${xScale(0)} ${zeroY} Z`

  const lastValue = values[values.length - 1] || 0
  const isPositive = lastValue >= 0

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 uppercase tracking-wider">P&L History</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{lastValue.toFixed(2)}%
          </span>
          <span className="text-xs text-neutral-600">{data.length}d</span>
        </div>
      </div>
      <div className="overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40 sm:h-48">
          {/* Grid lines */}
          <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY}
                stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />

          {/* Y-axis labels */}
          <text x={padding.left - 8} y={padding.top + 4}
                fill="#6b7280" fontSize="10" textAnchor="end">
            {maxVal.toFixed(1)}%
          </text>
          <text x={padding.left - 8} y={zeroY + 4}
                fill="#6b7280" fontSize="10" textAnchor="end">
            0%
          </text>
          {minVal < 0 && (
            <text x={padding.left - 8} y={height - padding.bottom}
                  fill="#6b7280" fontSize="10" textAnchor="end">
              {minVal.toFixed(1)}%
            </text>
          )}

          {/* Area fill */}
          <path d={areaPath}
                fill={isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'} />

          {/* Line */}
          <path d={pathPoints}
                fill="none"
                stroke={isPositive ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round" />

          {/* Data points */}
          {data.map((d, i) => (
            <circle key={i}
                    cx={xScale(i)}
                    cy={yScale(d.cumulativeTotal || 0)}
                    r="3"
                    fill={isPositive ? '#10b981' : '#ef4444'}
                    className="opacity-0 hover:opacity-100 transition-opacity" />
          ))}

          {/* X-axis date labels */}
          {data.length > 0 && (
            <>
              <text x={padding.left} y={height - 8}
                    fill="#6b7280" fontSize="9" textAnchor="start">
                {data[0].date?.slice(5) || ''}
              </text>
              <text x={width - padding.right} y={height - 8}
                    fill="#6b7280" fontSize="9" textAnchor="end">
                {data[data.length - 1].date?.slice(5) || ''}
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Account breakdown */}
      {data.length > 0 && data[data.length - 1].accounts && (
        <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap gap-3 sm:gap-4">
          {Object.entries(data[data.length - 1].accounts).map(([acct, info]) => (
            <div key={acct} className="text-[11px] sm:text-xs">
              <span className={acct === 'default' ? 'text-blue-400' : 'text-purple-400'}>
                {acct === 'default' ? 'TSX' : acct.toUpperCase()}
              </span>
              <span className={`ml-1 ${info.cumulativePnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {info.cumulativePnL >= 0 ? '+' : ''}{info.cumulativePnL?.toFixed(2) || 0}%
              </span>
            </div>
          ))}
        </div>
      )}
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
  const [pnlHistory, setPnlHistory] = useState([])
  const [pnlLoading, setPnlLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Fetch P&L history (less frequently)
  const fetchPnlHistory = async () => {
    try {
      const res = await fetch('/api/trading/pnl/history?days=30')
      if (res.ok) {
        const data = await res.json()
        setPnlHistory(data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch P&L history:', err)
    } finally {
      setPnlLoading(false)
    }
  }

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
    fetchPnlHistory()
    const interval = setInterval(fetchData, 10000) // Poll every 10 seconds
    const pnlInterval = setInterval(fetchPnlHistory, 60000) // P&L history every minute
    return () => {
      clearInterval(interval)
      clearInterval(pnlInterval)
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

        {/* P&L History and Strategy Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <PnLChart data={pnlHistory} loading={pnlLoading} />
          <StrategyComparison pnlData={pnlHistory} accountsStatus={accountsStatus} />
        </div>

        {/* Active Accounts */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Active Accounts</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* TopStepX Account */}
            {(() => {
              const tsxStatus = accountsStatus.find(a => a.id === 'default') || {}
              const isConnected = tsxStatus.connected
              // Get today's P&L percentage from the API (includes open positions)
              const todayPnlPct = tsxStatus.todayPnlPercent
              const hasPnl = todayPnlPct !== null && todayPnlPct !== undefined
              const isPositive = todayPnlPct >= 0
              return (
                <div className={`rounded-lg p-4 border ${isConnected ? 'bg-blue-500/5 border-blue-500/20' : 'bg-neutral-800/30 border-neutral-700/30'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-blue-400">TSX</span>
                      <span className="text-sm text-neutral-400">TopStepX</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-blue-400' : 'bg-neutral-600'}`} />
                      <span className={`text-xs ${isConnected ? 'text-blue-400' : 'text-neutral-600'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-neutral-600 mb-1">Today's P&L</p>
                    <p className={`text-2xl font-semibold ${hasPnl ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-500'}`}>
                      {hasPnl ? `${isPositive ? '+' : ''}${todayPnlPct.toFixed(2)}%` : '--'}
                    </p>
                  </div>
                </div>
              )
            })()}
            {/* The Futures Desk Account */}
            {(() => {
              const tfdStatus = accountsStatus.find(a => a.id === 'tfd') || {}
              const isConnected = tfdStatus.connected
              // Get today's P&L percentage from the API (includes open positions)
              const todayPnlPct = tfdStatus.todayPnlPercent
              const hasPnl = todayPnlPct !== null && todayPnlPct !== undefined
              const isPositive = todayPnlPct >= 0
              return (
                <div className={`rounded-lg p-4 border ${isConnected ? 'bg-purple-500/5 border-purple-500/20' : 'bg-neutral-800/30 border-neutral-700/30'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-purple-400">TFD</span>
                      <span className="text-sm text-neutral-400">The Futures Desk</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-purple-400' : 'bg-neutral-600'}`} />
                      <span className={`text-xs ${isConnected ? 'text-purple-400' : 'text-neutral-600'}`}>
                        {isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-neutral-600 mb-1">Today's P&L</p>
                    <p className={`text-2xl font-semibold ${hasPnl ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-neutral-500'}`}>
                      {hasPnl ? `${isPositive ? '+' : ''}${todayPnlPct.toFixed(2)}%` : '--'}
                    </p>
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
