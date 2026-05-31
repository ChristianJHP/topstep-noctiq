/**
 * Multi-Account Configuration System
 *
 * Supports multiple brokers and accounts:
 * - TopStepX (ProjectX API)
 * - Futures Desk (to be implemented)
 * - Additional brokers can be added
 *
 * CONFIGURATION:
 * Set up accounts via environment variables or this configuration
 * Each account has a unique ID used for routing webhooks
 */

// Broker types
const BROKER_TYPE = {
  TOPSTEPX: 'topstepx',
  FUTURES_DESK: 'futuresdesk',
  // Add more brokers here
};

/**
 * Account configuration loaded from environment
 * Format: ACCOUNT_{ID}_* for each account
 *
 * Example for multiple accounts:
 * ACCOUNT_TOPSTEP1_BROKER=topstepx
 * ACCOUNT_TOPSTEP1_USERNAME=user@email.com
 * ACCOUNT_TOPSTEP1_API_KEY=xxx
 * ACCOUNT_TOPSTEP1_ACCOUNT_ID=50KTC-...
 * ACCOUNT_TOPSTEP1_WEBHOOK_SECRET=xxx
 *
 * ACCOUNT_TOPSTEP2_BROKER=topstepx
 * ACCOUNT_TOPSTEP2_USERNAME=user@email.com
 * ACCOUNT_TOPSTEP2_API_KEY=yyy
 * ...
 */

// In-memory account registry
const accounts = new Map();

// Webhook secret to account ID mapping
const secretToAccountMap = new Map();

/**
 * Parse environment variables to build account configurations
 */
function loadAccountsFromEnv() {
  accounts.clear();
  secretToAccountMap.clear();

  // First check for legacy single-account config (backwards compatibility)
  if (process.env.PROJECTX_USERNAME && process.env.PROJECTX_API_KEY) {
    const legacyAccount = {
      id: 'default',
      name: 'Primary TopStepX Account',
      broker: BROKER_TYPE.TOPSTEPX,
      enabled: true,
      config: {
        username: process.env.PROJECTX_USERNAME,
        apiKey: process.env.PROJECTX_API_KEY,
        accountId: process.env.PROJECTX_ACCOUNT_ID,
      },
      webhookSecret: process.env.WEBHOOK_SECRET,
    };

    accounts.set('default', legacyAccount);

    if (process.env.WEBHOOK_SECRET) {
      secretToAccountMap.set(process.env.WEBHOOK_SECRET, 'default');
    }

    console.log('[Accounts] Loaded legacy single-account config as "default"');
  }

  // Then look for multi-account config pattern: ACCOUNT_{ID}_{FIELD}
  const accountPattern = /^ACCOUNT_([A-Z0-9]+)_([A-Z_]+)$/;
  const accountConfigs = {};

  for (const [key, value] of Object.entries(process.env)) {
    const match = key.match(accountPattern);
    if (match) {
      const [, accountId, field] = match;
      if (!accountConfigs[accountId]) {
        accountConfigs[accountId] = {};
      }
      accountConfigs[accountId][field] = value;
    }
  }

  // Process each discovered account
  for (const [accountId, config] of Object.entries(accountConfigs)) {
    const account = {
      id: accountId.toLowerCase(),
      name: config.NAME || `Account ${accountId}`,
      broker: (config.BROKER || 'topstepx').toLowerCase(),
      enabled: config.ENABLED !== 'false',
      config: {
        username: config.USERNAME,
        apiKey: config.API_KEY,
        accountId: config.ACCOUNT_ID,
        // Broker-specific config
        baseUrl: config.BASE_URL,
      },
      webhookSecret: config.WEBHOOK_SECRET,
    };

    // Validate required fields
    if (!account.config.username || !account.config.apiKey) {
      console.warn(`[Accounts] Skipping account ${accountId}: missing USERNAME or API_KEY`);
      continue;
    }

    accounts.set(account.id, account);

    // Map webhook secret to account
    if (account.webhookSecret) {
      secretToAccountMap.set(account.webhookSecret, account.id);
    }

    console.log(`[Accounts] Loaded account: ${account.id} (${account.broker})`);
  }

  console.log(`[Accounts] Total accounts loaded: ${accounts.size}`);
  return accounts.size;
}

/**
 * Get account by ID
 */
function getAccount(accountId) {
  return accounts.get(accountId);
}

/**
 * Get account by webhook secret
 * Used for routing incoming webhooks to the correct account
 */
function getAccountBySecret(secret) {
  const accountId = secretToAccountMap.get(secret);
  if (accountId) {
    return accounts.get(accountId);
  }
  return null;
}

/**
 * Get all configured accounts
 */
function getAllAccounts() {
  return Array.from(accounts.values());
}

/**
 * Get all enabled accounts
 */
function getEnabledAccounts() {
  return Array.from(accounts.values()).filter(a => a.enabled);
}

/**
 * Add or update an account programmatically
 */
function registerAccount(account) {
  if (!account.id) {
    throw new Error('Account must have an ID');
  }

  accounts.set(account.id, account);

  if (account.webhookSecret) {
    secretToAccountMap.set(account.webhookSecret, account.id);
  }

  console.log(`[Accounts] Registered account: ${account.id}`);
  return account;
}

/**
 * Remove an account
 */
function removeAccount(accountId) {
  const account = accounts.get(accountId);
  if (account && account.webhookSecret) {
    secretToAccountMap.delete(account.webhookSecret);
  }
  return accounts.delete(accountId);
}

/**
 * Check if a webhook secret is valid for any account
 */
function isValidSecret(secret) {
  return secretToAccountMap.has(secret);
}

/**
 * Get account summary (safe for public display)
 */
function getAccountSummary() {
  return Array.from(accounts.values()).map(account => ({
    id: account.id,
    name: account.name,
    broker: account.broker,
    enabled: account.enabled,
    hasWebhookSecret: !!account.webhookSecret,
  }));
}

// Load accounts on module import
loadAccountsFromEnv();

module.exports = {
  BROKER_TYPE,
  loadAccountsFromEnv,
  getAccount,
  getAccountBySecret,
  getAllAccounts,
  getEnabledAccounts,
  registerAccount,
  removeAccount,
  isValidSecret,
  getAccountSummary,
};
