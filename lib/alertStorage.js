/**
 * Alert Storage - Persistent storage for webhook alerts
 * Uses Supabase for persistence across serverless function invocations
 * Falls back to in-memory if Supabase not configured
 */

let supabase = null;
let supabaseChecked = false;

// In-memory fallback
let memoryAlerts = [];
const MAX_ALERTS = 100;

/**
 * Initialize Supabase client
 */
async function getSupabase() {
  if (supabaseChecked) return supabase;
  supabaseChecked = true;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.warn('[AlertStorage] Supabase not configured, using in-memory fallback');
    supabase = false;
    return supabase;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(url, key);
    console.log('[AlertStorage] Supabase connected');
  } catch (e) {
    console.warn('[AlertStorage] Supabase init error:', e.message);
    supabase = false;
  }

  return supabase;
}

/**
 * Save a new alert
 */
async function saveAlert(alert) {
  const alertWithId = {
    id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...alert,
  };

  const client = await getSupabase();

  if (client) {
    try {
      const { error } = await client
        .from('alerts')
        .insert({
          alert_id: alertWithId.id,
          action: alertWithId.action,
          symbol: alertWithId.symbol || 'MNQ',
          account: alertWithId.account,
          status: alertWithId.status,
          stop_price: alertWithId.stop || null,
          tp_price: alertWithId.tp || null,
          error_msg: alertWithId.error || null,
          created_at: alertWithId.timestamp,
        });

      if (error) {
        console.error('[AlertStorage] Supabase insert error:', error.message);
      } else {
        console.log(`[AlertStorage] Saved alert to Supabase: ${alertWithId.id}`);
        return alertWithId;
      }
    } catch (e) {
      console.error('[AlertStorage] Supabase save error:', e.message);
    }
  }

  // Fallback to memory
  memoryAlerts = [alertWithId, ...memoryAlerts].slice(0, MAX_ALERTS);
  console.log(`[AlertStorage] Saved alert to memory: ${alertWithId.id}`);
  return alertWithId;
}

/**
 * Get all alerts
 */
async function getAlerts(limit = 50) {
  const client = await getSupabase();

  if (client) {
    try {
      const { data, error } = await client
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[AlertStorage] Supabase fetch error:', error.message);
      } else if (data) {
        // Map to expected format
        return data.map(row => ({
          id: row.alert_id,
          timestamp: row.created_at,
          action: row.action,
          symbol: row.symbol,
          account: row.account,
          status: row.status,
          stop: row.stop_price,
          tp: row.tp_price,
          error: row.error_msg,
        }));
      }
    } catch (e) {
      console.error('[AlertStorage] Supabase get error:', e.message);
    }
  }

  // Fallback to memory
  return memoryAlerts.slice(0, limit);
}

/**
 * Get alerts for today only
 */
async function getTodayAlerts() {
  const client = await getSupabase();
  const today = new Date().toISOString().split('T')[0];

  if (client) {
    try {
      const { data, error } = await client
        .from('alerts')
        .select('*')
        .gte('created_at', `${today}T00:00:00`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AlertStorage] Supabase today fetch error:', error.message);
      } else if (data) {
        return data.map(row => ({
          id: row.alert_id,
          timestamp: row.created_at,
          action: row.action,
          symbol: row.symbol,
          status: row.status,
        }));
      }
    } catch (e) {
      console.error('[AlertStorage] Supabase today get error:', e.message);
    }
  }

  // Fallback to memory
  return memoryAlerts.filter(alert => {
    const alertDate = alert.timestamp?.split('T')[0];
    return alertDate === today;
  });
}

/**
 * Clear all alerts (for testing)
 */
async function clearAlerts() {
  const client = await getSupabase();

  if (client) {
    try {
      await client.from('alerts').delete().neq('id', 0);
      console.log('[AlertStorage] Cleared alerts from Supabase');
    } catch (e) {
      console.error('[AlertStorage] Supabase clear error:', e.message);
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
