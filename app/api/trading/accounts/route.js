/**
 * Accounts API
 * Endpoint: GET /api/trading/accounts
 *
 * Returns a list of configured trading accounts (without sensitive data)
 */

import { NextResponse } from 'next/server';

const accounts = require('../../../../lib/accounts');

/**
 * GET handler - returns account list (safe summary)
 */
export async function GET() {
  try {
    const accountSummary = accounts.getAccountSummary();

    return NextResponse.json({
      success: true,
      accounts: accountSummary,
      count: accountSummary.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Accounts API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * POST handler - reload accounts from environment
 */
export async function POST() {
  try {
    const count = accounts.loadAccountsFromEnv();

    return NextResponse.json({
      success: true,
      message: `Reloaded ${count} account(s)`,
      accounts: accounts.getAccountSummary(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Accounts API] Reload error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
