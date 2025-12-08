/**
 * P&L API - Fetches real P&L data from both TopStepX and The Futures Desk
 * Returns percentage P&L based on account balance for each broker
 */

import { NextResponse } from 'next/server';

const BROKERS = {
  tsx: {
    name: 'TopStepX',
    baseUrl: 'https://api.topstepx.com/api',
    getUsernameEnv: () => process.env.PROJECTX_USERNAME,
    getApiKeyEnv: () => process.env.PROJECTX_API_KEY,
    getAccountIdEnv: () => process.env.PROJECTX_ACCOUNT_ID,
  },
  tfd: {
    name: 'The Futures Desk',
    baseUrl: 'https://api.thefuturesdesk.projectx.com/api',
    // Support both naming conventions: ACCOUNT_TFD_* and ACCOUNT_FUTURESDESK_*
    getUsernameEnv: () => process.env.ACCOUNT_TFD_USERNAME || process.env.ACCOUNT_FUTURESDESK_USERNAME,
    getApiKeyEnv: () => process.env.ACCOUNT_TFD_API_KEY || process.env.ACCOUNT_FUTURESDESK_API_KEY,
    getAccountIdEnv: () => process.env.ACCOUNT_TFD_ACCOUNT_ID || process.env.ACCOUNT_FUTURESDESK_ACCOUNT_ID,
  }
};

async function fetchBrokerPnL(brokerId, days) {
  const broker = BROKERS[brokerId];
  if (!broker) return null;

  const username = broker.getUsernameEnv();
  const apiKey = broker.getApiKeyEnv();

  if (!username || !apiKey) {
    console.log(`[P&L] ${broker.name}: No credentials configured`);
    return null;
  }

  try {
    // Auth
    const authResponse = await fetch(`${broker.baseUrl}/Auth/loginKey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: username, apiKey, authType: 'api_key' })
    });

    if (!authResponse.ok) {
      console.error(`[P&L] ${broker.name}: Auth failed`);
      return null;
    }

    const authData = await authResponse.json();
    const token = authData.token || authData;

    // Get accounts
    const accountResponse = await fetch(`${broker.baseUrl}/Account/search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ onlyActiveAccounts: true })
    });

    if (!accountResponse.ok) {
      console.error(`[P&L] ${broker.name}: Account search failed`);
      return null;
    }

    const accountData = await accountResponse.json();
    const accounts = accountData.accounts || [];

    if (accounts.length === 0) {
      console.log(`[P&L] ${broker.name}: No accounts found`);
      return null;
    }

    // Find target account
    const targetId = broker.getAccountIdEnv();
    const account = accounts.find(a =>
      a.name === targetId ||
      a.name?.includes(targetId?.split('-').pop() || '')
    ) || accounts[0];

    const balance = account.balance || 50000;

    // Get trades
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const tradeResponse = await fetch(`${broker.baseUrl}/Trade/search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId: account.id, startTimestamp: startDate.toISOString() })
    });

    const trades = tradeResponse.ok ? (await tradeResponse.json()).trades || [] : [];

    // Group trades by date
    const tradesByDate = {};
    trades.forEach(trade => {
      const date = trade.creationTimestamp?.split('T')[0];
      if (!date) return;
      if (!tradesByDate[date]) tradesByDate[date] = { pnl: 0, fees: 0, trades: 0 };
      tradesByDate[date].pnl += trade.profitAndLoss || 0;
      tradesByDate[date].fees += trade.fees || 0;
      tradesByDate[date].trades += 1;
    });

    // Calculate today
    const today = new Date().toISOString().split('T')[0];
    const todayData = tradesByDate[today] || { pnl: 0, fees: 0, trades: 0 };
    const todayNetPnl = todayData.pnl - todayData.fees;
    const todayPnlPercent = (todayNetPnl / balance) * 100;

    // Calculate period total
    let totalPnl = 0, totalFees = 0, totalTrades = 0;
    Object.values(tradesByDate).forEach(day => {
      totalPnl += day.pnl;
      totalFees += day.fees;
      totalTrades += day.trades;
    });
    const totalPnlPercent = ((totalPnl - totalFees) / balance) * 100;

    // Daily breakdown
    const dailyPnl = Object.entries(tradesByDate)
      .map(([date, data]) => ({
        date,
        pnlPercent: ((data.pnl - data.fees) / balance) * 100,
        trades: data.trades
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    let cumulative = 0;
    dailyPnl.forEach(day => {
      cumulative += day.pnlPercent;
      day.cumulativePercent = cumulative;
    });

    return {
      broker: brokerId,
      brokerName: broker.name,
      account: { id: account.id, name: account.name, balance },
      today: {
        pnl: todayNetPnl,  // Dollar amount
        pnlPercent: todayPnlPercent,
        trades: todayData.trades
      },
      period: {
        days,
        pnl: totalPnl - totalFees,  // Dollar amount
        pnlPercent: totalPnlPercent,
        trades: totalTrades
      },
      daily: dailyPnl,
      connected: true
    };

  } catch (error) {
    console.error(`[P&L] ${broker.name}: Error -`, error.message);
    return { broker: brokerId, brokerName: broker.name, connected: false, error: error.message };
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const brokerFilter = searchParams.get('broker'); // Optional: 'tsx' or 'tfd'

    // Fetch from all brokers in parallel (or just one if filtered)
    const brokerIds = brokerFilter ? [brokerFilter] : Object.keys(BROKERS);
    const results = await Promise.all(brokerIds.map(id => fetchBrokerPnL(id, days)));

    // Build response
    const brokers = {};
    let combinedToday = { pnl: 0, pnlPercent: 0, trades: 0 };
    let combinedPeriod = { pnl: 0, pnlPercent: 0, trades: 0 };
    let activeBrokers = 0;

    results.forEach(result => {
      if (!result) return;
      brokers[result.broker] = result;

      if (result.connected && result.today) {
        combinedToday.pnl += result.today.pnl || 0;
        combinedToday.pnlPercent += result.today.pnlPercent || 0;
        combinedToday.trades += result.today.trades || 0;
        combinedPeriod.pnl += result.period?.pnl || 0;
        combinedPeriod.pnlPercent += result.period?.pnlPercent || 0;
        combinedPeriod.trades += result.period?.trades || 0;
        activeBrokers++;
      }
    });

    return NextResponse.json({
      brokers,
      combined: activeBrokers > 0 ? {
        today: combinedToday,
        period: { days, ...combinedPeriod },
        activeBrokers
      } : null,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[P&L API] Error:', error);
    return NextResponse.json({ error: error.message, brokers: {} }, { status: 500 });
  }
}
