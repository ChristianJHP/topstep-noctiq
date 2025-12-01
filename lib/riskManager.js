/**
 * Risk Management Module
 * Enforces trading rules and safety limits
 *
 * EDGE CASES HANDLED:
 * - Futures market hours (Sun 6PM - Fri 5PM ET)
 * - Daily reset uses proper ET timezone
 * - Concurrent trade protection via mutex
 * - Idempotency tracking for duplicate webhooks
 */

const futuresMarket = require('./futuresMarket');

// Mutex for concurrent trade execution
let tradeMutex = {
  locked: false,
  queue: [],
};

// Recent webhook IDs for idempotency (prevent duplicate orders)
let recentWebhooks = new Map(); // webhookId -> timestamp
const WEBHOOK_IDEMPOTENCY_WINDOW_MS = 30000; // 30 seconds

// In-memory storage for daily tracking
let dailyStats = {
  date: null,
  tradeCount: 0,
  totalLoss: 0,
  totalProfit: 0,
  lastTradeTime: null,
};

// Trade history storage (in-memory, resets on server restart)
let tradeHistory = [];

const RISK_LIMITS = {
  MAX_TRADES_PER_DAY: 8,
  MAX_DAILY_LOSS: 400, // USD
  COOLDOWN_SECONDS: 60,
};

/**
 * Acquire mutex lock for trade execution
 * Prevents concurrent webhooks from bypassing risk limits
 */
async function acquireLock(timeoutMs = 5000) {
  const startTime = Date.now();

  while (tradeMutex.locked) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Trade lock timeout - system busy');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  tradeMutex.locked = true;
  return true;
}

/**
 * Release mutex lock
 */
function releaseLock() {
  tradeMutex.locked = false;
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
 * Reset daily stats if it's a new trading day (based on ET timezone)
 */
function checkAndResetDailyStats() {
  const today = getETDateString();

  if (dailyStats.date !== today) {
    console.log(`[RiskManager] New trading day detected (ET). Resetting stats.`);
    console.log(`[RiskManager] Previous date: ${dailyStats.date}, New date: ${today}`);
    dailyStats = {
      date: today,
      tradeCount: 0,
      totalLoss: 0,
      totalProfit: 0,
      lastTradeTime: null,
    };
  }
}

/**
 * Get current ET time components
 */
function getETTimeComponents() {
  const now = new Date();
  const etTimeString = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // Parse "HH:MM:SS" format
  const [hour, minute, second] = etTimeString.split(':').map(Number);
  return { hour, minute, second };
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
 * Check if cooldown period has elapsed since last trade
 */
function isCooldownElapsed() {
  if (!dailyStats.lastTradeTime) {
    return true;
  }

  const now = Date.now();
  const timeSinceLastTrade = (now - dailyStats.lastTradeTime) / 1000; // seconds
  const cooldownElapsed = timeSinceLastTrade >= RISK_LIMITS.COOLDOWN_SECONDS;

  if (!cooldownElapsed) {
    const remainingSeconds = Math.ceil(RISK_LIMITS.COOLDOWN_SECONDS - timeSinceLastTrade);
    console.log(`[RiskManager] Cooldown active. ${remainingSeconds}s remaining.`);
  }

  return cooldownElapsed;
}

/**
 * Check if max trades per day limit has been reached
 */
function hasReachedMaxTrades() {
  checkAndResetDailyStats();
  const reached = dailyStats.tradeCount >= RISK_LIMITS.MAX_TRADES_PER_DAY;

  if (reached) {
    console.log(`[RiskManager] Max trades reached: ${dailyStats.tradeCount}/${RISK_LIMITS.MAX_TRADES_PER_DAY}`);
  }

  return reached;
}

/**
 * Check if max daily loss limit has been reached
 */
function hasReachedMaxLoss() {
  checkAndResetDailyStats();
  const reached = dailyStats.totalLoss >= RISK_LIMITS.MAX_DAILY_LOSS;

  if (reached) {
    console.log(`[RiskManager] Max daily loss reached: $${dailyStats.totalLoss}/$${RISK_LIMITS.MAX_DAILY_LOSS}`);
  }

  return reached;
}

/**
 * Validate if a trade can be executed based on all risk rules
 * @param {string} webhookId - Optional webhook ID for idempotency check
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canExecuteTrade(webhookId = null) {
  checkAndResetDailyStats();

  // Check for duplicate webhook
  if (isDuplicateWebhook(webhookId)) {
    return {
      allowed: false,
      reason: 'Duplicate webhook detected (already processed)',
    };
  }

  // Check if futures market is open
  if (!isFuturesMarketOpen()) {
    const status = futuresMarket.isFuturesOpen();
    return {
      allowed: false,
      reason: `Futures market closed: ${status.reason}`,
    };
  }

  // Check max trades
  if (hasReachedMaxTrades()) {
    return {
      allowed: false,
      reason: `Maximum trades per day reached (${RISK_LIMITS.MAX_TRADES_PER_DAY})`,
    };
  }

  // Check max loss
  if (hasReachedMaxLoss()) {
    return {
      allowed: false,
      reason: `Maximum daily loss reached ($${RISK_LIMITS.MAX_DAILY_LOSS})`,
    };
  }

  // Check cooldown
  if (!isCooldownElapsed()) {
    const timeSinceLastTrade = (Date.now() - dailyStats.lastTradeTime) / 1000;
    const remainingSeconds = Math.ceil(RISK_LIMITS.COOLDOWN_SECONDS - timeSinceLastTrade);
    return {
      allowed: false,
      reason: `Cooldown period active (${remainingSeconds}s remaining)`,
    };
  }

  return {
    allowed: true,
    reason: 'All risk checks passed',
  };
}

/**
 * Record a trade execution
 * @param {Object} tradeInfo - Optional trade details to store
 */
function recordTrade(tradeInfo = {}) {
  checkAndResetDailyStats();
  dailyStats.tradeCount += 1;
  dailyStats.lastTradeTime = Date.now();

  // Mark webhook as processed if provided
  if (tradeInfo.webhookId) {
    markWebhookProcessed(tradeInfo.webhookId);
  }

  // Store trade in history
  const trade = {
    id: `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
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

  console.log(`[RiskManager] Trade recorded. Total today: ${dailyStats.tradeCount}`);
  return trade;
}

/**
 * Get trade history
 * @param {number} limit - Max number of trades to return
 */
function getTradeHistory(limit = 50) {
  return tradeHistory.slice(0, limit);
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
    updatePnL(pnl); // Update daily stats
  }
}

/**
 * Update profit/loss tracking
 * @param {number} pnl - Profit (positive) or Loss (negative) in USD
 */
function updatePnL(pnl) {
  checkAndResetDailyStats();

  if (pnl < 0) {
    dailyStats.totalLoss += Math.abs(pnl);
  } else {
    dailyStats.totalProfit += pnl;
  }

  console.log(`[RiskManager] P&L updated. Profit: $${dailyStats.totalProfit}, Loss: $${dailyStats.totalLoss}`);
}

/**
 * Get current daily statistics
 */
function getDailyStats() {
  checkAndResetDailyStats();
  return {
    ...dailyStats,
    maxTrades: RISK_LIMITS.MAX_TRADES_PER_DAY,
    maxLoss: RISK_LIMITS.MAX_DAILY_LOSS,
    tradesRemaining: Math.max(0, RISK_LIMITS.MAX_TRADES_PER_DAY - dailyStats.tradeCount),
    lossRemaining: Math.max(0, RISK_LIMITS.MAX_DAILY_LOSS - dailyStats.totalLoss),
  };
}

/**
 * Reset daily stats manually (useful for testing)
 */
function resetStats() {
  dailyStats = {
    date: getETDateString(),
    tradeCount: 0,
    totalLoss: 0,
    totalProfit: 0,
    lastTradeTime: null,
  };
  recentWebhooks.clear();
  console.log('[RiskManager] Stats manually reset');
}

/**
 * Generate a unique webhook ID based on payload
 */
function generateWebhookId(payload) {
  // Create a unique ID based on action, stop, tp, and timestamp (rounded to 10 second window)
  const timeWindow = Math.floor(Date.now() / 10000); // 10 second windows
  return `${payload.action}-${payload.stop}-${payload.tp}-${timeWindow}`;
}

module.exports = {
  canExecuteTrade,
  recordTrade,
  updatePnL,
  updateTradePnL,
  getDailyStats,
  getTradeHistory,
  resetStats,
  acquireLock,
  releaseLock,
  isDuplicateWebhook,
  markWebhookProcessed,
  generateWebhookId,
  RISK_LIMITS,
};
