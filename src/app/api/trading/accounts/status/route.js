/**
 * Account Status API
 * Returns connection status for all configured trading accounts
 * Endpoint: GET /api/trading/accounts/status
 */

import { NextResponse } from 'next/server';

const accounts = require('../../../../../lib/accounts');
const brokers = require('../../../../../lib/brokers');
const riskManager = require('../../../../../lib/riskManager');

/**
 * Calculate today's P&L percentage from account details
 * ProjectX API returns: balance, todaysPnl, openPnl, etc.
 */
function calculateTodayPnlPercent(details) {
  if (!details) return null;

  // Try to get today's P&L from various field names
  const todayPnl = details.todaysPnl ?? details.todayPnl ?? details.dailyPnl ??
                   details.dayPnl ?? details.realizedPnl ?? null;
  const openPnl = details.openPnl ?? details.unrealizedPnl ?? 0;
  const balance = details.balance ?? details.accountBalance ?? 0;

  if (balance <= 0) return null;

  // Total P&L = realized + unrealized
  const totalPnl = (todayPnl ?? 0) + openPnl;

  // If no P&L data available, check if there's a starting balance to compare
  if (todayPnl === null && openPnl === 0) {
    // Try using startOfDayBalance if available
    const startBalance = details.startOfDayBalance ?? details.previousBalance ?? null;
    if (startBalance && startBalance > 0) {
      const pnlFromBalance = balance - startBalance;
      return (pnlFromBalance / startBalance) * 100;
    }
    return null;
  }

  // Calculate percentage based on starting balance (balance - totalPnl)
  const startingBalance = balance - totalPnl;
  if (startingBalance <= 0) return null;

  return (totalPnl / startingBalance) * 100;
}

async function getAccountStatusWithPnl(account, brokerClient) {
  const status = await brokerClient.getAccountStatus();
  const dailyStats = riskManager.getDailyStats(account.id);

  let balance = null;
  let todayPnlPercent = null;

  try {
    if (status.connected) {
      const details = await brokerClient.getAccountDetails();
      balance = details.balance;
      todayPnlPercent = calculateTodayPnlPercent(details);

      // Log for debugging
      console.log(`[AccountStatus] ${account.id} details:`, {
        balance: details.balance,
        todaysPnl: details.todaysPnl,
        openPnl: details.openPnl,
        calculatedPct: todayPnlPercent
      });
    }
  } catch (e) {
    console.warn(`[AccountStatus] Could not fetch details for ${account.id}:`, e.message);
  }

  return {
    id: account.id,
    name: account.name,
    broker: account.broker,
    connected: status.connected,
    balance: balance,
    todayPnlPercent: todayPnlPercent,
    error: status.error || null,
    dailyStats: {
      tradeCount: dailyStats.tradeCount,
      tradesRemaining: dailyStats.tradesRemaining,
      totalProfit: dailyStats.totalProfit,
      totalLoss: dailyStats.totalLoss,
    },
  };
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Get all enabled accounts
    const enabledAccounts = accounts.getEnabledAccounts();

    // Check status for each account in parallel
    const statusPromises = enabledAccounts.map(async (account) => {
      try {
        const brokerClient = brokers.getBrokerClient(account);
        return await getAccountStatusWithPnl(account, brokerClient);
      } catch (error) {
        return {
          id: account.id,
          name: account.name,
          broker: account.broker,
          connected: false,
          balance: null,
          todayPnlPercent: null,
          error: error.message,
          dailyStats: null,
        };
      }
    });

    const statuses = await Promise.all(statusPromises);

    // Also include default account if it exists
    const defaultAccount = accounts.getAccount('default');
    if (defaultAccount && !statuses.find(s => s.id === 'default')) {
      try {
        const brokerClient = brokers.getBrokerClient(defaultAccount);
        const defaultStatus = await getAccountStatusWithPnl(
          { ...defaultAccount, id: 'default' },
          brokerClient
        );
        statuses.unshift(defaultStatus);
      } catch (error) {
        statuses.unshift({
          id: 'default',
          name: defaultAccount.name,
          broker: defaultAccount.broker,
          connected: false,
          balance: null,
          todayPnlPercent: null,
          error: error.message,
          dailyStats: null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      accounts: statuses,
      totalAccounts: statuses.length,
      connectedAccounts: statuses.filter(s => s.connected).length,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[AccountStatus] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
