/**
 * Trade History Endpoint
 * Endpoint: GET /api/trading/trades
 *
 * Returns:
 * - Recent trade history
 * - Trade details including action, prices, P&L
 */

import { NextResponse } from 'next/server';

const riskManager = require('../../../../lib/riskManager');

/**
 * GET handler for trade history
 */
export async function GET(request) {
  console.log('[Trades] Fetching trade history...');

  try {
    // Get limit from query params (default 50)
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const trades = riskManager.getTradeHistory(limit);
    const dailyStats = riskManager.getDailyStats();

    const response = {
      trades: trades,
      count: trades.length,
      dailyStats: {
        date: dailyStats.date,
        tradesExecuted: dailyStats.tradeCount,
        totalProfit: dailyStats.totalProfit,
        totalLoss: dailyStats.totalLoss,
        netPnL: dailyStats.totalProfit - dailyStats.totalLoss,
      },
      timestamp: new Date().toISOString(),
    };

    console.log(`[Trades] Returned ${trades.length} trades`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Trades] Error fetching trade history:', error);

    return NextResponse.json({
      error: error.message,
      trades: [],
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
