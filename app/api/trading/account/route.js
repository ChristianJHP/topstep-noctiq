/**
 * Account Status Endpoint
 * Endpoint: GET /api/trading/account
 *
 * Returns minimal public-safe account status:
 * - Connection status only
 * - No account IDs, balances, or other sensitive data
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');

/**
 * GET handler for account status
 */
export async function GET() {
  console.log('[Account] Checking account connection...');

  try {
    // Get account status (connection check only)
    const accountStatus = await projectx.getAccountStatus();

    const response = {
      connected: accountStatus.connected,
      timestamp: new Date().toISOString(),
    };

    console.log('[Account] Connection status:', accountStatus.connected ? 'OK' : 'FAILED');
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Account] Error checking connection:', error);

    return NextResponse.json({
      connected: false,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
