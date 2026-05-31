/**
 * Historical P&L API
 * Returns P&L history for charting
 * Endpoint: GET /api/trading/pnl/history?account=default&days=30
 */

import { NextResponse } from 'next/server';

const alertStorage = require('../../../../../lib/alertStorage');

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account');
    const days = parseInt(searchParams.get('days') || '30', 10);

    let history;

    if (accountId) {
      // Get history for specific account
      history = await alertStorage.getHistoricalPnL(accountId, days);
    } else {
      // Get history for all accounts
      history = await alertStorage.getAllHistoricalPnL(days);
    }

    // Calculate cumulative P&L
    const cumulativeByAccount = {};
    const processedHistory = history.map(entry => {
      const acct = entry.accountId || accountId || 'default';
      if (!cumulativeByAccount[acct]) {
        cumulativeByAccount[acct] = 0;
      }
      cumulativeByAccount[acct] += entry.pnl;
      return {
        ...entry,
        accountId: acct,
        cumulativePnL: cumulativeByAccount[acct],
      };
    });

    // Group by date for combined view
    const byDate = {};
    processedHistory.forEach(entry => {
      if (!byDate[entry.date]) {
        byDate[entry.date] = {
          date: entry.date,
          accounts: {},
          totalPnL: 0,
        };
      }
      byDate[entry.date].accounts[entry.accountId] = {
        pnl: entry.pnl,
        balance: entry.balance,
        tradeCount: entry.tradeCount,
        cumulativePnL: entry.cumulativePnL,
      };
      byDate[entry.date].totalPnL += entry.pnl;
    });

    // Calculate overall cumulative
    let cumulativeTotal = 0;
    const chartData = Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(day => {
        cumulativeTotal += day.totalPnL;
        return {
          ...day,
          cumulativeTotal,
        };
      });

    return NextResponse.json({
      success: true,
      data: chartData,
      raw: processedHistory,
      summary: {
        totalDays: chartData.length,
        totalPnL: cumulativeTotal,
        requestedDays: days,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[PnLHistory] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
