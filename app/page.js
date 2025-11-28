'use client'

import { useState, useEffect } from 'react'

function StatusDot({ status }) {
  const statusClasses = {
    active: 'w-3 h-3 rounded-full bg-green-500 animate-pulse',
    inactive: 'w-3 h-3 rounded-full bg-red-500',
    warning: 'w-3 h-3 rounded-full bg-yellow-500 animate-pulse',
  }
  return <div className={statusClasses[status] || statusClasses.inactive} />
}

function StatCard({ label, value, subValue, icon, trend }) {
  return (
    <div className="glass-card p-6 hover:bg-white/10 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subValue && (
            <p className={`text-sm mt-1 ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
              {subValue}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-2xl opacity-50">{icon}</div>
        )}
      </div>
    </div>
  )
}

function RiskBar({ label, current, max, color = 'indigo' }) {
  const percentage = Math.min((current / max) * 100, 100)
  const colorClasses = {
    indigo: 'from-indigo-500 to-purple-500',
    green: 'from-green-500 to-emerald-500',
    red: 'from-red-500 to-orange-500',
    yellow: 'from-yellow-500 to-amber-500',
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{current} / {max}</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function TradeHistoryTable({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p className="text-lg">No trades yet</p>
        <p className="text-sm">Trades will appear here when executed</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-2 text-sm text-gray-400 font-medium">Time</th>
            <th className="text-left py-3 px-2 text-sm text-gray-400 font-medium">Action</th>
            <th className="text-right py-3 px-2 text-sm text-gray-400 font-medium">Stop</th>
            <th className="text-right py-3 px-2 text-sm text-gray-400 font-medium">TP</th>
            <th className="text-right py-3 px-2 text-sm text-gray-400 font-medium">P&L</th>
            <th className="text-center py-3 px-2 text-sm text-gray-400 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, index) => (
            <tr key={trade.id || index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-3 px-2 text-sm text-gray-300 font-mono">
                {new Date(trade.timestamp).toLocaleTimeString()}
              </td>
              <td className="py-3 px-2">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                  trade.action === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {trade.action}
                </span>
              </td>
              <td className="py-3 px-2 text-sm text-gray-300 text-right font-mono">
                {trade.stopPrice ? `$${trade.stopPrice.toFixed(2)}` : '-'}
              </td>
              <td className="py-3 px-2 text-sm text-gray-300 text-right font-mono">
                {trade.takeProfitPrice ? `$${trade.takeProfitPrice.toFixed(2)}` : '-'}
              </td>
              <td className={`py-3 px-2 text-sm text-right font-mono font-bold ${
                trade.pnl === null ? 'text-gray-400' : trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {trade.pnl !== null ? `$${trade.pnl.toFixed(2)}` : 'Open'}
              </td>
              <td className="py-3 px-2 text-center">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  trade.status === 'won' ? 'bg-green-500/20 text-green-400' :
                  trade.status === 'lost' ? 'bg-red-500/20 text-red-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [account, setAccount] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [statusRes, accountRes, tradesRes] = await Promise.all([
        fetch('/api/trading/status'),
        fetch('/api/trading/account'),
        fetch('/api/trading/trades?limit=20')
      ])

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData)
      }

      if (accountRes.ok) {
        const accountData = await accountRes.json()
        setAccount(accountData)
      }

      if (tradesRes.ok) {
        const tradesData = await tradesRes.json()
        setTrades(tradesData.trades || [])
      }

      setLastRefresh(new Date())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getSystemStatus = () => {
    if (!status) return 'inactive'
    if (status.status === 'healthy' && status.trading?.withinRTH) return 'active'
    if (status.status === 'healthy') return 'warning'
    return 'inactive'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
      {/* Hero Section */}
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Trading Dashboard
          </span>
        </h1>
        <p className="text-gray-400">Real-time monitoring and account tracking</p>
      </div>

      {/* Connection Status Banner */}
      <div className="glass-card p-4 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <StatusDot status={getSystemStatus()} />
            <div>
              <p className="text-white font-medium">
                {status?.status === 'healthy' ? 'System Online' : status?.status === 'degraded' ? 'System Degraded' : 'Connecting...'}
              </p>
              <p className="text-sm text-gray-400">
                {status?.projectx?.connected ? `Account ID: ${status.projectx.accountId}` : 'Not connected to TopStepX'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-400">ET Time</p>
              <p className="text-white font-mono">{status?.etTime || '--:--'}</p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Account Info Card */}
      {account && (
        <div className="glass-card p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-indigo-400">Account Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-400">Account Name</p>
              <p className="text-xl font-bold text-white">{account.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Account Status</p>
              <p className={`text-xl font-bold ${account.canTrade ? 'text-green-400' : 'text-red-400'}`}>
                {account.canTrade ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Balance</p>
              <p className="text-xl font-bold text-white">
                ${account.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Trades Today"
          value={status?.dailyStats?.tradesExecuted || 0}
          subValue={`${status?.dailyStats?.tradesRemaining || 0} remaining`}
        />
        <StatCard
          label="Daily Profit"
          value={`$${status?.dailyStats?.totalProfit?.toFixed(2) || '0.00'}`}
          trend="up"
        />
        <StatCard
          label="Daily Loss"
          value={`$${status?.dailyStats?.totalLoss?.toFixed(2) || '0.00'}`}
          trend="down"
        />
        <StatCard
          label="Trading Status"
          value={status?.trading?.canTrade ? 'Ready' : 'Blocked'}
          subValue={status?.trading?.blockReason || 'System ready for trades'}
        />
      </div>

      {/* Risk Management Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Limits */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-indigo-400">Daily Limits</h2>
          <div className="space-y-4">
            <RiskBar
              label="Trades Used"
              current={status?.dailyStats?.tradesExecuted || 0}
              max={status?.dailyStats?.maxTrades || 8}
              color="indigo"
            />
            <RiskBar
              label="Loss Limit Used"
              current={status?.dailyStats?.totalLoss || 0}
              max={status?.dailyStats?.maxLoss || 400}
              color={status?.dailyStats?.totalLoss > 300 ? 'red' : 'yellow'}
            />
          </div>
        </div>

        {/* Trading Window */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-indigo-400">Trading Window</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-400">Regular Trading Hours</p>
              <p className="text-xl font-bold text-white">{status?.trading?.rthHours || '9:30 AM - 4:00 PM ET'}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${status?.trading?.withinRTH ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
              {status?.trading?.withinRTH ? 'Market Open' : 'Market Closed'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-sm text-gray-400">Cooldown Period</p>
              <p className="text-lg font-medium text-white">{status?.riskLimits?.cooldownSeconds || 60}s</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Last Trade</p>
              <p className="text-lg font-medium text-white">
                {status?.dailyStats?.lastTradeTime
                  ? new Date(status.dailyStats.lastTradeTime).toLocaleTimeString()
                  : 'None today'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Position Info */}
      <div className="glass-card p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-indigo-400">Current Position</h2>
        {status?.position?.active ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-400">Side</p>
              <p className={`text-xl font-bold ${status.position.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                {status.position.side}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Contracts</p>
              <p className="text-xl font-bold text-white">{status.position.contracts}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Entry Price</p>
              <p className="text-xl font-bold text-white">${status.position.entryPrice}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">P&L</p>
              <p className={`text-xl font-bold ${status.position.currentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${status.position.currentPnL?.toFixed(2)}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <p className="text-lg">No Active Position</p>
            <p className="text-sm">Waiting for trading signals...</p>
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="glass-card p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-indigo-400">Trade History</h2>
        <TradeHistoryTable trades={trades} />
      </div>

      {/* System Config */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-indigo-400">System Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <StatusDot status={status?.config?.webhookSecretConfigured ? 'active' : 'inactive'} />
            <span className="text-gray-300">Webhook Secret</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status={status?.config?.projectxUsernameConfigured ? 'active' : 'inactive'} />
            <span className="text-gray-300">ProjectX Username</span>
          </div>
          <div className="flex items-center gap-3">
            <StatusDot status={status?.config?.projectxApiKeyConfigured ? 'active' : 'inactive'} />
            <span className="text-gray-300">ProjectX API Key</span>
          </div>
        </div>
        {lastRefresh && (
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}
