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

  async function getPositions() {
    const token = await getToken();
    const accountId = await getAccountId();

    console.log(`[${brokerName}] Fetching positions...`);

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/Position/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      // Throw on 5xx errors to trigger retry
      if (res.status >= 500) {
        const errorText = await res.text();
        throw new Error(`Server error ${res.status}: ${errorText || res.statusText || 'No error message'}`);
      }

      return res;
    }, 'GetPositions');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch positions (HTTP ${response.status}): ${errorText || response.statusText || 'No error message'}`);
    }
    const data = await response.json();
    console.log(`[${brokerName}] Positions:`, JSON.stringify(data));
    return Array.isArray(data) ? data : (data.positions || data.results || []);
  }

  async function getOpenOrders() {
    const token = await getToken();
    const accountId = await getAccountId();

    console.log(`[${brokerName}] Fetching open orders...`);

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(`${BASE_URL}/Order/search`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      // Throw on 5xx errors to trigger retry
      if (res.status >= 500) {
        const errorText = await res.text();
        throw new Error(`Server error ${res.status}: ${errorText || res.statusText || 'No error message'}`);
      }

      return res;
    }, 'GetOpenOrders');

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch orders (HTTP ${response.status}): ${errorText || response.statusText || 'No error message'}`);
    }
    const data = await response.json();
    console.log(`[${brokerName}] Open orders:`, JSON.stringify(data));
    return Array.isArray(data) ? data : (data.orders || data.results || []);
  }

  return {
    name: brokerName,
    type: brokerType,

    async placeBracketOrder(action, stopPrice, tpPrice, quantity = 1) {
      console.log(`[${brokerName}] Placing bracket order: ${action.toUpperCase()}, Stop: ${stopPrice}, TP: ${tpPrice}`);

      // Cleanup existing positions and orders
      const positions = await getPositions();
      if (positions.length > 0) {
        console.log(`[${brokerName}] Closing ${positions.length} existing position(s)...`);
        await this.closeAllPositions();
      }

      const openOrders = await getOpenOrders();
      if (openOrders.length > 0) {
        console.log(`[${brokerName}] Cancelling ${openOrders.length} open order(s)...`);
        for (const order of openOrders) {
          await cancelOrder(order.id || order.orderId);
        }
      }

      // Place entry
      const entryOrder = await placeMarketOrder(action, quantity);
      console.log(`[${brokerName}] Entry order placed`);

      // Place stop loss
      const stopSide = action.toLowerCase() === 'buy' ? 'sell' : 'buy';
      let stopOrder;
      try {
        stopOrder = await placeStopOrder(stopSide, stopPrice, quantity);
      } catch (e) {
        throw new Error(`Stop loss failed after entry. UNPROTECTED POSITION! Error: ${e.message}`);
      }

      // Place take profit
      let tpOrder;
      try {
        tpOrder = await placeLimitOrder(stopSide, tpPrice, quantity);
      } catch (e) {
        console.warn(`[${brokerName}] Take profit order failed, position protected by stop loss only`);
        return { success: true, partial: true, warning: 'TP failed, protected by SL only', entry: entryOrder, stopLoss: stopOrder, takeProfit: null, tpError: e.message };
      }

      return { success: true, entry: entryOrder, stopLoss: stopOrder, takeProfit: tpOrder };
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

    async closeAllPositions(symbol = null) {
      const positions = await getPositions();
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
};
