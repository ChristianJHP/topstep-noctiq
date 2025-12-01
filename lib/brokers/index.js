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

/**
 * Create a TopStepX (ProjectX) broker client
 */
function createTopStepXClient(accountConfig) {
  // Use the existing projectx module but with account-specific config
  const projectx = require('../projectx');

  // For the default account, use the singleton projectx module
  // For additional accounts, we'll need to create isolated instances
  // This is a simplified version - in production you'd want full isolation

  return {
    name: 'TopStepX',
    type: BROKER_TYPE.TOPSTEPX,

    async placeBracketOrder(action, stopPrice, tpPrice, quantity = 1) {
      return projectx.placeBracketOrder(action, stopPrice, tpPrice, quantity);
    },

    async placeMarketOrder(side, quantity = 1) {
      return projectx.placeMarketOrder(side, quantity);
    },

    async placeStopOrder(side, stopPrice, quantity = 1) {
      return projectx.placeStopOrder(side, stopPrice, quantity);
    },

    async placeLimitOrder(side, limitPrice, quantity = 1) {
      return projectx.placeLimitOrder(side, limitPrice, quantity);
    },

    async cancelOrder(orderId) {
      return projectx.cancelOrder(orderId);
    },

    async closeAllPositions(symbol = null) {
      return projectx.closeAllPositions(symbol);
    },

    async getPositions() {
      return projectx.getPositions();
    },

    async getOpenOrders() {
      return projectx.getOpenOrders();
    },

    async getAccountStatus() {
      return projectx.getAccountStatus();
    },

    async getAccountDetails() {
      return projectx.getAccountDetails();
    },
  };
}

/**
 * Create a Futures Desk broker client (placeholder)
 * TODO: Implement when Futures Desk API documentation is available
 */
function createFuturesDeskClient(accountConfig) {
  const BASE_URL = accountConfig.baseUrl || 'https://api.futuresdesk.com'; // Placeholder

  return {
    name: 'Futures Desk',
    type: BROKER_TYPE.FUTURES_DESK,

    async placeBracketOrder(action, stopPrice, tpPrice, quantity = 1) {
      // TODO: Implement Futures Desk bracket order
      throw new Error('Futures Desk integration not yet implemented');
    },

    async placeMarketOrder(side, quantity = 1) {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async placeStopOrder(side, stopPrice, quantity = 1) {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async placeLimitOrder(side, limitPrice, quantity = 1) {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async cancelOrder(orderId) {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async closeAllPositions(symbol = null) {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async getPositions() {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async getOpenOrders() {
      throw new Error('Futures Desk integration not yet implemented');
    },

    async getAccountStatus() {
      return {
        connected: false,
        error: 'Futures Desk integration not yet implemented',
        timestamp: new Date().toISOString(),
      };
    },

    async getAccountDetails() {
      throw new Error('Futures Desk integration not yet implemented');
    },
  };
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
