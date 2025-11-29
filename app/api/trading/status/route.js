/**
 * Trading System Status Endpoint
 * Endpoint: GET /api/trading/status
 *
 * Returns:
 * - ProjectX connection status
 * - Current position (placeholder for future implementation)
 * - Today's trade count and P&L
 * - System health checks
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');
const riskManager = require('../../../../lib/riskManager');
const futuresMarket = require('../../../../lib/futuresMarket');

/**
 * GET handler for system status
 */
export async function GET() {
  console.log('[Status] Health check requested');

  try {
    // 1. Check ProjectX connection
    const projectxStatus = await projectx.getAccountStatus();

    // 2. Get daily trading statistics
    const dailyStats = riskManager.getDailyStats();

    // 3. Check environment configuration
    const configStatus = {
      webhookSecretConfigured: !!process.env.WEBHOOK_SECRET,
      projectxUsernameConfigured: !!process.env.PROJECTX_USERNAME,
      projectxApiKeyConfigured: !!process.env.PROJECTX_API_KEY,
    };

    // 4. Calculate system health
    const allConfigured = Object.values(configStatus).every(v => v === true);
    const systemHealthy = projectxStatus.connected && allConfigured;

    // 5. Get current time in ET
    const now = new Date();
    const etTimeString = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour12: true,
    });

    // 6. Check if within RTH
    const rthCheck = riskManager.canExecuteTrade();
    const withinRTH = !rthCheck.reason.includes('Outside regular trading hours');

    // 7. Get futures market status
    const futuresStatus = futuresMarket.isFuturesOpen();
    const timeUntilOpen = futuresMarket.getTimeUntilOpen();

    // 8. Build response
    const response = {
      status: systemHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      etTime: etTimeString,
      projectx: {
        connected: projectxStatus.connected,
        accountId: projectxStatus.accountId || null,
        error: projectxStatus.error || null,
      },
      trading: {
        withinRTH: withinRTH,
        rthHours: '9:30 AM - 4:00 PM ET',
        canTrade: rthCheck.allowed,
        blockReason: rthCheck.allowed ? null : rthCheck.reason,
      },
      futures: {
        isOpen: futuresStatus.open,
        reason: futuresStatus.reason,
        hoursUntilOpen: timeUntilOpen.hoursUntilOpen,
        minutesUntilOpen: timeUntilOpen.minutesUntilOpen,
        nextOpenTime: timeUntilOpen.nextOpenFormatted,
        closedReason: timeUntilOpen.closedReason || null,
      },
      dailyStats: {
        date: dailyStats.date,
        tradesExecuted: dailyStats.tradeCount,
        tradesRemaining: dailyStats.tradesRemaining,
        maxTrades: dailyStats.maxTrades,
        totalProfit: dailyStats.totalProfit,
        totalLoss: dailyStats.totalLoss,
        lossRemaining: dailyStats.lossRemaining,
        maxLoss: dailyStats.maxLoss,
        lastTradeTime: dailyStats.lastTradeTime
          ? new Date(dailyStats.lastTradeTime).toISOString()
          : null,
      },
      config: configStatus,
      riskLimits: {
        maxTradesPerDay: riskManager.RISK_LIMITS.MAX_TRADES_PER_DAY,
        maxDailyLoss: riskManager.RISK_LIMITS.MAX_DAILY_LOSS,
        cooldownSeconds: riskManager.RISK_LIMITS.COOLDOWN_SECONDS,
      },
      position: {
        // Placeholder for future position tracking
        active: false,
        contracts: 0,
        side: null,
        entryPrice: null,
        currentPnL: null,
      },
    };

    console.log('[Status] Health check complete:', systemHealthy ? 'HEALTHY' : 'DEGRADED');

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Status] Error during health check:', error);

    return NextResponse.json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
