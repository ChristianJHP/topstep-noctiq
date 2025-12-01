/**
 * Alert Storage - Persistent storage for webhook alerts
 * Uses Vercel KV for persistence across serverless function invocations
 */

let kv = null;
let kvChecked = false;

// Try to import Vercel KV - will fail gracefully if not configured
async function getKV() {
  if (kvChecked) return kv;

  kvChecked = true;

  // Check if KV env vars are present
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn('[AlertStorage] KV env vars not set, using in-memory fallback');
    kv = false;
    return kv;
  }

  try {
    const { kv: vercelKV } = await import('@vercel/kv');
    kv = vercelKV;
    console.log('[AlertStorage] Vercel KV connected');
  } catch (e) {
    console.warn('[AlertStorage] Vercel KV not available:', e.message);
    kv = false;
  }
  return kv;
}

// In-memory fallback for development
let memoryAlerts = [];

const ALERTS_KEY = 'noctiq:alerts';
const MAX_ALERTS = 100; // Keep last 100 alerts

/**
 * Save a new alert
 */
async function saveAlert(alert) {
  const alertWithId = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...alert,
  };

  const kvClient = await getKV();

  if (kvClient) {
    try {
      // Get existing alerts
      const existing = await kvClient.get(ALERTS_KEY) || [];

      // Add new alert at the beginning
      const updated = [alertWithId, ...existing].slice(0, MAX_ALERTS);

      // Save back to KV
      await kvClient.set(ALERTS_KEY, updated);

      console.log(`[AlertStorage] Saved alert to KV: ${alertWithId.id}`);
      return alertWithId;
    } catch (e) {
      console.error('[AlertStorage] KV save error:', e);
    }
  }

  // Fallback to memory
  memoryAlerts = [alertWithId, ...memoryAlerts].slice(0, MAX_ALERTS);
  console.log(`[AlertStorage] Saved alert to memory: ${alertWithId.id}`);
  return alertWithId;
}

/**
 * Get all alerts with timeout
 */
async function getAlerts(limit = 50) {
  const kvClient = await getKV();

  if (kvClient) {
    try {
      // Add 3 second timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('KV timeout')), 3000)
      );
      const alerts = await Promise.race([
        kvClient.get(ALERTS_KEY),
        timeoutPromise
      ]) || [];
      return alerts.slice(0, limit);
    } catch (e) {
      console.error('[AlertStorage] KV get error:', e.message);
    }
  }

  // Fallback to memory
  return memoryAlerts.slice(0, limit);
}

/**
 * Get alerts for today only
 */
async function getTodayAlerts() {
  const alerts = await getAlerts(MAX_ALERTS);
  const today = new Date().toISOString().split('T')[0];

  return alerts.filter(alert => {
    const alertDate = alert.timestamp?.split('T')[0];
    return alertDate === today;
  });
}

/**
 * Clear all alerts (for testing/reset)
 */
async function clearAlerts() {
  const kvClient = await getKV();

  if (kvClient) {
    try {
      await kvClient.del(ALERTS_KEY);
      console.log('[AlertStorage] Cleared alerts from KV');
    } catch (e) {
      console.error('[AlertStorage] KV clear error:', e);
    }
  }

  memoryAlerts = [];
}

module.exports = {
  saveAlert,
  getAlerts,
  getTodayAlerts,
  clearAlerts,
};
