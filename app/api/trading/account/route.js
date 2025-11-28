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
    // Get detailed account info
    const accountDetails = await projectx.getAccountDetails();

    // Get all accounts for verification
    const allAccounts = await projectx.getAllAccounts();

    // Check if using configured account ID
    const configuredAccountId = process.env.PROJECTX_ACCOUNT_ID;

    const response = {
      // Primary account info
      id: accountDetails.id,
      name: accountDetails.name,
      balance: accountDetails.balance,
      canTrade: accountDetails.canTrade,

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
