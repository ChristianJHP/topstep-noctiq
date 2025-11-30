/**
 * TradingView Webhook Handler
 * Endpoint: POST /api/trading/webhook
 *
 * EDGE CASES HANDLED:
 * - Concurrent webhook protection (mutex lock)
 * - Duplicate webhook detection (idempotency)
 * - TradingView latency tolerance (webhook ID based on 10s windows)
 * - Comprehensive error logging
 * - Graceful degradation on partial bracket failure
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
  let lockAcquired = false;
  let webhookId = null;

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

    // 2.5 CRITICAL SAFETY CHECK: Verify correct account is configured
    // This prevents accidentally trading on a funded account
    const REQUIRED_ACCOUNT_ID = '50KTC-V2-426662-38795180';
    const configuredAccountId = process.env.PROJECTX_ACCOUNT_ID;

    if (!configuredAccountId) {
      console.error('[Webhook] CRITICAL: PROJECTX_ACCOUNT_ID not configured - blocking all trades');
      return NextResponse.json(
        { success: false, error: 'Account ID not configured - trades blocked for safety' },
        { status: 500 }
      );
    }

    if (configuredAccountId !== REQUIRED_ACCOUNT_ID) {
      console.error(`[Webhook] CRITICAL: Wrong account configured! Expected ${REQUIRED_ACCOUNT_ID}, got ${configuredAccountId}`);
      return NextResponse.json(
        { success: false, error: 'Wrong account configured - trades blocked for safety' },
        { status: 500 }
      );
    }

    console.log(`[Webhook] Account safety check passed: ${configuredAccountId}`);

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

    // 5.5 Generate webhook ID for idempotency
    // Uses 10-second windows to handle TradingView's potential latency
    webhookId = riskManager.generateWebhookId(body);
    console.log(`[Webhook] Generated webhook ID: ${webhookId}`);

    // 6. Acquire lock for concurrent protection
    console.log('[Webhook] Acquiring trade lock...');
    try {
      await riskManager.acquireLock(5000); // 5 second timeout
      lockAcquired = true;
      console.log('[Webhook] Trade lock acquired');
    } catch (lockError) {
      console.error('[Webhook] Failed to acquire trade lock:', lockError.message);
      return NextResponse.json({
        success: false,
        error: 'System busy - another trade is being processed',
        reason: lockError.message,
      }, { status: 503 });
    }

    // 7. Risk management checks (with idempotency check)
    const riskCheck = riskManager.canExecuteTrade(webhookId);
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

    // 8. Execute bracket order via ProjectX API
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

    // 9. Record trade in risk manager with details
    const tradeRecord = riskManager.recordTrade({
      webhookId: webhookId,
      action: action.toLowerCase(),
      stopPrice: stop,
      takeProfitPrice: tp,
      entryOrder: orderResult.entry,
      stopOrder: orderResult.stopLoss,
      tpOrder: orderResult.takeProfit,
      partial: orderResult.partial || false,
    });

    // 10. Prepare response
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

    // Add warning if bracket was partial (TP failed but SL in place)
    if (orderResult.partial) {
      response.warning = orderResult.warning;
      response.tpError = orderResult.tpError;
      console.warn(`[Webhook] Partial bracket: ${orderResult.warning}`);
    }

    console.log('[Webhook] Order executed successfully');
    console.log(`Execution time: ${executionTime}ms`);
    console.log('=== WEBHOOK COMPLETE ===\n');

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    console.error('Stack trace:', error.stack);

    // Check if this is an unprotected position error
    if (error.message?.includes('UNPROTECTED POSITION')) {
      console.error('[Webhook] CRITICAL: Unprotected position detected!');
      return NextResponse.json({
        success: false,
        error: error.message,
        critical: true,
        action: 'MANUAL_INTERVENTION_REQUIRED',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });

  } finally {
    // Always release lock
    if (lockAcquired) {
      riskManager.releaseLock();
      console.log('[Webhook] Trade lock released');
    }
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
    features: [
      'Concurrent webhook protection (mutex)',
      'Duplicate webhook detection (idempotency)',
      'TradingView latency tolerance (10s windows)',
      'Automatic retry with exponential backoff',
      'Graceful partial bracket handling',
    ],
    example: {
      secret: 'your-webhook-secret',
      action: 'buy',
      stop: 6800.00,
      tp: 6850.00,
    },
  });
}
