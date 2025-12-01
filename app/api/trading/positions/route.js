/**
 * Positions API
 * Endpoint: GET /api/trading/positions
 *
 * Returns current open positions
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');

/**
 * GET handler for positions
 */
export async function GET() {
  console.log('[Positions] Fetching positions...');

  try {
    const positions = await projectx.getPositions();

    return NextResponse.json({
      success: true,
      positions: positions || [],
      count: positions?.length || 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[Positions] Error:', error);

    return NextResponse.json({
      success: false,
      positions: [],
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
