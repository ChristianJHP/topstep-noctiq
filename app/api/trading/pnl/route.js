/**
 * P&L API - Fetches real P&L data from TopStepX Trade/search
 * Returns percentage P&L based on account balance
 */

import { NextResponse } from 'next/server';

const BASE_URL = 'https://api.topstepx.com/api';

async function getToken() {
  const response = await fetch(`${BASE_URL}/Auth/loginKey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName: process.env.PROJECTX_USERNAME,
      apiKey: process.env.PROJECTX_API_KEY,
      authType: 'api_key'
    })
  });

  if (!response.ok) throw new Error('Auth failed');
  const data = await response.json();
  return data.token || data;
}

async function getAccounts(token) {
  const response = await fetch(`${BASE_URL}/Account/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ onlyActiveAccounts: true })
  });

  if (!response.ok) throw new Error('Failed to fetch accounts');
  const data = await response.json();
  return data.accounts || [];
}

async function getTrades(token, accountId, startDate) {
  const response = await fetch(`${BASE_URL}/Trade/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      accountId,
      startTimestamp: startDate.toISOString()
    })
  });

  if (!response.ok) return [];
  const data = await response.json();
  return data.trades || [];
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const token = await getToken();
    const accounts = await getAccounts(token);

    // Get the account (use env var to match or first)
    const targetAccountId = process.env.PROJECTX_ACCOUNT_ID;
    const account = accounts.find(a =>
      a.name === targetAccountId ||
      a.name?.includes(targetAccountId?.split('-').pop() || '')
    ) || accounts[0];

    if (!account) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    const balance = account.balance || 50000;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const trades = await getTrades(token, account.id, startDate);

    // Group trades by date
    const tradesByDate = {};
    trades.forEach(trade => {
      const date = trade.creationTimestamp?.split('T')[0];
      if (!date) return;

      if (!tradesByDate[date]) {
        tradesByDate[date] = { pnl: 0, fees: 0, trades: 0 };
      }

      tradesByDate[date].pnl += trade.profitAndLoss || 0;
      tradesByDate[date].fees += trade.fees || 0;
      tradesByDate[date].trades += 1;
    });

    // Calculate today's P&L
    const today = new Date().toISOString().split('T')[0];
    const todayData = tradesByDate[today] || { pnl: 0, fees: 0, trades: 0 };
    const todayNetPnl = todayData.pnl - todayData.fees;
    const todayPnlPercent = (todayNetPnl / balance) * 100;

    // Calculate total P&L for period
    let totalPnl = 0;
    let totalFees = 0;
    let totalTrades = 0;

    Object.values(tradesByDate).forEach(day => {
      totalPnl += day.pnl;
      totalFees += day.fees;
      totalTrades += day.trades;
    });

    const totalNetPnl = totalPnl - totalFees;
    const totalPnlPercent = (totalNetPnl / balance) * 100;

    // Build daily breakdown
    const dailyPnl = Object.entries(tradesByDate)
      .map(([date, data]) => ({
        date,
        pnlPercent: ((data.pnl - data.fees) / balance) * 100,
        trades: data.trades
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate cumulative
    let cumulative = 0;
    dailyPnl.forEach(day => {
      cumulative += day.pnlPercent;
      day.cumulativePercent = cumulative;
    });

    return NextResponse.json({
      account: {
        id: account.id,
        name: account.name,
        balance
      },
      today: {
        pnlPercent: todayPnlPercent,
        trades: todayData.trades
      },
      period: {
        days,
        pnlPercent: totalPnlPercent,
        trades: totalTrades
      },
      daily: dailyPnl,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[P&L API] Error:', error);
    return NextResponse.json({
      error: error.message,
      today: { pnlPercent: 0, trades: 0 },
      period: { pnlPercent: 0, trades: 0 },
      daily: []
    }, { status: 500 });
  }
}
