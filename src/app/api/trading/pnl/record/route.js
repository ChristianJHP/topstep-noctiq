/**
 * Record Daily P&L API
 * Endpoint: POST /api/trading/pnl/record
 *
 * Use this to record your daily P&L results manually
 * or from automated balance checking
 */

import { NextResponse } from 'next/server';

const alertStorage = require('../../../../../lib/alertStorage');

export async function POST(request) {
  try {
    const body = await request.json();

    const { accountId, date, pnl, balance, tradeCount } = body;

    // Validate required fields
    if (!accountId) {
      return NextResponse.json({
        success: false,
        error: 'Missing accountId',
      }, { status: 400 });
    }

    if (pnl === undefined || pnl === null) {
      return NextResponse.json({
        success: false,
        error: 'Missing pnl value',
      }, { status: 400 });
    }

    // Use today's date if not specified
    const recordDate = date || new Date().toISOString().split('T')[0];

    // Convert pnl to number
    const pnlValue = parseFloat(pnl);
    if (isNaN(pnlValue)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid pnl value - must be a number',
      }, { status: 400 });
    }

    // Save to storage
    const result = await alertStorage.saveDailyPnL(
      accountId,
      recordDate,
      pnlValue,
      balance ? parseFloat(balance) : null,
      tradeCount ? parseInt(tradeCount, 10) : 0
    );

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Failed to save P&L - check Supabase configuration',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'P&L recorded successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[PnLRecord] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/trading/pnl/record',
    method: 'POST',
    description: 'Record daily P&L results',
    examplePayload: {
      accountId: 'default',
      date: '2024-01-15',
      pnl: 150.50,
      balance: 50150.50,
      tradeCount: 3,
    },
  });
}
