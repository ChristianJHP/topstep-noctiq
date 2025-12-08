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
 * - Multi-account routing via webhook secret
 *
 * Expected payload from TradingView:
 * {
 *   "secret": "your-webhook-secret",
 *   "action": "buy|sell|close",
 *   "symbol": "MNQ",
 *   "stop": 25350.00,
 *   "tp": 25500.00,
 *   "account": "optional-account-id"
 * }
 *
 * MULTI-ACCOUNT SUPPORT:
 * - Each webhook secret maps to a specific account
 * - Alternatively, specify "account" field to target specific account
 * - Supports TopStepX/ProjectX, Futures Desk, and more
 */

import { NextResponse } from 'next/server';

const projectx = require('../../../../lib/projectx');
const riskManager = require('../../../../lib/riskManager');
const accounts = require('../../../../lib/accounts');
const brokers = require('../../../../lib/brokers');
const alertStorage = require('../../../../lib/alertStorage');

/**
 * Tick sizes for supported symbols
 * Prices must be rounded to these increments for valid orders
 */
const TICK_SIZES = {
  MNQ: 0.25,
  MES: 0.25,
  MCL: 0.01,
};

/**
 * Copy Trading Configuration
 * Maps master account IDs to follower account IDs
 * When master receives a signal, followers automatically copy the trade
 */
const COPY_TRADE_CONFIG = {
  // 'default' (TopStep) is the master, 'futuresdesk' copies its trades
  'default': ['futuresdesk'],
  // Add more mappings as needed:
  // 'topstep2': ['futuresdesk2', 'futuresdesk3'],
};

/**
 * Get accounts that should copy trades from a master account
 */
function getCopyTradeAccounts(masterAccountId) {
  const followerIds = COPY_TRADE_CONFIG[masterAccountId] || [];
  return followerIds
    .map(id => accounts.getAccount(id))
    .filter(account => account && account.enabled);
}

/**
 * Round a price to the nearest valid tick size for the given symbol
 * @param {number} price - The price to round
 * @param {string} symbol - The trading symbol (MNQ, MES, MCL)
 * @returns {number} - Price rounded to nearest tick
 */
function roundToTick(price, symbol) {
  const tickSize = TICK_SIZES[symbol] || TICK_SIZES.MNQ; // Default to MNQ tick size
  const rounded = Math.round(price / tickSize) * tickSize;
  // Fix floating point precision issues
  const decimals = tickSize === 0.01 ? 2 : 2;
  return parseFloat(rounded.toFixed(decimals));
}

/**
 * POST handler for TradingView webhooks
 */
export async function POST(request) {
  const startTime = Date.now();
  let lockAcquired = false;
  let webhookId = null;
  let targetAccount = null;
  let parsedBody = null;

  console.log('\n=== WEBHOOK RECEIVED ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // 1. Parse and validate request body
    let body;
    try {
      body = await request.json();
      parsedBody = body;
    } catch (parseError) {
      console.error('[Webhook] Invalid JSON payload:', parseError.message);
      // Save failed alert
      await alertStorage.saveAlert({
        action: 'unknown',
        symbol: 'MNQ',
        account: 'unknown',
        status: 'failed',
        error: 'Invalid JSON payload',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
    console.log('Payload:', JSON.stringify(body, null, 2));

    // 2. Validate webhook secret and resolve account(s)
    // First try to find account by secret (multi-account mode)
    targetAccount = accounts.getAccountBySecret(body.secret);

    // Fallback to legacy single-account mode
    if (!targetAccount) {
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (webhookSecret && body.secret === webhookSecret) {
        targetAccount = accounts.getAccount('default');
      }
    }

    // If explicit account specified in payload, use that
    if (body.account) {
      const explicitAccount = accounts.getAccount(body.account);
      if (explicitAccount) {
        // Verify secret matches this account (security check)
        if (explicitAccount.webhookSecret && explicitAccount.webhookSecret !== body.secret) {
          console.error(`[Webhook] Secret mismatch for account ${body.account}`);
          return NextResponse.json(
            { success: false, error: 'Unauthorized for specified account' },
            { status: 401 }
          );
        }
        targetAccount = explicitAccount;
      } else {
        console.error(`[Webhook] Account not found: ${body.account}`);
        return NextResponse.json(
          { success: false, error: `Account not found: ${body.account}` },
          { status: 404 }
        );
      }
    }

    if (!targetAccount) {
      console.error('[Webhook] Invalid webhook secret or no account configured');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!targetAccount.enabled) {
      console.error(`[Webhook] Account ${targetAccount.id} is disabled`);
      return NextResponse.json(
        { success: false, error: 'Account is disabled' },
        { status: 403 }
      );
    }

    console.log(`[Webhook] Routing to account: ${targetAccount.id} (${targetAccount.broker})`);

    // COPY TRADING: Get accounts that should copy this account's trades
    const copyTradeAccounts = getCopyTradeAccounts(targetAccount.id);
    if (copyTradeAccounts.length > 0) {
      console.log(`[Webhook] Copy trading enabled: ${copyTradeAccounts.map(a => a.id).join(', ')} will copy ${targetAccount.id}`);
    }

    // Get broker client for this account
    let brokerClient;
    try {
      brokerClient = brokers.getBrokerClient(targetAccount);
    } catch (brokerError) {
      console.error(`[Webhook] Failed to get broker client: ${brokerError.message}`);
      return NextResponse.json(
        { success: false, error: 'Trading service unavailable' },
        { status: 500 }
      );
    }

    console.log(`[Webhook] Using broker: ${brokerClient.name}`);

    // 3. Validate required fields
    const { action, symbol, stop, tp } = body;

    // Log symbol if provided
    if (symbol) {
      console.log(`[Webhook] Symbol: ${symbol}`);
    }

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
      console.log('[Webhook] CLOSE action received - closing all positions');

      try {
        const closeResult = await brokerClient.closeAllPositions(symbol || 'MNQ');

        console.log(`[Webhook] Close result: ${JSON.stringify(closeResult)}`);

        // Save alert to persistent storage
        await alertStorage.saveAlert({
          action: 'close',
          symbol: symbol || 'MNQ',
          account: targetAccount.id,
          status: closeResult.success ? 'success' : 'failed',
          closedPositions: closeResult.closedPositions,
        });

        // COPY TRADING: Close positions on follower accounts too
        const copyCloseResults = [];
        if (copyTradeAccounts.length > 0) {
          console.log(`[Webhook] Closing positions on ${copyTradeAccounts.length} follower account(s)...`);

          for (const followerAccount of copyTradeAccounts) {
            try {
              const followerBrokerClient = brokers.getBrokerClient(followerAccount);
              const followerCloseResult = await followerBrokerClient.closeAllPositions(symbol || 'MNQ');

              copyCloseResults.push({
                account: followerAccount.id,
                success: followerCloseResult.success,
                closedPositions: followerCloseResult.closedPositions,
              });

              await alertStorage.saveAlert({
                action: 'close',
                symbol: symbol || 'MNQ',
                account: followerAccount.id,
                status: followerCloseResult.success ? 'success' : 'failed',
                closedPositions: followerCloseResult.closedPositions,
                copiedFrom: targetAccount.id,
              });

            } catch (copyCloseError) {
              console.error(`[Webhook] Failed to close positions on ${followerAccount.id}:`, copyCloseError.message);
              copyCloseResults.push({
                account: followerAccount.id,
                success: false,
                error: copyCloseError.message,
              });
            }
          }
        }

        return NextResponse.json({
          success: closeResult.success,
          message: closeResult.closedPositions > 0
            ? `Closed ${closeResult.closedPositions} position(s)`
            : 'No open positions to close',
          action: 'close',
          symbol: symbol || 'MNQ',
          account: targetAccount.id,
          broker: targetAccount.broker,
          closedPositions: closeResult.closedPositions,
          errors: closeResult.errors,
          copyTrades: copyCloseResults.length > 0 ? copyCloseResults : undefined,
          timestamp: new Date().toISOString(),
        });
      } catch (closeError) {
        console.error('[Webhook] Error closing positions:', closeError);

        // Save failed alert
        await alertStorage.saveAlert({
          action: 'close',
          symbol: symbol || 'MNQ',
          account: targetAccount.id,
          status: 'failed',
          error: closeError.message,
        });

        return NextResponse.json({
          success: false,
          error: `Failed to close positions: ${closeError.message}`,
          action: 'close',
          account: targetAccount.id,
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      }
    }

    // 5. Validate stop and take profit prices for entry orders
    if (stop === undefined || stop === null || tp === undefined || tp === null) {
      console.error('[Webhook] Missing required fields: stop and/or tp');
      // Save failed alert
      await alertStorage.saveAlert({
        action: action?.toLowerCase() || 'unknown',
        symbol: symbol || 'MNQ',
        account: targetAccount?.id || 'unknown',
        status: 'failed',
        error: 'Missing stop and/or tp prices',
      });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: stop and tp' },
        { status: 400 }
      );
    }

    // Validate prices are valid numbers
    const stopNum = parseFloat(stop);
    const tpNum = parseFloat(tp);

    if (isNaN(stopNum) || isNaN(tpNum)) {
      console.error(`[Webhook] Invalid price format: stop=${stop}, tp=${tp}`);
      return NextResponse.json(
        { success: false, error: 'Stop and TP must be valid numbers' },
        { status: 400 }
      );
    }

    if (stopNum <= 0 || tpNum <= 0) {
      console.error(`[Webhook] Invalid price values: stop=${stopNum}, tp=${tpNum}`);
      return NextResponse.json(
        { success: false, error: 'Stop and TP must be positive numbers' },
        { status: 400 }
      );
    }

    // Sanity check: prices should be reasonable for MNQ (10000 - 50000 range)
    if (stopNum < 10000 || stopNum > 50000 || tpNum < 10000 || tpNum > 50000) {
      console.error(`[Webhook] Price out of expected range: stop=${stopNum}, tp=${tpNum}`);
      return NextResponse.json(
        { success: false, error: 'Prices appear to be outside valid MNQ range (10000-50000)' },
        { status: 400 }
      );
    }

    // Validate stop and TP make sense based on action
    if (action.toLowerCase() === 'buy') {
      if (stopNum >= tpNum) {
        console.error(`[Webhook] Invalid BUY bracket: stop (${stopNum}) must be < tp (${tpNum})`);
        return NextResponse.json(
          { success: false, error: 'For BUY orders, stop must be below take profit' },
          { status: 400 }
        );
      }
    } else if (action.toLowerCase() === 'sell') {
      if (stopNum <= tpNum) {
        console.error(`[Webhook] Invalid SELL bracket: stop (${stopNum}) must be > tp (${tpNum})`);
        return NextResponse.json(
          { success: false, error: 'For SELL orders, stop must be above take profit' },
          { status: 400 }
        );
      }
    }

    // 5.5 Round prices to valid tick size for the symbol
    const tradingSymbol = symbol || 'MNQ';
    const stopRounded = roundToTick(stopNum, tradingSymbol);
    const tpRounded = roundToTick(tpNum, tradingSymbol);

    if (stopRounded !== stopNum || tpRounded !== tpNum) {
      console.log(`[Webhook] Tick rounding applied for ${tradingSymbol}:`);
      console.log(`  Stop: ${stopNum} → ${stopRounded}`);
      console.log(`  TP: ${tpNum} → ${tpRounded}`);
    }

    // 5.6 Generate webhook ID for idempotency
    // Uses 10-second windows to handle TradingView's potential latency
    webhookId = riskManager.generateWebhookId(body);
    console.log(`[Webhook] Generated webhook ID: ${webhookId}`);

    // 6. Acquire lock for concurrent protection (per account)
    console.log(`[Webhook] Acquiring trade lock for ${targetAccount.id}...`);
    try {
      await riskManager.acquireLock(5000, targetAccount.id); // 5 second timeout, per account
      lockAcquired = true;
      console.log(`[Webhook] Trade lock acquired for ${targetAccount.id}`);
    } catch (lockError) {
      console.error('[Webhook] Failed to acquire trade lock:', lockError.message);
      return NextResponse.json({
        success: false,
        error: 'System busy - another trade is being processed',
        reason: lockError.message,
      }, { status: 503 });
    }

    // 7. Risk management checks (with idempotency check, per account)
    const riskCheck = riskManager.canExecuteTrade(webhookId, targetAccount.id);
    if (!riskCheck.allowed) {
      console.warn(`[Webhook] Trade blocked by risk management: ${riskCheck.reason}`);
      // Save blocked alert
      await alertStorage.saveAlert({
        action: action?.toLowerCase() || 'unknown',
        symbol: symbol || 'MNQ',
        account: targetAccount.id,
        status: 'blocked',
        stop: stopRounded,
        tp: tpRounded,
        error: `Risk management: ${riskCheck.reason}`,
      });
      return NextResponse.json({
        success: false,
        error: 'Trade blocked by risk management',
        reason: riskCheck.reason,
        dailyStats: riskManager.getDailyStats(targetAccount.id),
      }, { status: 403 });
    }

    console.log(`[Webhook] Risk check passed: ${riskCheck.reason}`);

    // 7.5 POSITION STATE RECONCILIATION
    // Query current position state by checking open orders (Position API returns 404 on TopStepX)
    // If there are working SL/TP orders, we're in a position
    console.log('[Webhook] Checking current position state via open orders...');

    let positionSize = 0;
    let positionSide = 'flat'; // 'long', 'short', or 'flat'
    let positionApiAvailable = true;

    try {
      const openOrders = await brokerClient.getOpenOrders();
      console.log(`[Webhook] Open orders: ${JSON.stringify(openOrders)}`);

      // Find MNQ stop orders - these indicate we have a position
      // If we have a SELL stop (side=1), we're LONG (stop protects long position)
      // If we have a BUY stop (side=0), we're SHORT (stop protects short position)
      const targetSymbol = symbol || 'MNQ';
      const mnqStopOrders = openOrders.filter(o =>
        (o.type === 4 || o.type === 'Stop') && // Stop order
        (o.contractId?.includes('MNQ') || o.contractName?.includes('MNQ') || o.symbol?.includes(targetSymbol))
      );

      if (mnqStopOrders.length > 0) {
        const stopOrder = mnqStopOrders[0];
        // side: 0 = Buy, 1 = Sell
        if (stopOrder.side === 1 || stopOrder.side === 'Sell') {
          positionSide = 'long';
          positionSize = stopOrder.size || 3;
        } else if (stopOrder.side === 0 || stopOrder.side === 'Buy') {
          positionSide = 'short';
          positionSize = stopOrder.size || 3;
        }
        console.log(`[Webhook] Detected ${positionSide} position (${positionSize} contracts) from open stop order`);
      } else {
        console.log('[Webhook] No open stop orders - assuming flat position');
      }
    } catch (orderError) {
      console.warn('[Webhook] Could not fetch open orders:', orderError.message);
      console.log('[Webhook] Proceeding with trade - assuming flat position');
      positionApiAvailable = false;
    }

    const intendedAction = action.toLowerCase();
    const intendedSide = intendedAction === 'buy' ? 'long' : 'short';

    // Determine what action to take based on current state
    // If position API not available, always execute (can't check current state)
    let actionToTake = 'execute'; // 'execute', 'skip', 'reverse'
    let skipReason = null;

    if (positionApiAvailable) {
      if (positionSide === intendedSide) {
        // Already in the same direction - skip this signal
        actionToTake = 'skip';
        skipReason = `Already ${positionSide} ${Math.abs(positionSize)} contract(s) - skipping duplicate ${intendedAction} signal`;
      } else if (positionSide !== 'flat' && positionSide !== intendedSide) {
        // Need to reverse - flatten first, then enter new direction
        actionToTake = 'reverse';
      }
    } else {
      console.log('[Webhook] Position API unavailable - executing trade without position reconciliation');
    }

    console.log(`[Webhook] Position reconciliation: current=${positionSide}, intended=${intendedSide}, action=${actionToTake}`);

    // Handle skip case - already in correct position
    if (actionToTake === 'skip') {
      console.log(`[Webhook] ${skipReason}`);

      await alertStorage.saveAlert({
        action: intendedAction,
        symbol: symbol || 'MNQ',
        account: targetAccount.id,
        status: 'skipped',
        reason: skipReason,
        currentPosition: positionSide,
      });

      return NextResponse.json({
        success: true,
        message: skipReason,
        action: intendedAction,
        skipped: true,
        currentPosition: {
          side: positionSide,
          size: Math.abs(positionSize),
        },
        account: targetAccount.id,
        broker: targetAccount.broker,
        timestamp: new Date().toISOString(),
      });
    }

    // NOTE: Reversal is now handled inside placeBracketOrder
    // We pass the detected position info so it can flatten before entering
    // This is more reliable than the old approach that used Position API

    // 8. Execute bracket order via broker client
    // Pass detected position info so bracket order can handle flattening
    console.log(`[Webhook] Executing ${action.toUpperCase()} bracket order on ${targetAccount.id}...`);
    console.log(`  Account: ${targetAccount.id} (${targetAccount.broker})`);
    console.log(`  Entry: Market ${action.toUpperCase()}`);
    console.log(`  Stop Loss: ${stopRounded}`);
    console.log(`  Take Profit: ${tpRounded}`);
    console.log(`  Detected position: ${positionSide} (${positionSize} contracts)`);
    console.log(`  Action to take: ${actionToTake}`);

    // TopStep trades 5 contracts, TFD trades 3
    const contractQty = targetAccount.id === 'default' ? 5 : 3;

    const orderResult = await brokerClient.placeBracketOrder(
      action.toLowerCase(),
      stopRounded,
      tpRounded,
      contractQty,
      {
        skipCleanup: false,  // Always let bracket order handle cleanup
        detectedSide: actionToTake === 'reverse' ? positionSide : null,  // Pass position to flatten
        detectedSize: actionToTake === 'reverse' ? positionSize : 0,
      }
    );

    // 9. Record trade in risk manager with details
    const tradeRecord = riskManager.recordTrade({
      webhookId: webhookId,
      action: action.toLowerCase(),
      symbol: symbol || 'MNQ',
      accountId: targetAccount.id,
      broker: targetAccount.broker,
      stopPrice: stopRounded,
      takeProfitPrice: tpRounded,
      entryOrder: orderResult.entry,
      stopOrder: orderResult.stopLoss,
      tpOrder: orderResult.takeProfit,
      partial: orderResult.partial || false,
    });

    // 10. Prepare response
    const executionTime = Date.now() - startTime;
    const wasReversal = actionToTake === 'reverse';
    const response = {
      success: true,
      message: wasReversal
        ? `Reversed from ${positionSide} to ${intendedSide} successfully`
        : `${action.toUpperCase()} order executed successfully`,
      action: action.toLowerCase(),
      account: targetAccount.id,
      broker: targetAccount.broker,
      orders: {
        entry: orderResult.entry,
        stopLoss: orderResult.stopLoss,
        runnerStop: orderResult.runnerStop,
        takeProfit: orderResult.takeProfit,
      },
      prices: {
        stop: stopRounded,
        takeProfit: tpRounded,
      },
      breakdown: orderResult.breakdown,  // Include contract split info
      positionReconciliation: {
        previousPosition: positionSide,
        intendedPosition: intendedSide,
        actionTaken: actionToTake,
        wasReversal: wasReversal,
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

    // Save alert to persistent storage
    await alertStorage.saveAlert({
      action: action.toLowerCase(),
      symbol: symbol || 'MNQ',
      account: targetAccount.id,
      status: orderResult.partial ? 'partial' : 'success',
      stop: stopRounded,
      tp: tpRounded,
    });

    console.log('[Webhook] Order executed successfully');
    console.log(`Execution time: ${executionTime}ms`);

    // COPY TRADING: Execute same trade on follower accounts
    const copyResults = [];
    if (copyTradeAccounts.length > 0) {
      console.log(`[Webhook] Executing copy trades on ${copyTradeAccounts.length} follower account(s)...`);

      for (const followerAccount of copyTradeAccounts) {
        try {
          console.log(`[Webhook] Copy trading to ${followerAccount.id}...`);

          const followerBrokerClient = brokers.getBrokerClient(followerAccount);

          // Get follower's current position state
          let followerPositionSide = 'flat';
          let followerPositionSize = 0;
          try {
            const followerOrders = await followerBrokerClient.getOpenOrders();
            const followerStopOrders = followerOrders.filter(o =>
              (o.type === 4 || o.type === 'Stop') &&
              (o.contractName?.includes('MNQ') || o.symbol?.includes('MNQ'))
            );
            if (followerStopOrders.length > 0) {
              const stopOrder = followerStopOrders[0];
              if (stopOrder.side === 1 || stopOrder.side === 'Sell') {
                followerPositionSide = 'long';
                followerPositionSize = stopOrder.size || 3;
              } else if (stopOrder.side === 0 || stopOrder.side === 'Buy') {
                followerPositionSide = 'short';
                followerPositionSize = stopOrder.size || 3;
              }
            }
          } catch (e) {
            console.warn(`[Webhook] Could not detect follower position: ${e.message}`);
          }

          // Determine if follower needs to reverse
          const followerIntendedSide = action.toLowerCase() === 'buy' ? 'long' : 'short';
          const followerNeedsReverse = followerPositionSide !== 'flat' && followerPositionSide !== followerIntendedSide;

          const copyResult = await followerBrokerClient.placeBracketOrder(
            action.toLowerCase(),
            stopRounded,
            tpRounded,
            5,  // Same as TopStep - 5 contracts
            {
              skipCleanup: false,
              detectedSide: followerNeedsReverse ? followerPositionSide : null,
              detectedSize: followerNeedsReverse ? followerPositionSize : 0,
            }
          );

          copyResults.push({
            account: followerAccount.id,
            success: copyResult.success,
            partial: copyResult.partial || false,
          });

          console.log(`[Webhook] Copy trade to ${followerAccount.id} successful`);

          // Save alert for follower
          await alertStorage.saveAlert({
            action: action.toLowerCase(),
            symbol: symbol || 'MNQ',
            account: followerAccount.id,
            status: copyResult.partial ? 'partial' : 'success',
            stop: stopRounded,
            tp: tpRounded,
            copiedFrom: targetAccount.id,
          });

        } catch (copyError) {
          console.error(`[Webhook] Copy trade to ${followerAccount.id} FAILED:`, copyError.message);
          copyResults.push({
            account: followerAccount.id,
            success: false,
            error: copyError.message,
          });

          // Save failed alert for follower
          await alertStorage.saveAlert({
            action: action.toLowerCase(),
            symbol: symbol || 'MNQ',
            account: followerAccount.id,
            status: 'failed',
            error: copyError.message,
            copiedFrom: targetAccount.id,
          });
        }
      }

      response.copyTrades = copyResults;
      console.log(`[Webhook] Copy trading complete: ${copyResults.filter(r => r.success).length}/${copyResults.length} successful`);
    }

    console.log('=== WEBHOOK COMPLETE ===\n');

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    console.error('Stack trace:', error.stack);

    // Save failed alert with error details
    try {
      await alertStorage.saveAlert({
        action: parsedBody?.action?.toLowerCase() || 'unknown',
        symbol: parsedBody?.symbol || 'MNQ',
        account: targetAccount?.id || 'unknown',
        status: 'failed',
        stop: parsedBody?.stop,
        tp: parsedBody?.tp,
        error: error.message,
      });
    } catch (saveError) {
      console.error('[Webhook] Failed to save error alert:', saveError.message);
    }

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
    // Always release lock (need targetAccount.id, but it might not be defined if error occurred early)
    if (lockAcquired) {
      // targetAccount is defined if we acquired the lock
      riskManager.releaseLock(targetAccount?.id || 'default');
      console.log(`[Webhook] Trade lock released for ${targetAccount?.id || 'default'}`);
    }
  }
}

/**
 * GET handler - minimal info for public
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    method: 'POST',
    timestamp: new Date().toISOString(),
  });
}
