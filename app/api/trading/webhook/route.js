/**
 * TradingView Webhook Handler
 * Endpoint: POST /api/trading/webhook
 *
 * Expected payload from TradingView:
 * {
 *   "secret": "your-webhook-secret",
 *   "action": "buy|sell|close",
 *   "stop": 6800.00,
 *   "tp": 6850.00
 * }
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');
const riskManager = require('../../../../lib/riskManager');

/**
 * POST handler for TradingView webhooks
 */
export async function POST(request) {
  const startTime = Date.now();

  console.log('\n=== WEBHOOK RECEIVED ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // 1. Parse and validate request body
    const body = await request.json();
    console.log('Payload:', JSON.stringify(body, null, 2));

    // 2. Validate webhook secret
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[Webhook] WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    if (body.secret !== webhookSecret) {
      console.error('[Webhook] Invalid webhook secret');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 3. Validate required fields
    const { action, stop, tp } = body;

    if (!action) {
      console.error('[Webhook] Missing required field: action');
      return NextResponse.json(
        { success: false, error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    const validActions = ['buy', 'sell', 'close'];
    if (!validActions.includes(action.toLowerCase())) {
      console.error(`[Webhook] Invalid action: ${action}`);
      return NextResponse.json(
        { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // 4. Handle CLOSE action (close all positions)
    if (action.toLowerCase() === 'close') {
      console.log('[Webhook] CLOSE action received - not yet implemented');
      return NextResponse.json({
        success: true,
        message: 'Close action acknowledged (implementation pending)',
        action: 'close',
        timestamp: new Date().toISOString(),
      });
    }

    // 5. Validate stop and take profit prices for entry orders
    if (!stop || !tp) {
      console.error('[Webhook] Missing required fields: stop and/or tp');
      return NextResponse.json(
        { success: false, error: 'Missing required fields: stop and tp' },
        { status: 400 }
      );
    }

    // Validate stop and TP make sense based on action
    if (action.toLowerCase() === 'buy') {
      if (stop >= tp) {
        console.error(`[Webhook] Invalid BUY bracket: stop (${stop}) must be < tp (${tp})`);
        return NextResponse.json(
          { success: false, error: 'For BUY orders, stop must be below take profit' },
          { status: 400 }
        );
      }
    } else if (action.toLowerCase() === 'sell') {
      if (stop <= tp) {
        console.error(`[Webhook] Invalid SELL bracket: stop (${stop}) must be > tp (${tp})`);
        return NextResponse.json(
          { success: false, error: 'For SELL orders, stop must be above take profit' },
          { status: 400 }
        );
      }
    }

    // 6. Risk management checks
    const riskCheck = riskManager.canExecuteTrade();
    if (!riskCheck.allowed) {
      console.warn(`[Webhook] Trade blocked by risk management: ${riskCheck.reason}`);
      return NextResponse.json({
        success: false,
        error: 'Trade blocked by risk management',
        reason: riskCheck.reason,
        dailyStats: riskManager.getDailyStats(),
      }, { status: 403 });
    }

    console.log(`[Webhook] Risk check passed: ${riskCheck.reason}`);

    // 7. Execute bracket order via ProjectX API
    console.log(`[Webhook] Executing ${action.toUpperCase()} bracket order...`);
    console.log(`  Entry: Market ${action.toUpperCase()}`);
    console.log(`  Stop Loss: ${stop}`);
    console.log(`  Take Profit: ${tp}`);

    const orderResult = await projectx.placeBracketOrder(
      action.toLowerCase(),
      stop,
      tp,
      1 // 1 contract as per user's preference
    );

    // 8. Record trade in risk manager
    riskManager.recordTrade();

    // 9. Prepare response
    const executionTime = Date.now() - startTime;
    const response = {
      success: true,
      message: `${action.toUpperCase()} order executed successfully`,
      action: action.toLowerCase(),
      orders: {
        entry: orderResult.entry,
        stopLoss: orderResult.stopLoss,
        takeProfit: orderResult.takeProfit,
      },
      prices: {
        stop: stop,
        takeProfit: tp,
      },
      dailyStats: riskManager.getDailyStats(),
      executionTimeMs: executionTime,
      timestamp: new Date().toISOString(),
    };

    console.log('[Webhook] Order executed successfully');
    console.log(`Execution time: ${executionTime}ms`);
    console.log('=== WEBHOOK COMPLETE ===\n');

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    console.error('Stack trace:', error.stack);

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * GET handler - return webhook info
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/trading/webhook',
    method: 'POST',
    description: 'TradingView webhook handler for automated trading',
    requiredFields: ['secret', 'action', 'stop', 'tp'],
    actions: ['buy', 'sell', 'close'],
    example: {
      secret: 'your-webhook-secret',
      action: 'buy',
      stop: 6800.00,
      tp: 6850.00,
    },
  });
}
