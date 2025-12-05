/**
 * Broker Factory
 *
 * Creates and manages broker API clients for different platforms.
 * Each broker implements a standard interface for order execution.
 *
 * Standard Broker Interface:
 * - placeBracketOrder(action, stopPrice, tpPrice, quantity)
 * - placeMarketOrder(side, quantity)
 * - placeStopOrder(side, stopPrice, quantity)
 * - placeLimitOrder(side, limitPrice, quantity)
 * - cancelOrder(orderId)
 * - closeAllPositions(symbol)
 * - getPositions()
 * - getOpenOrders()
 * - getAccountStatus()
 * - getAccountDetails()
 */

const { BROKER_TYPE } = require('../accounts');

// Broker client cache (keyed by account ID)
const brokerClients = new Map();

// ProjectX API configuration
const PROJECTX_CONFIG = {
  REQUEST_TIMEOUT_MS: 10000,
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY_MS: 1000,
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000,
};

const ORDER_TYPE = { LIMIT: 1, MARKET: 2, STOP_LIMIT: 3, STOP: 4, TRAILING_STOP: 5 };
const ORDER_SIDE = { BUY: 0, SELL: 1 };

// Runner configuration
const RUNNER_CONFIG = {
  MAIN_CONTRACTS: 2,      // Contracts that exit at TP
  RUNNER_CONTRACTS: 1,    // Contract that runs with trailing stop
  TRAIL_TICKS: 40,        // Trail distance in ticks (40 ticks = 10 points for MNQ)
  MNQ_TICK_SIZE: 0.25,    // MNQ tick size
};

/**
 * Create a ProjectX-based broker client with isolated credentials
 * Works for TopStepX, The Futures Desk, and other ProjectX-powered firms
 */
function createProjectXClient(accountConfig, brokerName, brokerType) {
  // API endpoints - The Futures Desk uses their own domain
  const BASE_URL = accountConfig.baseUrl || 'https://api.topstepx.com/api';

  // Isolated session cache for this account
  let sessionCache = {
    token: null,
    accountId: null,
    contractId: null,
    tokenExpiry: null,
  };

  async function fetchWithTimeout(url, options, timeoutMs = PROJECTX_CONFIG.REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function retryWithBackoff(operation, operationName, maxRetries = PROJECTX_CONFIG.MAX_RETRIES) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (error.message?.includes('401') || error.message?.includes('403')) throw error;
        if (error.name === 'AbortError') throw new Error(`${operationName} timed out`);
        if (attempt < maxRetries) {
          const delayMs = PROJECTX_CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[${brokerName}] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  async function login() {
    const username = accountConfig.username;
    const apiKey = accountConfig.apiKey;
    if (!username || !apiKey) throw new Error(`Missing credentials for ${brokerName} account`);

    console.log(`[${brokerName}] Authenticating...`);
    const response = await fetchWithTimeout(`${BASE_URL}/Auth/loginKey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: username, apiKey: apiKey, authType: 'api_key' }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }

    const data = await response.json();
    sessionCache.token = data.token || data.authToken || data;
    sessionCache.tokenExpiry = Date.now() + (60 * 60 * 1000);
    console.log(`[${brokerName}] Authentication successful`);
    return sessionCache.token;
  }

  async function getToken() {
    const now = Date.now();
    if (sessionCache.token && sessionCache.tokenExpiry) {
      const timeUntilExpiry = sessionCache.tokenExpiry - now;
      if (timeUntilExpiry > PROJECTX_CONFIG.TOKEN_REFRESH_BUFFER_MS) return sessionCache.token;
    }
    return await retryWithBackoff(() => login(), 'Login');
  }

  async function getAccountId() {
    if (sessionCache.accountId) return sessionCache.accountId;

    const token = await getToken();
    console.log(`[${brokerName}] Fetching account ID...`);

    const response = await retryWithBackoff(async () => {
      return await fetchWithTimeout(`${BASE_URL}/Account/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyActiveAccounts: true }),
      });
    }, 'GetAccountId');

    if (!response.ok) throw new Error(`Failed to fetch account: ${await response.text()}`);
    const data = await response.json();

    let accounts = Array.isArray(data) ? data : (data.accounts || data.results || [data]);
    if (!accounts.length) throw new Error('No accounts found');

    // Find matching account or use first
    let account = null;
    if (accountConfig.accountId) {
      account = accounts.find(a => {
        const name = a.name || a.accountName || '';
        const id = String(a.id || a.accountId || '');
        return name === accountConfig.accountId || name.includes(accountConfig.accountId) || id === accountConfig.accountId;
      });
    }
    if (!account) account = accounts[0];

    const accId = account.id || account.accountId;
    if (!accId) throw new Error(`No account ID field found`);

    sessionCache.accountId = accId;
    console.log(`[${brokerName}] Account ID: ${accId}`);
    return accId;
  }

  async function getContractId() {
    if (sessionCache.contractId) return sessionCache.contractId;

    const token = await getToken();
    const response = await retryWithBackoff(async () => {
      return await fetchWithTimeout(`${BASE_URL}/Contract/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchText: 'MNQ', live: false }),
      });
    }, 'GetMNQContract');

    if (!response.ok) throw new Error(`Failed to fetch MNQ contract: ${await response.text()}`);
    const data = await response.json();

    let contracts = Array.isArray(data) ? data : (data.contracts || data.results || [data]);
    const mnqContract = contracts.find(c => c.name?.includes('MNQ') || c.symbol?.includes('MNQ'));
    const contractId = mnqContract?.id || contracts[0]?.id;

    if (!contractId) throw new Error('MNQ contract not found');
    sessionCache.contractId = contractId;
    console.log(`[${brokerName}] MNQ Contract ID: ${contractId}`);
    return contractId;
  }

  async function cancelOrder(orderId) {
    if (!orderId) return null;
    const token = await getToken();
    try {
      const response = await fetchWithTimeout(`${BASE_URL}/Order/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error(`[${brokerName}] Error cancelling order ${orderId}:`, e.message);
      return null;
    }
  }

  async function placeMarketOrder(side, quantity = 1) {
    const token = await getToken();
    const accountId = await getAccountId();
    const contractId = await getContractId();
    const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

    console.log(`[${brokerName}] Placing ${side.toUpperCase()} market order...`);
    const response = await retryWithBackoff(async () => {
      return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, contractId, type: ORDER_TYPE.MARKET, side: orderSide, size: quantity }),
      });
    }, 'PlaceMarketOrder');

    if (!response.ok) throw new Error(`Failed to place market order: ${await response.text()}`);
    return await response.json();
  }

  async function placeStopOrder(side, stopPrice, quantity = 1) {
    const token = await getToken();
    const accountId = await getAccountId();
    const contractId = await getContractId();
    const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

    console.log(`[${brokerName}] Placing stop ${side.toUpperCase()} at ${stopPrice}...`);
    const response = await retryWithBackoff(async () => {
      return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, contractId, type: ORDER_TYPE.STOP, side: orderSide, size: quantity, stopPrice }),
      });
    }, 'PlaceStopOrder');

    if (!response.ok) throw new Error(`Failed to place stop order: ${await response.text()}`);
    return await response.json();
  }

  async function placeLimitOrder(side, limitPrice, quantity = 1) {
    const token = await getToken();
    const accountId = await getAccountId();
    const contractId = await getContractId();
    const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

    console.log(`[${brokerName}] Placing limit ${side.toUpperCase()} at ${limitPrice}...`);
    const response = await retryWithBackoff(async () => {
      return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, contractId, type: ORDER_TYPE.LIMIT, side: orderSide, size: quantity, limitPrice }),
      });
    }, 'PlaceLimitOrder');

    if (!response.ok) throw new Error(`Failed to place limit order: ${await response.text()}`);
    return await response.json();
  }

  async function placeTrailingStopOrder(side, trailPrice, quantity = 1) {
    const token = await getToken();
    const accountId = await getAccountId();
    const contractId = await getContractId();
    const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

    console.log(`[${brokerName}] Placing trailing stop ${side.toUpperCase()} with trail ${trailPrice}...`);
    const response = await retryWithBackoff(async () => {
      return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          contractId,
          type: ORDER_TYPE.TRAILING_STOP,
          side: orderSide,
          size: quantity,
          trailPrice: trailPrice  // Trail distance in points
        }),
      });
    }, 'PlaceTrailingStopOrder');

    if (!response.ok) throw new Error(`Failed to place trailing stop order: ${await response.text()}`);
    return await response.json();
  }

  /**
   * Cancel ALL open orders - aggressive cleanup to prevent orphaned orders
   */
  async function cancelAllOrders() {
    console.log(`[${brokerName}] Cancelling ALL open orders...`);
    try {
      const openOrders = await getOpenOrders();
      if (openOrders.length === 0) {
        console.log(`[${brokerName}] No open orders to cancel`);
        return { cancelled: 0 };
      }

      console.log(`[${brokerName}] Found ${openOrders.length} open order(s) to cancel`);
      let cancelled = 0;
      for (const order of openOrders) {
        const orderId = order.id || order.orderId;
        if (orderId) {
          await cancelOrder(orderId);
          cancelled++;
        }
      }
      console.log(`[${brokerName}] Cancelled ${cancelled} order(s)`);
      return { cancelled };
    } catch (e) {
      console.error(`[${brokerName}] Error cancelling orders:`, e.message);
      return { cancelled: 0, error: e.message };
    }
  }

  /**
   * Flatten position by placing market order opposite to detected position
   * More reliable than Position API which often returns empty
   */
  async function flattenByMarketOrder(detectedSide, detectedSize) {
    if (!detectedSide || detectedSide === 'flat' || !detectedSize || detectedSize === 0) {
      console.log(`[${brokerName}] No position to flatten (side=${detectedSide}, size=${detectedSize})`);
      return { flattened: false, reason: 'No position detected' };
    }

    const closeSide = detectedSide === 'long' ? 'sell' : 'buy';
    console.log(`[${brokerName}] Flattening ${detectedSide} position: ${closeSide.toUpperCase()} ${detectedSize} contract(s)...`);

    try {
      const order = await placeMarketOrder(closeSide, detectedSize);
      console.log(`[${brokerName}] Flatten order placed:`, JSON.stringify(order));
      return { flattened: true, order };
    } catch (e) {
      console.error(`[${brokerName}] Failed to flatten position:`, e.message);
      throw new Error(`Failed to flatten ${detectedSide} position: ${e.message}`);
    }
  }

  async function getPositions() {
    const token = await getToken();
    const accountId = await getAccountId();

    // Ensure accountId is a number (API may require numeric type)
    const numericAccountId = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;

    console.log(`[${brokerName}] Fetching positions for account ${numericAccountId}...`);

    const requestBody = { accountId: numericAccountId };
    console.log(`[${brokerName}] Position request body:`, JSON.stringify(requestBody));

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/Position/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[${brokerName}] Position response status: ${res.status}`);

      // Throw on 5xx errors to trigger retry
      if (res.status >= 500) {
        const errorText = await res.text();
        console.error(`[${brokerName}] Server error response:`, errorText);
        throw new Error(`Server error ${res.status}: ${errorText || res.statusText || 'No error message'}`);
      }

      return res;
    }, 'GetPositions');

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${brokerName}] Position error response (${response.status}):`, errorText);
      throw new Error(`Failed to fetch positions (HTTP ${response.status}): ${errorText || response.statusText || 'No error message'}`);
    }
    const data = await response.json();
    console.log(`[${brokerName}] Positions response:`, JSON.stringify(data));

    // Handle different response formats from ProjectX API
    if (Array.isArray(data)) {
      return data;
    } else if (data.positions) {
      return data.positions;
    } else if (data.results) {
      return data.results;
    } else if (data.success === true && !data.positions && !data.results) {
      // API may return { success: true } with no positions array when empty
      return [];
    }
    return [];
  }

  async function getOpenOrders() {
    const token = await getToken();
    const accountId = await getAccountId();

    // Ensure accountId is a number
    const numericAccountId = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;

    console.log(`[${brokerName}] Fetching open orders for account ${numericAccountId}...`);

    // Order/search requires startTimestamp
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0); // Start of today

    const requestBody = {
      accountId: numericAccountId,
      startTimestamp: startTime.toISOString(),
    };

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/Order/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`[${brokerName}] Order response status: ${res.status}`);

      // Throw on 5xx errors to trigger retry
      if (res.status >= 500) {
        const errorText = await res.text();
        console.error(`[${brokerName}] Server error response:`, errorText);
        throw new Error(`Server error ${res.status}: ${errorText || res.statusText || 'No error message'}`);
      }

      return res;
    }, 'GetOpenOrders');

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${brokerName}] Order error response (${response.status}):`, errorText);
      throw new Error(`Failed to fetch orders (HTTP ${response.status}): ${errorText || response.statusText || 'No error message'}`);
    }
    const data = await response.json();
    console.log(`[${brokerName}] Open orders response:`, JSON.stringify(data));

    // Handle different response formats
    let orders = [];
    if (Array.isArray(data)) {
      orders = data;
    } else if (data.orders) {
      orders = data.orders;
    } else if (data.results) {
      orders = data.results;
    }

    // Filter to only working/open orders (not filled, cancelled, etc.)
    // Status: 0=New, 1=PartiallyFilled, 2=Filled, 3=Cancelled, 4=Rejected, 5=Expired
    const workingOrders = orders.filter(o => o.status === 0 || o.status === 1 || o.status === 'Working' || o.status === 'New');
    console.log(`[${brokerName}] Working orders: ${workingOrders.length} of ${orders.length} total`);

    return workingOrders;
  }

  return {
    name: brokerName,
    type: brokerType,

    /**
     * Place bracket order with runner support
     * - 2 contracts: TP at limit price, protected by regular stop
     * - 1 contract (runner): Protected by trailing stop that follows price
     *
     * @param {string} action - 'buy' or 'sell'
     * @param {number} stopPrice - Stop loss price for main contracts
     * @param {number} tpPrice - Take profit price for main contracts
     * @param {number} quantity - Total contracts (default 3)
     * @param {object} options - { skipCleanup, detectedSide, detectedSize, useTrailingStop }
     */
    async placeBracketOrder(action, stopPrice, tpPrice, quantity = 3, options = {}) {
      const {
        skipCleanup = false,
        detectedSide = null,
        detectedSize = 0,
        useTrailingStop = true  // Enable trailing stop for runner by default
      } = options;

      console.log(`[${brokerName}] === PLACING BRACKET ORDER ===`);
      console.log(`[${brokerName}] Action: ${action.toUpperCase()}, Stop: ${stopPrice}, TP: ${tpPrice}, Qty: ${quantity}`);
      console.log(`[${brokerName}] Options: skipCleanup=${skipCleanup}, useTrailingStop=${useTrailingStop}`);

      const mainContracts = RUNNER_CONFIG.MAIN_CONTRACTS;  // 2
      const runnerContracts = RUNNER_CONFIG.RUNNER_CONTRACTS;  // 1
      const exitSide = action.toLowerCase() === 'buy' ? 'sell' : 'buy';

      // STEP 1: AGGRESSIVE CLEANUP - Cancel ALL open orders first
      console.log(`[${brokerName}] Step 1: Cancelling ALL open orders...`);
      await cancelAllOrders();

      // STEP 2: Flatten existing position if detected (more reliable than Position API)
      if (!skipCleanup && detectedSide && detectedSide !== 'flat' && detectedSize > 0) {
        console.log(`[${brokerName}] Step 2: Flattening detected ${detectedSide} position (${detectedSize} contracts)...`);
        await flattenByMarketOrder(detectedSide, detectedSize);
        // Wait for position to settle
        await new Promise(resolve => setTimeout(resolve, 400));
      } else if (skipCleanup) {
        console.log(`[${brokerName}] Step 2: Skipping flatten (already handled by caller)`);
      } else {
        console.log(`[${brokerName}] Step 2: No position to flatten`);
      }

      // STEP 3: Place market entry for ALL contracts
      console.log(`[${brokerName}] Step 3: Placing market ${action.toUpperCase()} entry for ${quantity} contracts...`);
      const entryOrder = await placeMarketOrder(action, quantity);
      console.log(`[${brokerName}] Entry order placed:`, JSON.stringify(entryOrder));

      // STEP 4: Place stop loss for MAIN contracts (2)
      console.log(`[${brokerName}] Step 4: Placing stop loss at ${stopPrice} for ${mainContracts} main contracts...`);
      let stopOrder;
      try {
        stopOrder = await placeStopOrder(exitSide, stopPrice, mainContracts);
        console.log(`[${brokerName}] Main stop loss placed:`, JSON.stringify(stopOrder));
      } catch (e) {
        console.error(`[${brokerName}] CRITICAL: Main stop loss failed!`, e.message);
        throw new Error(`Stop loss failed after entry. UNPROTECTED POSITION! Error: ${e.message}`);
      }

      // STEP 5: Place trailing stop for RUNNER contract (1)
      let runnerStopOrder = null;
      if (useTrailingStop) {
        const trailDistance = RUNNER_CONFIG.TRAIL_TICKS * RUNNER_CONFIG.MNQ_TICK_SIZE;  // 40 * 0.25 = 10 points
        console.log(`[${brokerName}] Step 5: Placing trailing stop (trail=${trailDistance} points) for ${runnerContracts} runner contract...`);
        try {
          runnerStopOrder = await placeTrailingStopOrder(exitSide, trailDistance, runnerContracts);
          console.log(`[${brokerName}] Runner trailing stop placed:`, JSON.stringify(runnerStopOrder));
        } catch (e) {
          // Trailing stop failed - fall back to regular stop for runner
          console.warn(`[${brokerName}] Trailing stop failed, using regular stop for runner:`, e.message);
          try {
            runnerStopOrder = await placeStopOrder(exitSide, stopPrice, runnerContracts);
            console.log(`[${brokerName}] Runner fallback stop placed:`, JSON.stringify(runnerStopOrder));
          } catch (e2) {
            console.error(`[${brokerName}] Runner stop also failed - runner is unprotected!`, e2.message);
          }
        }
      } else {
        // No trailing stop - use regular stop for runner too
        console.log(`[${brokerName}] Step 5: Placing regular stop for ${runnerContracts} runner contract (trailing disabled)...`);
        try {
          runnerStopOrder = await placeStopOrder(exitSide, stopPrice, runnerContracts);
          console.log(`[${brokerName}] Runner stop placed:`, JSON.stringify(runnerStopOrder));
        } catch (e) {
          console.error(`[${brokerName}] Runner stop failed!`, e.message);
        }
      }

      // STEP 6: Place take profit for MAIN contracts only (2)
      // Runner has no TP - it rides with trailing stop until stopped out
      console.log(`[${brokerName}] Step 6: Placing take profit at ${tpPrice} for ${mainContracts} main contracts...`);
      let tpOrder;
      try {
        tpOrder = await placeLimitOrder(exitSide, tpPrice, mainContracts);
        console.log(`[${brokerName}] Take profit placed:`, JSON.stringify(tpOrder));
      } catch (e) {
        console.warn(`[${brokerName}] Take profit order failed, position protected by stops only:`, e.message);
        return {
          success: true,
          partial: true,
          warning: 'TP failed, protected by stops only',
          entry: entryOrder,
          stopLoss: stopOrder,
          runnerStop: runnerStopOrder,
          takeProfit: null,
          tpError: e.message
        };
      }

      console.log(`[${brokerName}] === BRACKET ORDER COMPLETE ===`);
      console.log(`[${brokerName}] Summary: Entry ${quantity} contracts, TP ${mainContracts}@${tpPrice}, Stop ${mainContracts}@${stopPrice}, Runner ${runnerContracts} with ${useTrailingStop ? 'trailing' : 'regular'} stop`);

      return {
        success: true,
        entry: entryOrder,
        stopLoss: stopOrder,
        runnerStop: runnerStopOrder,
        takeProfit: tpOrder,
        breakdown: {
          totalContracts: quantity,
          mainContracts,
          runnerContracts,
          mainTpPrice: tpPrice,
          mainStopPrice: stopPrice,
          runnerHasTrailingStop: useTrailingStop && runnerStopOrder !== null
        }
      };
    },

    async placeMarketOrder(side, quantity = 1) {
      return placeMarketOrder(side, quantity);
    },

    async placeStopOrder(side, stopPrice, quantity = 1) {
      return placeStopOrder(side, stopPrice, quantity);
    },

    async placeLimitOrder(side, limitPrice, quantity = 1) {
      return placeLimitOrder(side, limitPrice, quantity);
    },

    async cancelOrder(orderId) {
      return cancelOrder(orderId);
    },

    async placeTrailingStopOrder(side, trailPrice, quantity = 1) {
      return placeTrailingStopOrder(side, trailPrice, quantity);
    },

    async cancelAllOrders() {
      return cancelAllOrders();
    },

    async flattenByMarketOrder(detectedSide, detectedSize) {
      return flattenByMarketOrder(detectedSide, detectedSize);
    },

    async closeAllPositions(symbol = null) {
      let positions = [];
      try {
        positions = await getPositions();
      } catch (posError) {
        console.warn(`[${brokerName}] Could not fetch positions: ${posError.message}`);
        // Can't close what we can't see - return success with 0 closed
        return { success: true, closedPositions: 0, note: 'Position API unavailable' };
      }
      if (!positions.length) return { success: true, closedPositions: 0 };

      const closedOrders = [];
      for (const position of positions) {
        if (symbol && !position.contractName?.includes(symbol) && !position.symbol?.includes(symbol)) continue;
        const size = position.netPos || position.size || position.quantity || 0;
        if (size === 0) continue;
        const closeSide = size > 0 ? 'sell' : 'buy';
        try {
          const order = await placeMarketOrder(closeSide, Math.abs(size));
          closedOrders.push(order);
        } catch (e) {
          console.error(`[${brokerName}] Failed to close position:`, e.message);
        }
      }

      // Cancel open orders
      const openOrders = await getOpenOrders();
      for (const order of openOrders) {
        if (symbol && !order.contractName?.includes(symbol)) continue;
        await cancelOrder(order.id || order.orderId);
      }

      return { success: true, closedPositions: closedOrders.length };
    },

    async getPositions() {
      return getPositions();
    },

    async getOpenOrders() {
      return getOpenOrders();
    },

    async getAccountStatus() {
      try {
        await getToken();
        const accountId = await getAccountId();
        return { connected: true, accountId, timestamp: new Date().toISOString() };
      } catch (e) {
        return { connected: false, error: e.message, timestamp: new Date().toISOString() };
      }
    },

    async getAccountDetails() {
      const token = await getToken();
      const response = await fetchWithTimeout(`${BASE_URL}/Account/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyActiveAccounts: true }),
      });
      if (!response.ok) throw new Error('Failed to fetch account details');
      const data = await response.json();
      const accounts = Array.isArray(data) ? data : (data.accounts || []);
      const accId = await getAccountId();
      const account = accounts.find(a => String(a.id) === String(accId)) || accounts[0];
      return { id: account.id, name: account.name, balance: account.balance, ...account };
    },
  };
}

/**
 * Create a TopStepX (ProjectX) broker client
 */
function createTopStepXClient(accountConfig) {
  // For default account, use singleton for backwards compatibility
  if (!accountConfig.username || !accountConfig.apiKey) {
    const projectx = require('../projectx');
    return {
      name: 'TopStepX',
      type: BROKER_TYPE.TOPSTEPX,
      placeBracketOrder: (a, s, t, q) => projectx.placeBracketOrder(a, s, t, q),
      placeMarketOrder: (s, q) => projectx.placeMarketOrder(s, q),
      placeStopOrder: (s, p, q) => projectx.placeStopOrder(s, p, q),
      placeLimitOrder: (s, p, q) => projectx.placeLimitOrder(s, p, q),
      cancelOrder: (id) => projectx.cancelOrder(id),
      closeAllPositions: (s) => projectx.closeAllPositions(s),
      getPositions: () => projectx.getPositions(),
      getOpenOrders: () => projectx.getOpenOrders(),
      getAccountStatus: () => projectx.getAccountStatus(),
      getAccountDetails: () => projectx.getAccountDetails(),
    };
  }

  // Use isolated client with account-specific credentials
  return createProjectXClient(accountConfig, 'TopStepX', BROKER_TYPE.TOPSTEPX);
}

/**
 * Create a Futures Desk broker client (uses ProjectX API)
 * The Futures Desk uses the same ProjectX trading platform
 * Login: https://thefuturesdesk.projectx.com/
 * API: https://api.thefuturesdesk.projectx.com/api
 */
function createFuturesDeskClient(accountConfig) {
  // The Futures Desk uses ProjectX API at their subdomain
  const config = {
    ...accountConfig,
    baseUrl: accountConfig.baseUrl || 'https://api.thefuturesdesk.projectx.com/api',
  };

  return createProjectXClient(config, 'Futures Desk', BROKER_TYPE.FUTURES_DESK);
}

/**
 * Get or create a broker client for an account
 */
function getBrokerClient(account) {
  if (!account) {
    throw new Error('Account is required');
  }

  // Check cache first
  if (brokerClients.has(account.id)) {
    return brokerClients.get(account.id);
  }

  // Create new client based on broker type
  let client;

  switch (account.broker) {
    case BROKER_TYPE.TOPSTEPX:
      client = createTopStepXClient(account.config);
      break;

    case BROKER_TYPE.FUTURES_DESK:
      client = createFuturesDeskClient(account.config);
      break;

    default:
      throw new Error(`Unsupported broker type: ${account.broker}`);
  }

  // Cache the client
  brokerClients.set(account.id, client);
  console.log(`[Brokers] Created ${client.name} client for account ${account.id}`);

  return client;
}

/**
 * Clear broker client cache (useful for testing)
 */
function clearCache() {
  brokerClients.clear();
  console.log('[Brokers] Client cache cleared');
}

/**
 * Get cached client count
 */
function getClientCount() {
  return brokerClients.size;
}

module.exports = {
  getBrokerClient,
  clearCache,
  getClientCount,
  createTopStepXClient,
  createFuturesDeskClient,
  RUNNER_CONFIG,  // Export for configuration
  ORDER_TYPE,
  ORDER_SIDE,
};
