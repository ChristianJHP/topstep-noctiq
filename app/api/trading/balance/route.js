/**
 * Account Balance Endpoint
 * Endpoint: GET /api/trading/balance
 *
 * Returns account balance (for authenticated display)
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');

/**
 * GET handler for account balance
 */
export async function GET() {
  console.log('[Balance] Fetching account balance...');

  try {
    const details = await projectx.getAccountDetails();

    return NextResponse.json({
      balance: details.balance,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Balance] Error fetching balance:', error);

    return NextResponse.json({
      balance: null,
      error: 'Unable to fetch balance',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
