/**
 * Account Information Endpoint
 * Endpoint: GET /api/trading/account
 *
 * Returns:
 * - Account ID, name, and balance
 * - Trading eligibility status
 * - All available accounts (for verification)
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');

/**
 * GET handler for account information
 */
export async function GET() {
  console.log('[Account] Fetching account information...');

  try {
    // Check if using configured account ID
    const configuredAccountId = process.env.PROJECTX_ACCOUNT_ID;

    // Try to get all accounts (may fail depending on API permissions)
    let allAccounts = [];
    try {
      allAccounts = await projectx.getAllAccounts();
    } catch (e) {
      console.log('[Account] Could not fetch all accounts:', e.message);
    }

    // Get account status (more reliable)
    const accountStatus = await projectx.getAccountStatus();

    const response = {
      // Primary account info
      id: configuredAccountId || accountStatus.accountId,
      name: configuredAccountId || 'Configured Account',
      connected: accountStatus.connected,

      // Safety info
      usingConfiguredAccount: !!configuredAccountId,
      configuredAccountId: configuredAccountId || null,

      // All accounts (for verification which is which)
      allAccounts: allAccounts.map(acc => ({
        id: acc.id,
        name: acc.name || acc.accountName,
        balance: acc.balance || acc.accountBalance,
        canTrade: acc.canTrade ?? acc.isActive,
      })),

      timestamp: new Date().toISOString(),
    };

    console.log('[Account] Account info retrieved successfully');
    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Account] Error fetching account info:', error);

    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
