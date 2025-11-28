'use client'

import { useState, useEffect } from 'react'

function StatusIndicator({ active }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-neutral-500'}`} />
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

export default function Dashboard() {
  const [status, setStatus] = useState(null)
  const [mesPrice, setMesPrice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchData = async () => {
    try {
      const statusRes = await fetch('/api/trading/status')
      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
        if (data.position?.currentPrice) {
          setMesPrice(data.position.currentPrice)
        }
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
        <div className="max-w-3xl mx-auto px-6 py-4">
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
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* MES Price */}
        <div className="text-center mb-12">
          <p className="text-sm text-neutral-500 uppercase tracking-wide mb-2">MES Price</p>
          <p className="text-6xl font-light text-white font-mono tracking-tight">
            {mesPrice ? mesPrice.toFixed(2) : '---.--'}
          </p>
        </div>

        {/* Position */}
        <div className="max-w-sm mx-auto">
          <PositionCard position={status?.position} />
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
