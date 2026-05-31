/**
 * Alert History Endpoint
 * Endpoint: GET /api/trading/trades
 *
 * Returns webhook alerts history from persistent storage
 */

import { NextResponse } from 'next/server';

const alertStorage = require('../../../../lib/alertStorage');

/**
 * GET handler for alert history
 */
export async function GET(request) {
  console.log('[Alerts] Fetching alert history...');

  try {
    // Get limit from query params (default 20, max 50)
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Math.min(requestedLimit, 50);

    // Get alerts from persistent storage
    const alerts = await alertStorage.getAlerts(limit);

    // Get today's count
    const todayAlerts = await alertStorage.getTodayAlerts();

    const response = {
      trades: alerts, // Keep as 'trades' for frontend compatibility
      count: alerts.length,
      todayCount: todayAlerts.length,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Alerts] Returned ${alerts.length} alerts`);
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Alerts] Error fetching alert history:', error);

    return NextResponse.json({
      trades: [],
      count: 0,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
