/**
 * Trade History Endpoint
 * Endpoint: GET /api/trading/trades
 *
 * Returns public-safe trade activity:
 * - Trade timestamps and direction only
 * - No prices, P&L, or order IDs exposed
 */

import { NextResponse } from 'next/server';

const riskManager = require('../../../../lib/riskManager');

/**
 * GET handler for trade history
 */
export async function GET(request) {
  console.log('[Trades] Fetching trade history...');

  try {
    // Get limit from query params (default 10, max 20 for public)
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || '10', 10);
    const limit = Math.min(requestedLimit, 20); // Cap at 20 for public display

    const allTrades = riskManager.getTradeHistory(limit);
    const dailyStats = riskManager.getDailyStats();

    // Sanitize trades - only expose timestamp and direction
    const trades = allTrades.map(trade => ({
      id: trade.id,
      timestamp: trade.timestamp,
      action: trade.action,
      status: trade.status,
    }));

    const response = {
      trades: trades,
      count: trades.length,
      dailyStats: {
        date: dailyStats.date,
        tradesExecuted: dailyStats.tradeCount,
      },
      timestamp: new Date().toISOString(),
    };

    console.log(`[Trades] Returned ${trades.length} trades (sanitized)`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Trades] Error fetching trade history:', error);

    return NextResponse.json({
      trades: [],
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
