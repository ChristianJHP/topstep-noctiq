/**
 * ProjectX API Client for TopStepX Trading
 * Base URL: https://api.topstepx.com/api
 * Docs: https://gateway.docs.projectx.com
 */

const BASE_URL = 'https://api.topstepx.com/api';

// Order types
const ORDER_TYPE = {
  LIMIT: 1,
  MARKET: 2,
  STOP: 3,
};

// Order sides
const ORDER_SIDE = {
  BUY: 1,
  SELL: 2,
};

// In-memory cache for session data (consider Redis for production)
let sessionCache = {
  token: null,
  accountId: null,
  mesContractId: null,
  tokenExpiry: null,
};

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

  const response = await fetch(`${BASE_URL}/Auth/loginKey`, {
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
 */
async function getToken() {
  if (sessionCache.token && sessionCache.tokenExpiry > Date.now()) {
    return sessionCache.token;
  }
  return await login();
}

/**
 * Search for account ID - Uses hardcoded account if configured for safety
 */
async function getAccountId() {
  // SAFETY: Use hardcoded account ID if configured
  const configuredAccountId = process.env.PROJECTX_ACCOUNT_ID;
  if (configuredAccountId) {
    console.log(`[ProjectX] Using configured account ID: ${configuredAccountId}`);
    sessionCache.accountId = configuredAccountId;
    return configuredAccountId;
  }

  if (sessionCache.accountId) {
    return sessionCache.accountId;
  }

  const token = await getToken();
  console.log('[ProjectX] Fetching account ID...');

  const response = await fetch(`${BASE_URL}/Account/search`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch account: ${error}`);
  }

  const data = await response.json();

  // Assuming the first account is the active one
  const accountId = Array.isArray(data) ? data[0]?.id : data.id;

  if (!accountId) {
    throw new Error('No account found');
  }

  sessionCache.accountId = accountId;
  console.log(`[ProjectX] Account ID: ${accountId}`);
  return accountId;
}

/**
 * Get all accounts (for listing/verification)
 */
async function getAllAccounts() {
  const token = await getToken();
  console.log('[ProjectX] Fetching all accounts...');

  const response = await fetch(`${BASE_URL}/Account/search`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch accounts: ${error}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

/**
 * Get account details including balance
 */
async function getAccountDetails() {
  const token = await getToken();
  const accountId = await getAccountId();

  console.log('[ProjectX] Fetching account details...');

  // Try to get account balance/info
  const response = await fetch(`${BASE_URL}/Account/${accountId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    // Fallback - return basic info from search
    const accounts = await getAllAccounts();
    const account = accounts.find(a => a.id === accountId) || accounts[0];
    return {
      id: accountId,
      name: account?.name || account?.accountName || accountId,
      balance: account?.balance || account?.accountBalance || null,
      canTrade: account?.canTrade ?? account?.isActive ?? true,
      ...account
    };
  }

  const data = await response.json();
  return {
    id: accountId,
    name: data?.name || data?.accountName || accountId,
    balance: data?.balance || data?.accountBalance || null,
    canTrade: data?.canTrade ?? data?.isActive ?? true,
    ...data
  };
}

/**
 * Search for MES contract ID
 */
async function getMESContractId() {
  if (sessionCache.mesContractId) {
    return sessionCache.mesContractId;
  }

  const token = await getToken();
  console.log('[ProjectX] Fetching MES contract ID...');

  const response = await fetch(`${BASE_URL}/Contract/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      symbol: 'MES', // Micro E-mini S&P 500
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch MES contract: ${error}`);
  }

  const data = await response.json();
  const contractId = Array.isArray(data) ? data[0]?.id : data.id;

  if (!contractId) {
    throw new Error('MES contract not found');
  }

  sessionCache.mesContractId = contractId;
  console.log(`[ProjectX] MES Contract ID: ${contractId}`);
  return contractId;
}

/**
 * Place a market order
 * @param {string} side - 'buy' or 'sell'
 * @param {number} quantity - Number of contracts (default: 1)
 */
async function placeMarketOrder(side, quantity = 1) {
  const token = await getToken();
  const accountId = await getAccountId();
  const contractId = await getMESContractId();

  const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  console.log(`[ProjectX] Placing ${side.toUpperCase()} market order for ${quantity} MES contract(s)...`);

  const orderPayload = {
    accountId: accountId,
    contractId: contractId,
    orderType: ORDER_TYPE.MARKET,
    side: orderSide,
    quantity: quantity,
    timeInForce: 1, // Day order (adjust if needed)
  };

  const response = await fetch(`${BASE_URL}/Order/place`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });

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
  const contractId = await getMESContractId();

  const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  console.log(`[ProjectX] Placing stop ${side.toUpperCase()} order at ${stopPrice}...`);

  const orderPayload = {
    accountId: accountId,
    contractId: contractId,
    orderType: ORDER_TYPE.STOP,
    side: orderSide,
    quantity: quantity,
    stopPrice: stopPrice,
    timeInForce: 1, // Day order
  };

  const response = await fetch(`${BASE_URL}/Order/place`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });

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
  const contractId = await getMESContractId();

  const orderSide = side.toLowerCase() === 'buy' ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;

  console.log(`[ProjectX] Placing limit ${side.toUpperCase()} order at ${limitPrice}...`);

  const orderPayload = {
    accountId: accountId,
    contractId: contractId,
    orderType: ORDER_TYPE.LIMIT,
    side: orderSide,
    quantity: quantity,
    price: limitPrice,
    timeInForce: 1, // Day order
  };

  const response = await fetch(`${BASE_URL}/Order/place`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });

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
 * @param {string} action - 'buy' or 'sell'
 * @param {number} stopPrice - Stop loss price
 * @param {number} takeProfitPrice - Take profit price
 * @param {number} quantity - Number of contracts (default: 1)
 */
async function placeBracketOrder(action, stopPrice, takeProfitPrice, quantity = 1) {
  console.log(`[ProjectX] Placing bracket order: ${action.toUpperCase()}, Stop: ${stopPrice}, TP: ${takeProfitPrice}`);

  try {
    // 1. Place market entry order
    const entryOrder = await placeMarketOrder(action, quantity);

    // 2. Place stop loss (opposite side)
    const stopSide = action.toLowerCase() === 'buy' ? 'sell' : 'buy';
    const stopOrder = await placeStopOrder(stopSide, stopPrice, quantity);

    // 3. Place take profit (opposite side)
    const tpSide = action.toLowerCase() === 'buy' ? 'sell' : 'buy';
    const tpOrder = await placeLimitOrder(tpSide, takeProfitPrice, quantity);

    return {
      success: true,
      entry: entryOrder,
      stopLoss: stopOrder,
      takeProfit: tpOrder,
    };
  } catch (error) {
    console.error('[ProjectX] Bracket order failed:', error.message);
    throw error;
  }
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
    mesContractId: null,
    tokenExpiry: null,
  };
  console.log('[ProjectX] Cache cleared');
}

module.exports = {
  placeBracketOrder,
  placeMarketOrder,
  placeStopOrder,
  placeLimitOrder,
  getAccountStatus,
  getAccountDetails,
  getAllAccounts,
  clearCache,
  ORDER_TYPE,
  ORDER_SIDE,
};
