/**
 * Account Status API
 * Returns connection status for all configured trading accounts
 * Endpoint: GET /api/trading/accounts/status
 */

import { NextResponse } from 'next/server';

const accounts = require('../../../../../lib/accounts');
const brokers = require('../../../../../lib/brokers');
const riskManager = require('../../../../../lib/riskManager');

export async function GET() {
  const startTime = Date.now();
  const results = [];

  try {
    // Get all enabled accounts
    const enabledAccounts = accounts.getEnabledAccounts();

    // Check status for each account in parallel
    const statusPromises = enabledAccounts.map(async (account) => {
      try {
        const brokerClient = brokers.getBrokerClient(account);
        const status = await brokerClient.getAccountStatus();
        const dailyStats = riskManager.getDailyStats(account.id);

        // Try to get balance (may fail if not connected)
        let balance = null;
        try {
          if (status.connected) {
            const details = await brokerClient.getAccountDetails();
            balance = details.balance;
          }
        } catch (e) {
          console.warn(`[AccountStatus] Could not fetch balance for ${account.id}:`, e.message);
        }

        return {
          id: account.id,
          name: account.name,
          broker: account.broker,
          connected: status.connected,
          balance: balance,
          error: status.error || null,
          dailyStats: {
            tradeCount: dailyStats.tradeCount,
            tradesRemaining: dailyStats.tradesRemaining,
            totalProfit: dailyStats.totalProfit,
            totalLoss: dailyStats.totalLoss,
          },
        };
      } catch (error) {
        return {
          id: account.id,
          name: account.name,
          broker: account.broker,
          connected: false,
          balance: null,
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
        const status = await brokerClient.getAccountStatus();
        const dailyStats = riskManager.getDailyStats('default');

        // Try to get balance
        let balance = null;
        try {
          if (status.connected) {
            const details = await brokerClient.getAccountDetails();
            balance = details.balance;
          }
        } catch (e) {
          console.warn('[AccountStatus] Could not fetch balance for default:', e.message);
        }

        statuses.unshift({
          id: 'default',
          name: defaultAccount.name,
          broker: defaultAccount.broker,
          connected: status.connected,
          balance: balance,
          error: status.error || null,
          dailyStats: {
            tradeCount: dailyStats.tradeCount,
            tradesRemaining: dailyStats.tradesRemaining,
            totalProfit: dailyStats.totalProfit,
            totalLoss: dailyStats.totalLoss,
          },
        });
      } catch (error) {
        statuses.unshift({
          id: 'default',
          name: defaultAccount.name,
          broker: defaultAccount.broker,
          connected: false,
          balance: null,
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
