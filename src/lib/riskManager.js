/**
 * Risk Management Module
 * Enforces trading rules and safety limits PER ACCOUNT
 *
 * EDGE CASES HANDLED:
 * - Futures market hours (Sun 6PM - Fri 5PM ET)
 * - Daily reset uses proper ET timezone
 * - Concurrent trade protection via mutex (per account)
 * - Idempotency tracking for duplicate webhooks
 * - Independent risk limits per trading account
 */

const futuresMarket = require('./futuresMarket');

// Mutex for concurrent trade execution (per account)
const tradeMutexes = new Map(); // accountId -> { locked: boolean }

// Recent webhook IDs for idempotency (prevent duplicate orders)
let recentWebhooks = new Map(); // webhookId -> timestamp
const WEBHOOK_IDEMPOTENCY_WINDOW_MS = 30000; // 30 seconds

// Per-account daily stats storage
// Map<accountId, { date, tradeCount, totalLoss, totalProfit, lastTradeTime }>
const accountStats = new Map();

// Trade history storage (in-memory, resets on server restart)
let tradeHistory = [];

const RISK_LIMITS = {
  MAX_TRADES_PER_DAY: 8,
  MAX_DAILY_LOSS: 400, // USD
  COOLDOWN_SECONDS: 60,
};

/**
 * Get or create mutex for an account
 */
function getAccountMutex(accountId) {
  const id = accountId || 'default';
  if (!tradeMutexes.has(id)) {
    tradeMutexes.set(id, { locked: false });
  }
  return tradeMutexes.get(id);
}

/**
 * Acquire mutex lock for trade execution (per account)
 * Prevents concurrent webhooks from bypassing risk limits
 */
async function acquireLock(timeoutMs = 5000, accountId = 'default') {
  const startTime = Date.now();
  const mutex = getAccountMutex(accountId);

  while (mutex.locked) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Trade lock timeout for account ${accountId} - system busy`);
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  mutex.locked = true;
  return true;
}

/**
 * Release mutex lock (per account)
 */
function releaseLock(accountId = 'default') {
  const mutex = getAccountMutex(accountId);
  mutex.locked = false;
}

/**
 * Check if a webhook ID was recently processed (idempotency check)
 * Returns true if this is a duplicate
 */
function isDuplicateWebhook(webhookId) {
  if (!webhookId) return false;

  // Clean old entries
  const now = Date.now();
  for (const [id, timestamp] of recentWebhooks.entries()) {
    if (now - timestamp > WEBHOOK_IDEMPOTENCY_WINDOW_MS) {
      recentWebhooks.delete(id);
    }
  }

  // Check if this webhook was recently processed
  if (recentWebhooks.has(webhookId)) {
    console.log(`[RiskManager] Duplicate webhook detected: ${webhookId}`);
    return true;
  }

  return false;
}

/**
 * Mark a webhook as processed
 */
function markWebhookProcessed(webhookId) {
  if (webhookId) {
    recentWebhooks.set(webhookId, Date.now());
  }
}

/**
 * Get current date in ET timezone (YYYY-MM-DD)
 */
function getETDateString() {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/**
 * Get or create daily stats for an account
 */
function getAccountStats(accountId) {
  const id = accountId || 'default';
  const today = getETDateString();

  if (!accountStats.has(id)) {
    accountStats.set(id, {
      date: today,
      tradeCount: 0,
      totalLoss: 0,
      totalProfit: 0,
      lastTradeTime: null,
    });
  }

  const stats = accountStats.get(id);

  // Reset if new trading day
  if (stats.date !== today) {
    console.log(`[RiskManager] New trading day for account ${id}. Resetting stats.`);
    stats.date = today;
    stats.tradeCount = 0;
    stats.totalLoss = 0;
    stats.totalProfit = 0;
    stats.lastTradeTime = null;
  }

  return stats;
}

/**
 * Check if futures market is currently open
 * Futures: Sun 6PM ET - Fri 5PM ET (with daily 5-6PM break Mon-Thu)
 */
function isFuturesMarketOpen() {
  const status = futuresMarket.isFuturesOpen();
  console.log(`[RiskManager] Futures market open: ${status.open}, Reason: ${status.reason}`);
  return status.open;
}

/**
 * Check if cooldown period has elapsed since last trade for an account
 */
function isCooldownElapsed(accountId) {
  const stats = getAccountStats(accountId);

  if (!stats.lastTradeTime) {
    return true;
  }

  const now = Date.now();
  const timeSinceLastTrade = (now - stats.lastTradeTime) / 1000; // seconds
  const cooldownElapsed = timeSinceLastTrade >= RISK_LIMITS.COOLDOWN_SECONDS;

  if (!cooldownElapsed) {
    const remainingSeconds = Math.ceil(RISK_LIMITS.COOLDOWN_SECONDS - timeSinceLastTrade);
    console.log(`[RiskManager] Account ${accountId} cooldown active. ${remainingSeconds}s remaining.`);
  }

  return cooldownElapsed;
}

/**
 * Check if max trades per day limit has been reached for an account
 */
function hasReachedMaxTrades(accountId) {
  const stats = getAccountStats(accountId);
  const reached = stats.tradeCount >= RISK_LIMITS.MAX_TRADES_PER_DAY;

  if (reached) {
    console.log(`[RiskManager] Account ${accountId} max trades reached: ${stats.tradeCount}/${RISK_LIMITS.MAX_TRADES_PER_DAY}`);
  }

  return reached;
}

/**
 * Check if max daily loss limit has been reached for an account
 */
function hasReachedMaxLoss(accountId) {
  const stats = getAccountStats(accountId);
  const reached = stats.totalLoss >= RISK_LIMITS.MAX_DAILY_LOSS;

  if (reached) {
    console.log(`[RiskManager] Account ${accountId} max daily loss reached: $${stats.totalLoss}/$${RISK_LIMITS.MAX_DAILY_LOSS}`);
  }

  return reached;
}

/**
 * Validate if a trade can be executed based on all risk rules
 * @param {string} webhookId - Optional webhook ID for idempotency check
 * @param {string} accountId - Account ID for per-account risk limits
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canExecuteTrade(webhookId = null, accountId = 'default') {
  // Check for duplicate webhook (global - same webhook shouldn't process twice)
  if (isDuplicateWebhook(webhookId)) {
    return {
      allowed: false,
      reason: 'Duplicate webhook detected (already processed)',
    };
  }

  // Check if futures market is open (global - same for all accounts)
  if (!isFuturesMarketOpen()) {
    const status = futuresMarket.isFuturesOpen();
    return {
      allowed: false,
      reason: `Futures market closed: ${status.reason}`,
    };
  }

  // Per-account checks
  if (hasReachedMaxTrades(accountId)) {
    return {
      allowed: false,
      reason: `Account ${accountId}: Maximum trades per day reached (${RISK_LIMITS.MAX_TRADES_PER_DAY})`,
    };
  }

  if (hasReachedMaxLoss(accountId)) {
    return {
      allowed: false,
      reason: `Account ${accountId}: Maximum daily loss reached ($${RISK_LIMITS.MAX_DAILY_LOSS})`,
    };
  }

  if (!isCooldownElapsed(accountId)) {
    const stats = getAccountStats(accountId);
    const timeSinceLastTrade = (Date.now() - stats.lastTradeTime) / 1000;
    const remainingSeconds = Math.ceil(RISK_LIMITS.COOLDOWN_SECONDS - timeSinceLastTrade);
    return {
      allowed: false,
      reason: `Account ${accountId}: Cooldown period active (${remainingSeconds}s remaining)`,
    };
  }

  return {
    allowed: true,
    reason: 'All risk checks passed',
  };
}

/**
 * Record a trade execution for an account
 * @param {Object} tradeInfo - Trade details including accountId
 */
function recordTrade(tradeInfo = {}) {
  const accountId = tradeInfo.accountId || 'default';
  const stats = getAccountStats(accountId);

  stats.tradeCount += 1;
  stats.lastTradeTime = Date.now();

  // Mark webhook as processed if provided
  if (tradeInfo.webhookId) {
    markWebhookProcessed(tradeInfo.webhookId);
  }

  // Store trade in history
  const trade = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    accountId: accountId,
    action: tradeInfo.action || 'unknown',
    stopPrice: tradeInfo.stopPrice || null,
    takeProfitPrice: tradeInfo.takeProfitPrice || null,
    status: 'executed',
    pnl: null, // Updated later when position closes
    ...tradeInfo
  };

  tradeHistory.unshift(trade); // Add to beginning (newest first)

  // Keep only last 100 trades in memory
  if (tradeHistory.length > 100) {
    tradeHistory = tradeHistory.slice(0, 100);
  }

  console.log(`[RiskManager] Trade recorded for ${accountId}. Total today: ${stats.tradeCount}`);
  return trade;
}

/**
 * Get trade history
 * @param {number} limit - Max number of trades to return
 * @param {string} accountId - Optional filter by account
 */
function getTradeHistory(limit = 50, accountId = null) {
  let trades = tradeHistory;
  if (accountId) {
    trades = trades.filter(t => t.accountId === accountId);
  }
  return trades.slice(0, limit);
}

/**
 * Update trade P&L when position closes
 * @param {string} tradeId - Trade ID
 * @param {number} pnl - Profit/Loss amount
 */
function updateTradePnL(tradeId, pnl) {
  const trade = tradeHistory.find(t => t.id === tradeId);
  if (trade) {
    trade.pnl = pnl;
    trade.status = pnl >= 0 ? 'won' : 'lost';
    updatePnL(pnl, trade.accountId); // Update per-account stats
  }
}

/**
 * Update profit/loss tracking for an account
 * @param {number} pnl - Profit (positive) or Loss (negative) in USD
 * @param {string} accountId - Account ID
 */
function updatePnL(pnl, accountId = 'default') {
  const stats = getAccountStats(accountId);

  if (pnl < 0) {
    stats.totalLoss += Math.abs(pnl);
  } else {
    stats.totalProfit += pnl;
  }

  console.log(`[RiskManager] Account ${accountId} P&L updated. Profit: $${stats.totalProfit}, Loss: $${stats.totalLoss}`);
}

/**
 * Get current daily statistics for an account
 */
function getDailyStats(accountId = 'default') {
  const stats = getAccountStats(accountId);
  return {
    accountId,
    ...stats,
    maxTrades: RISK_LIMITS.MAX_TRADES_PER_DAY,
    maxLoss: RISK_LIMITS.MAX_DAILY_LOSS,
    tradesRemaining: Math.max(0, RISK_LIMITS.MAX_TRADES_PER_DAY - stats.tradeCount),
    lossRemaining: Math.max(0, RISK_LIMITS.MAX_DAILY_LOSS - stats.totalLoss),
  };
}

/**
 * Get daily stats for all accounts
 */
function getAllAccountStats() {
  const result = {};
  for (const [accountId, stats] of accountStats.entries()) {
    result[accountId] = {
      ...stats,
      maxTrades: RISK_LIMITS.MAX_TRADES_PER_DAY,
      maxLoss: RISK_LIMITS.MAX_DAILY_LOSS,
      tradesRemaining: Math.max(0, RISK_LIMITS.MAX_TRADES_PER_DAY - stats.tradeCount),
      lossRemaining: Math.max(0, RISK_LIMITS.MAX_DAILY_LOSS - stats.totalLoss),
    };
  }
  return result;
}

/**
 * Reset daily stats manually for an account (useful for testing)
 */
function resetStats(accountId = null) {
  if (accountId) {
    accountStats.delete(accountId);
    console.log(`[RiskManager] Stats reset for account ${accountId}`);
  } else {
    accountStats.clear();
    recentWebhooks.clear();
    console.log('[RiskManager] All stats manually reset');
  }
}

/**
 * Generate a unique webhook ID based on payload
 * Now includes account for better uniqueness
 */
function generateWebhookId(payload) {
  // Create a unique ID based on action, stop, tp, account, and timestamp (rounded to 10 second window)
  const timeWindow = Math.floor(Date.now() / 10000); // 10 second windows
  const account = payload.account || 'default';
  return `${account}-${payload.action}-${payload.stop}-${payload.tp}-${timeWindow}`;
}

module.exports = {
  canExecuteTrade,
  recordTrade,
  updatePnL,
  updateTradePnL,
  getDailyStats,
  getAllAccountStats,
  getTradeHistory,
  resetStats,
  acquireLock,
  releaseLock,
  isDuplicateWebhook,
  markWebhookProcessed,
  generateWebhookId,
  RISK_LIMITS,
};
