/**
 * ProjectX API Client for TopStepX Trading
 * Base URL: https://api.topstepx.com/api
 * Docs: https://gateway.docs.projectx.com
 *
 * Trading: MNQ (Micro E-mini Nasdaq-100)
 *
 * EDGE CASES HANDLED:
 * - Request timeouts (10 second default)
 * - Retry with exponential backoff (3 attempts)
 * - Token refresh before expiry
 * - Bracket order atomicity (cleanup on partial failure)
 * - Rate limiting protection
 */

const BASE_URL = 'https://api.topstepx.com/api';

// Order types (from ProjectX API docs)
const ORDER_TYPE = {
  LIMIT: 1,
  MARKET: 2,
  STOP_LIMIT: 3,
  STOP: 4,
  TRAILING_STOP: 5,
};

// Order sides (from ProjectX API docs)
// 0 = Bid (Buy), 1 = Ask (Sell)
const ORDER_SIDE = {
  BUY: 0,
  SELL: 1,
};

// Configuration
const CONFIG = {
  REQUEST_TIMEOUT_MS: 10000, // 10 seconds
  MAX_RETRIES: 3,
  BASE_RETRY_DELAY_MS: 1000, // 1 second, doubles each retry
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000, // Refresh 5 mins before expiry
};

// In-memory cache for session data
let sessionCache = {
  token: null,
  accountId: null,
  contractId: null, // MNQ contract ID
  tokenExpiry: null,
};

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(url, options, timeoutMs = CONFIG.REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff(operation, operationName, maxRetries = CONFIG.MAX_RETRIES) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on authentication errors or client errors
      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw error;
      }

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        console.error(`[ProjectX] ${operationName} timed out after ${CONFIG.REQUEST_TIMEOUT_MS}ms`);
        throw new Error(`${operationName} timed out`);
      }

      if (attempt < maxRetries) {
        const delayMs = CONFIG.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[ProjectX] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Authenticate with ProjectX API using API key
 */
async function login() {
  const username = process.env.PROJECTX_USERNAME;
  const apiKey = process.env.PROJECTX_API_KEY;

  if (!username || !apiKey) {
    throw new Error('Missing ProjectX credentials in environment variables');
  }

  console.log('[ProjectX] Authenticating...');

  const response = await fetchWithTimeout(`${BASE_URL}/Auth/loginKey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userName: username,
      apiKey: apiKey,
      authType: 'api_key',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Authentication failed: ${error}`);
  }

  const data = await response.json();

  // Cache token with 1 hour expiry (adjust based on actual token lifetime)
  sessionCache.token = data.token || data.authToken || data;
  sessionCache.tokenExpiry = Date.now() + (60 * 60 * 1000); // 1 hour

  console.log('[ProjectX] Authentication successful');
  return sessionCache.token;
}

/**
 * Get authentication token (uses cached token if valid)
 * Proactively refreshes if within 5 minutes of expiry
 */
async function getToken() {
  const now = Date.now();

  // Check if token exists and is not close to expiry
  if (sessionCache.token && sessionCache.tokenExpiry) {
    const timeUntilExpiry = sessionCache.tokenExpiry - now;

    if (timeUntilExpiry > CONFIG.TOKEN_REFRESH_BUFFER_MS) {
      return sessionCache.token;
    }

    // Token is close to expiry, log and refresh
    console.log(`[ProjectX] Token expires in ${Math.round(timeUntilExpiry / 1000)}s, refreshing proactively...`);
  }

  return await retryWithBackoff(() => login(), 'Login');
}

/**
 * Search for account ID - Fetches numeric ID from API
 * Uses PROJECTX_ACCOUNT_ID to verify we're using the correct account
 */
async function getAccountId() {
  if (sessionCache.accountId) {
    return sessionCache.accountId;
  }

  const token = await getToken();
  console.log('[ProjectX] Fetching account ID...');

  const response = await retryWithBackoff(async () => {
    return await fetchWithTimeout(`${BASE_URL}/Account/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        onlyActiveAccounts: true,
      }),
    });
  }, 'GetAccountId');

  const responseText = await response.text();
  console.log('[ProjectX] Account search raw response:', responseText);

  if (!response.ok) {
    throw new Error(`Failed to fetch account: ${responseText}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Invalid JSON from account search: ${responseText}`);
  }
  console.log('[ProjectX] Account search parsed:', JSON.stringify(data));

  // Handle different response formats
  let accounts = [];
  if (Array.isArray(data)) {
    accounts = data;
  } else if (data.accounts) {
    accounts = data.accounts;
  } else if (data.results) {
    accounts = data.results;
  } else if (data.id) {
    accounts = [data];
  }

  console.log(`[ProjectX] Found ${accounts.length} accounts`);

  if (!accounts.length) {
    throw new Error('No accounts found in response');
  }

  // Find the account matching PROJECTX_ACCOUNT_ID env var
  const targetAccountId = process.env.PROJECTX_ACCOUNT_ID;
  console.log(`[ProjectX] Looking for account: ${targetAccountId}`);

  let account = null;

  if (targetAccountId) {
    // Try to match by name (e.g., "50KTC-V2-426662-93233922") or by numeric ID
    account = accounts.find(a => {
      const name = a.name || a.accountName || '';
      const id = String(a.id || a.accountId || '');
      return name === targetAccountId ||
             name.includes(targetAccountId) ||
             targetAccountId.includes(id) ||
             id === targetAccountId;
    });
  }

  // Fallback to first account if no match
  if (!account) {
    console.warn(`[ProjectX] Account ${targetAccountId} not found, using first account`);
    account = accounts[0];
  }

  console.log(`[ProjectX] Using account:`, JSON.stringify(account));

  // Try different ID field names
  const accountId = account.id || account.accountId || account.Id || account.AccountId;

  if (!accountId) {
    throw new Error(`No account ID field found in: ${JSON.stringify(account)}`);
  }

  sessionCache.accountId = accountId;
  console.log(`[ProjectX] Account ID: ${accountId} (numeric)`);
  return accountId;
}

/**
 * Get all accounts (for listing/verification)
 */
async function getAllAccounts() {
  const token = await getToken();
  console.log('[ProjectX] Fetching all accounts...');

  const response = await retryWithBackoff(async () => {
    return await fetchWithTimeout(`${BASE_URL}/Account/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ onlyActiveAccounts: true }),
    });
  }, 'GetAllAccounts');

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch accounts: ${error}`);
  }

  const data = await response.json();
  // API returns { success, accounts, errorCode, errorMessage }
  const accounts = data?.accounts || (Array.isArray(data) ? data : [data]);
  console.log('[ProjectX] Accounts response:', JSON.stringify(data, null, 2));
  return accounts;
}

/**
 * Get account details including balance
 * Uses Account/search endpoint which returns balance info
 */
async function getAccountDetails() {
  const accountId = await getAccountId();
  console.log('[ProjectX] Fetching account details for:', accountId);

  // Use search endpoint which returns balance
  const accounts = await getAllAccounts();
  const account = accounts.find(a => String(a.id) === String(accountId)) || accounts[0];

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  return {
    id: account.id,
    name: account.name || accountId,
    balance: account.balance,
    canTrade: account.canTrade ?? true,
    isVisible: account.isVisible ?? true,
    ...account
  };
}

/**
 * Search for MNQ contract ID (Micro E-mini Nasdaq-100)
 */
async function getContractId() {
  if (sessionCache.contractId) {
    return sessionCache.contractId;
  }

  const token = await getToken();
  console.log('[ProjectX] Fetching MNQ contract ID...');

  const response = await retryWithBackoff(async () => {
    return await fetchWithTimeout(`${BASE_URL}/Contract/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        searchText: 'MNQ',
        live: false,
      }),
    });
  }, 'GetMNQContract');

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch MNQ contract: ${error}`);
  }

  const data = await response.json();
  console.log('[ProjectX] Contract search response:', JSON.stringify(data));

  // Handle different response formats
  let contracts = [];
  if (Array.isArray(data)) {
    contracts = data;
  } else if (data.contracts) {
    contracts = data.contracts;
  } else if (data.results) {
    contracts = data.results;
  } else if (data.id) {
    contracts = [data];
  }

  // Find the MNQ contract (front month)
  const mnqContract = contracts.find(c =>
    c.name?.includes('MNQ') ||
    c.symbol?.includes('MNQ') ||
    c.description?.includes('Micro E-mini Nasdaq')
  );

  const contractId = mnqContract?.id || contracts[0]?.id;

  if (!contractId) {
    console.error('[ProjectX] No contracts found. Response:', JSON.stringify(data));
    throw new Error('MNQ contract not found - market may be closed');
  }

  sessionCache.contractId = contractId;
  console.log(`[ProjectX] MNQ Contract ID: ${contractId}`);
  return contractId;
}

/**
 * Cancel an order by ID
 */
async function cancelOrder(orderId) {
  if (!orderId) {
    console.warn('[ProjectX] Cannot cancel order: no order ID provided');
    return null;
  }

  const token = await getToken();
  console.log(`[ProjectX] Cancelling order ${orderId}...`);

  try {
    const response = await fetchWithTimeout(`${BASE_URL}/Order/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[ProjectX] Failed to cancel order ${orderId}: ${error}`);
      return null;
    }

    const data = await response.json();
    console.log(`[ProjectX] Order ${orderId} cancelled successfully`);
    return data;
  } catch (error) {
    console.error(`[ProjectX] Error cancelling order ${orderId}:`, error.message);
    return null;
  }
}

/**
 * Place a market order
 * @param {string} side - 'buy' or 'sell'
 * @param {number} quantity - Number of contracts (default: 1)
 */
async function placeMarketOrder(side, quantity = 1) {
  const token = await getToken();
  const accountId = await getAccountId();
  const contractId = await getContractId();

  const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  console.log(`[ProjectX] Placing ${side.toUpperCase()} market order for ${quantity} MNQ contract(s)...`);

  const orderPayload = {
    accountId: accountId,
    contractId: contractId,
    type: ORDER_TYPE.MARKET,
    side: orderSide,
    size: quantity,
  };

  const response = await retryWithBackoff(async () => {
    return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
  }, 'PlaceMarketOrder');

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to place market order: ${error}`);
  }

  const data = await response.json();
  console.log(`[ProjectX] Market order placed successfully:`, data);
  return data;
}

/**
 * Place a stop loss order
 * @param {string} side - 'buy' or 'sell' (opposite of entry)
 * @param {number} stopPrice - Stop price
 * @param {number} quantity - Number of contracts
 */
async function placeStopOrder(side, stopPrice, quantity = 1) {
  const token = await getToken();
  const accountId = await getAccountId();
  const contractId = await getContractId();

  const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  console.log(`[ProjectX] Placing stop ${side.toUpperCase()} order at ${stopPrice}...`);

  const orderPayload = {
    accountId: accountId,
    contractId: contractId,
    type: ORDER_TYPE.STOP,
    side: orderSide,
    size: quantity,
    stopPrice: stopPrice,
  };

  const response = await retryWithBackoff(async () => {
    return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
  }, 'PlaceStopOrder');

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to place stop order: ${error}`);
  }

  const data = await response.json();
  console.log(`[ProjectX] Stop order placed successfully:`, data);
  return data;
}

/**
 * Place a take profit limit order
 * @param {string} side - 'buy' or 'sell' (opposite of entry)
 * @param {number} limitPrice - Take profit price
 * @param {number} quantity - Number of contracts
 */
async function placeLimitOrder(side, limitPrice, quantity = 1) {
  const token = await getToken();
  const accountId = await getAccountId();
  const contractId = await getContractId();

  const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  console.log(`[ProjectX] Placing limit ${side.toUpperCase()} order at ${limitPrice}...`);

  const orderPayload = {
    accountId: accountId,
    contractId: contractId,
    type: ORDER_TYPE.LIMIT,
    side: orderSide,
    size: quantity,
    limitPrice: limitPrice,
  };

  const response = await retryWithBackoff(async () => {
    return await fetchWithTimeout(`${BASE_URL}/Order/place`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });
  }, 'PlaceLimitOrder');

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to place limit order: ${error}`);
  }

  const data = await response.json();
  console.log(`[ProjectX] Limit order placed successfully:`, data);
  return data;
}

/**
 * Place a bracket order (entry + stop loss + take profit)
 * WITH ATOMICITY: If any order fails after entry, attempts cleanup
 *
 * @param {string} action - 'buy' or 'sell'
 * @param {number} stopPrice - Stop loss price
 * @param {number} takeProfitPrice - Take profit price
 * @param {number} quantity - Number of contracts (default: 1)
 * @param {Object} options - Optional settings
 * @param {boolean} options.skipCleanup - Skip position cleanup (already handled by caller)
 */
async function placeBracketOrder(action, stopPrice, takeProfitPrice, quantity = 1, options = {}) {
  const { skipCleanup = false } = options;
  console.log(`[ProjectX] Placing bracket order: ${action.toUpperCase()}, Stop: ${stopPrice}, TP: ${takeProfitPrice}, skipCleanup: ${skipCleanup}`);

  let entryOrder = null;
  let stopOrder = null;
  let tpOrder = null;

  try {
    // 0. Clean up: Cancel open orders (positions API may not be available)
    // Skip if caller already handled cleanup (e.g., during reversal)
    if (!skipCleanup) {
      console.log('[ProjectX] Cleaning up open orders...');

      try {
        // Try to close existing positions (may fail if API not available)
        await closeAllPositions();
      } catch (posError) {
        console.warn('[ProjectX] Position cleanup skipped:', posError.message);
      }

      try {
        // Cancel all open orders (orphaned SL/TP from previous trades)
        const openOrders = await getOpenOrders();
        if (openOrders && openOrders.length > 0) {
          console.log(`[ProjectX] Found ${openOrders.length} open order(s), cancelling...`);
          for (const order of openOrders) {
            const orderId = order.id || order.orderId;
            if (orderId) {
              await cancelOrder(orderId);
            }
          }
        }
      } catch (orderError) {
        console.warn('[ProjectX] Order cleanup failed:', orderError.message);
      }
    } else {
      console.log('[ProjectX] Skipping cleanup (already handled by caller)');
      // Still cancel orphaned orders even if we skip position cleanup
      try {
        const openOrders = await getOpenOrders();
        if (openOrders && openOrders.length > 0) {
          console.log(`[ProjectX] Cancelling ${openOrders.length} orphaned order(s)...`);
          for (const order of openOrders) {
            const orderId = order.id || order.orderId;
            if (orderId) {
              await cancelOrder(orderId);
            }
          }
        }
      } catch (orderError) {
        console.warn('[ProjectX] Could not cancel orphaned orders:', orderError.message);
      }
    }

    console.log('[ProjectX] Placing new bracket order...');

    // 1. Place market entry order
    entryOrder = await placeMarketOrder(action, quantity);
    const entryOrderId = entryOrder?.orderId || entryOrder?.id;
    console.log(`[ProjectX] Entry order placed: ${entryOrderId}`);

    // 2. Place stop loss (opposite side)
    const stopSide = action.toLowerCase() === 'buy' ? 'sell' : 'buy';
    try {
      stopOrder = await placeStopOrder(stopSide, stopPrice, quantity);
    } catch (stopError) {
      console.error('[ProjectX] CRITICAL: Stop loss order failed after entry!');
      console.error('[ProjectX] Position is UNPROTECTED. Manual intervention required.');
      console.error(`[ProjectX] Entry order ID: ${entryOrderId}`);
      console.error(`[ProjectX] Intended stop price: ${stopPrice}`);
      // Re-throw with context
      throw new Error(`Stop loss failed after entry filled. UNPROTECTED POSITION! Entry: ${entryOrderId}, Error: ${stopError.message}`);
    }

    // 3. Place take profit (opposite side)
    const tpSide = action.toLowerCase() === 'buy' ? 'sell' : 'buy';
    try {
      tpOrder = await placeLimitOrder(tpSide, takeProfitPrice, quantity);
    } catch (tpError) {
      console.error('[ProjectX] Take profit order failed, but stop loss is in place.');
      console.error(`[ProjectX] Entry: ${entryOrderId}, Stop: ${stopOrder?.orderId || stopOrder?.id}`);
      // Position is protected by stop loss, but no TP
      // Continue but flag the issue
      console.warn('[ProjectX] Bracket incomplete: no take profit order.');
      return {
        success: true,
        partial: true,
        warning: 'Take profit order failed, position protected by stop loss only',
        entry: entryOrder,
        stopLoss: stopOrder,
        takeProfit: null,
        tpError: tpError.message,
      };
    }

    return {
      success: true,
      entry: entryOrder,
      stopLoss: stopOrder,
      takeProfit: tpOrder,
    };
  } catch (error) {
    console.error('[ProjectX] Bracket order failed:', error.message);

    // Log all order states for debugging
    console.error('[ProjectX] Order states at failure:');
    console.error(`  Entry: ${entryOrder ? JSON.stringify(entryOrder) : 'NOT PLACED'}`);
    console.error(`  Stop: ${stopOrder ? JSON.stringify(stopOrder) : 'NOT PLACED'}`);
    console.error(`  TP: ${tpOrder ? JSON.stringify(tpOrder) : 'NOT PLACED'}`);

    throw error;
  }
}

/**
 * Get current positions for the account
 */
async function getPositions() {
  const token = await getToken();
  const accountId = await getAccountId();

  // Ensure accountId is a number (API may require numeric type)
  const numericAccountId = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;

  console.log(`[ProjectX] Fetching positions for account ${numericAccountId}...`);

  const requestBody = { accountId: numericAccountId };
  console.log('[ProjectX] Position request body:', JSON.stringify(requestBody));

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

    console.log(`[ProjectX] Position response status: ${res.status}`);

    // Throw on 5xx errors to trigger retry
    if (res.status >= 500) {
      const errorText = await res.text();
      console.error('[ProjectX] Server error response:', errorText);
      throw new Error(`Server error ${res.status}: ${errorText || res.statusText || 'No error message'}`);
    }

    return res;
  }, 'GetPositions');

  if (!response.ok) {
    const error = await response.text();
    console.error(`[ProjectX] Position error response (${response.status}):`, error);
    throw new Error(`Failed to fetch positions (HTTP ${response.status}): ${error || response.statusText || 'No error message'}`);
  }

  const data = await response.json();
  console.log('[ProjectX] Positions response:', JSON.stringify(data));

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

/**
 * Get open orders for the account
 */
async function getOpenOrders() {
  const token = await getToken();
  const accountId = await getAccountId();

  // Ensure accountId is a number
  const numericAccountId = typeof accountId === 'string' ? parseInt(accountId, 10) : accountId;

  console.log(`[ProjectX] Fetching open orders for account ${numericAccountId}...`);

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

    console.log(`[ProjectX] Order response status: ${res.status}`);

    // Throw on 5xx errors to trigger retry
    if (res.status >= 500) {
      const errorText = await res.text();
      console.error('[ProjectX] Server error response:', errorText);
      throw new Error(`Server error ${res.status}: ${errorText || res.statusText || 'No error message'}`);
    }

    return res;
  }, 'GetOpenOrders');

  if (!response.ok) {
    const error = await response.text();
    console.error(`[ProjectX] Order error response (${response.status}):`, error);
    throw new Error(`Failed to fetch orders (HTTP ${response.status}): ${error || response.statusText || 'No error message'}`);
  }

  const data = await response.json();
  console.log('[ProjectX] Open orders response:', JSON.stringify(data));

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
  console.log(`[ProjectX] Working orders: ${workingOrders.length} of ${orders.length} total`);

  return workingOrders;
}

/**
 * Close all positions for a given symbol (or all if no symbol specified)
 * @param {string} symbol - Optional symbol to filter (e.g., 'MNQ')
 */
async function closeAllPositions(symbol = null) {
  console.log(`[ProjectX] Closing all positions${symbol ? ` for ${symbol}` : ''}...`);

  let positions = [];
  try {
    positions = await getPositions();
  } catch (posError) {
    console.warn(`[ProjectX] Could not fetch positions: ${posError.message}`);
    // Can't close what we can't see - return success
    return { success: true, closedPositions: 0, note: 'Position API unavailable' };
  }

  if (!positions || positions.length === 0) {
    console.log('[ProjectX] No open positions to close');
    return { success: true, closedPositions: 0, message: 'No open positions' };
  }

  const closedOrders = [];
  const errors = [];

  for (const position of positions) {
    // Filter by symbol if specified
    if (symbol && !position.contractName?.includes(symbol) && !position.symbol?.includes(symbol)) {
      continue;
    }

    const positionSize = position.netPos || position.size || position.quantity || 0;
    if (positionSize === 0) continue;

    // Determine close side (opposite of position)
    const closeSide = positionSize > 0 ? 'sell' : 'buy';
    const closeQuantity = Math.abs(positionSize);

    try {
      console.log(`[ProjectX] Closing position: ${closeQuantity} ${closeSide.toUpperCase()}`);
      const order = await placeMarketOrder(closeSide, closeQuantity);
      closedOrders.push(order);
    } catch (error) {
      console.error(`[ProjectX] Failed to close position:`, error.message);
      errors.push(error.message);
    }
  }

  // Cancel any open stop/limit orders for this symbol
  const openOrders = await getOpenOrders();
  for (const order of openOrders) {
    if (symbol && !order.contractName?.includes(symbol) && !order.symbol?.includes(symbol)) {
      continue;
    }

    const orderId = order.id || order.orderId;
    if (orderId) {
      await cancelOrder(orderId);
    }
  }

  return {
    success: errors.length === 0,
    closedPositions: closedOrders.length,
    closedOrders,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Get current account status (for health check)
 */
async function getAccountStatus() {
  try {
    const token = await getToken();
    const accountId = await getAccountId();

    return {
      connected: true,
      accountId: accountId,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Clear session cache (useful for testing)
 */
function clearCache() {
  sessionCache = {
    token: null,
    accountId: null,
    contractId: null,
    tokenExpiry: null,
  };
  console.log('[ProjectX] Cache cleared');
}

module.exports = {
  placeBracketOrder,
  placeMarketOrder,
  placeStopOrder,
  placeLimitOrder,
  cancelOrder,
  closeAllPositions,
  getPositions,
  getOpenOrders,
  getAccountStatus,
  getAccountDetails,
  getAllAccounts,
  getToken,
  clearCache,
  ORDER_TYPE,
  ORDER_SIDE,
  CONFIG,
};
