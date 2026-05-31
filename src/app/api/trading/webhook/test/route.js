/**
 * Webhook Test Endpoint
 * Validates webhook secret and account configuration without placing trades
 * Endpoint: POST /api/trading/webhook/test
 *
 * Use this to verify your TradingView webhook is configured correctly
 */

import { NextResponse } from 'next/server';

const accounts = require('../../../../../lib/accounts');
const brokers = require('../../../../../lib/brokers');
const riskManager = require('../../../../../lib/riskManager');

export async function POST(request) {
  console.log('\n=== WEBHOOK TEST ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // 1. Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        test: 'parse',
        error: 'Invalid JSON payload',
        hint: 'Make sure your alert message is valid JSON',
      }, { status: 400 });
    }

    console.log('[WebhookTest] Payload:', JSON.stringify(body, null, 2));

    // 2. Validate secret and find account
    let targetAccount = accounts.getAccountBySecret(body.secret);

    if (!targetAccount) {
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (webhookSecret && body.secret === webhookSecret) {
        targetAccount = accounts.getAccount('default');
      }
    }

    if (!targetAccount) {
      return NextResponse.json({
        success: false,
        test: 'authentication',
        error: 'Invalid webhook secret',
        hint: 'Check that your webhook secret matches the one in your Vercel environment variables',
        receivedSecret: body.secret ? `${body.secret.substring(0, 8)}...` : 'none',
      }, { status: 401 });
    }

    console.log(`[WebhookTest] Found account: ${targetAccount.id} (${targetAccount.broker})`);

    // 3. Validate required fields
    const validationErrors = [];

    if (!body.action) {
      validationErrors.push('Missing "action" field (should be "buy", "sell", or "close")');
    } else if (!['buy', 'sell', 'close'].includes(body.action.toLowerCase())) {
      validationErrors.push(`Invalid action "${body.action}" (should be "buy", "sell", or "close")`);
    }

    if (body.action?.toLowerCase() !== 'close') {
      if (body.stop === undefined || body.stop === null) {
        validationErrors.push('Missing "stop" field (stop loss price)');
      } else if (isNaN(parseFloat(body.stop))) {
        validationErrors.push(`Invalid stop price "${body.stop}" (must be a number)`);
      }

      if (body.tp === undefined || body.tp === null) {
        validationErrors.push('Missing "tp" field (take profit price)');
      } else if (isNaN(parseFloat(body.tp))) {
        validationErrors.push(`Invalid tp price "${body.tp}" (must be a number)`);
      }

      // Price range check
      const stopNum = parseFloat(body.stop);
      const tpNum = parseFloat(body.tp);

      if (!isNaN(stopNum) && (stopNum < 10000 || stopNum > 50000)) {
        validationErrors.push(`Stop price ${stopNum} outside MNQ range (10000-50000)`);
      }

      if (!isNaN(tpNum) && (tpNum < 10000 || tpNum > 50000)) {
        validationErrors.push(`TP price ${tpNum} outside MNQ range (10000-50000)`);
      }

      // Bracket logic check
      if (!isNaN(stopNum) && !isNaN(tpNum)) {
        if (body.action?.toLowerCase() === 'buy' && stopNum >= tpNum) {
          validationErrors.push(`BUY bracket invalid: stop (${stopNum}) must be < tp (${tpNum})`);
        }
        if (body.action?.toLowerCase() === 'sell' && stopNum <= tpNum) {
          validationErrors.push(`SELL bracket invalid: stop (${stopNum}) must be > tp (${tpNum})`);
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        test: 'validation',
        errors: validationErrors,
        receivedPayload: body,
        hint: 'Fix the validation errors above',
      }, { status: 400 });
    }

    // 4. Test broker connection
    let brokerClient;
    let brokerStatus;
    try {
      brokerClient = brokers.getBrokerClient(targetAccount);
      brokerStatus = await brokerClient.getAccountStatus();
    } catch (brokerError) {
      return NextResponse.json({
        success: false,
        test: 'broker_connection',
        account: targetAccount.id,
        broker: targetAccount.broker,
        error: brokerError.message,
        hint: 'Check your API credentials in environment variables',
      }, { status: 500 });
    }

    // 5. Check risk management
    const riskCheck = riskManager.canExecuteTrade(null, targetAccount.id);

    // 6. Success response
    return NextResponse.json({
      success: true,
      message: 'Webhook configuration is valid!',
      tests: {
        authentication: 'passed',
        validation: 'passed',
        broker_connection: brokerStatus.connected ? 'passed' : 'warning',
        risk_management: riskCheck.allowed ? 'passed' : 'info',
      },
      account: {
        id: targetAccount.id,
        name: targetAccount.name,
        broker: targetAccount.broker,
        brokerConnected: brokerStatus.connected,
      },
      riskStatus: {
        canTrade: riskCheck.allowed,
        reason: riskCheck.reason,
        dailyStats: riskManager.getDailyStats(targetAccount.id),
      },
      receivedPayload: {
        action: body.action,
        stop: body.stop,
        tp: body.tp,
        symbol: body.symbol || 'MNQ',
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[WebhookTest] Error:', error);
    return NextResponse.json({
      success: false,
      test: 'internal',
      error: error.message,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/trading/webhook/test',
    method: 'POST',
    description: 'Test your webhook configuration without placing real trades',
    examplePayload: {
      secret: 'your-webhook-secret',
      action: 'buy',
      symbol: 'MNQ',
      stop: 21400.00,
      tp: 21600.00,
    },
  });
}
