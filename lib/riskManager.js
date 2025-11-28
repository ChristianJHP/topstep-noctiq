/**
 * Risk Management Module
 * Enforces trading rules and safety limits
 */

// In-memory storage for daily tracking (consider database for production)
let dailyStats = {
  date: null,
  tradeCount: 0,
  totalLoss: 0,
  totalProfit: 0,
  lastTradeTime: null,
};

const RISK_LIMITS = {
  MAX_TRADES_PER_DAY: 8,
  MAX_DAILY_LOSS: 400, // USD
  COOLDOWN_SECONDS: 60,
  RTH_START_HOUR: 9, // 9:30 AM ET
  RTH_START_MINUTE: 30,
  RTH_END_HOUR: 16, // 4:00 PM ET
  RTH_END_MINUTE: 0,
};

/**
 * Reset daily stats if it's a new trading day
 */
function checkAndResetDailyStats() {
  const now = new Date();
  const today = now.toISOString().split('T')[0]; // YYYY-MM-DD

  if (dailyStats.date !== today) {
    console.log(`[RiskManager] New trading day detected. Resetting stats.`);
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
 * Check if current time is within Regular Trading Hours (RTH)
 * RTH: 9:30 AM - 4:00 PM ET
 */
function isWithinRTH() {
  const now = new Date();

  // Convert to ET timezone (UTC-5 or UTC-4 depending on DST)
  const etTimeString = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
  });

  const etDate = new Date(etTimeString);
  const hour = etDate.getHours();
  const minute = etDate.getMinutes();

  const currentMinutes = hour * 60 + minute;
  const startMinutes = RISK_LIMITS.RTH_START_HOUR * 60 + RISK_LIMITS.RTH_START_MINUTE;
  const endMinutes = RISK_LIMITS.RTH_END_HOUR * 60 + RISK_LIMITS.RTH_END_MINUTE;

  const withinRTH = currentMinutes >= startMinutes && currentMinutes < endMinutes;

  console.log(`[RiskManager] Current ET time: ${etDate.toLocaleTimeString()}, Within RTH: ${withinRTH}`);
  return withinRTH;
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
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canExecuteTrade() {
  checkAndResetDailyStats();

  // Check RTH
  if (!isWithinRTH()) {
    return {
      allowed: false,
      reason: 'Outside regular trading hours (9:30 AM - 4:00 PM ET)',
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
 */
function recordTrade() {
  checkAndResetDailyStats();
  dailyStats.tradeCount += 1;
  dailyStats.lastTradeTime = Date.now();

  console.log(`[RiskManager] Trade recorded. Total today: ${dailyStats.tradeCount}`);
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
    date: new Date().toISOString().split('T')[0],
    tradeCount: 0,
    totalLoss: 0,
    totalProfit: 0,
    lastTradeTime: null,
  };
  console.log('[RiskManager] Stats manually reset');
}

module.exports = {
  canExecuteTrade,
  recordTrade,
  updatePnL,
  getDailyStats,
  resetStats,
  RISK_LIMITS,
};
