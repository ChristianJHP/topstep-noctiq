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
          account: row.account,
          status: row.status,
          stop: row.stop_price,
          tp: row.tp_price,
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

/**
 * Save daily P&L snapshot
 * Call this when account balance updates or at end of day
 */
async function saveDailyPnL(accountId, date, pnl, balance, tradeCount) {
  const client = await getSupabase();

  if (!client) {
    console.warn('[AlertStorage] Cannot save P&L - Supabase not configured');
    return null;
  }

  try {
    // Upsert - update if exists for today, insert if new
    const { data, error } = await client
      .from('daily_pnl')
      .upsert({
        account_id: accountId,
        date: date,
        pnl: pnl,
        balance: balance,
        trade_count: tradeCount,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'account_id,date'
      });

    if (error) {
      console.error('[AlertStorage] Supabase P&L save error:', error.message);
      return null;
    }

    console.log(`[AlertStorage] Saved daily P&L for ${accountId}: $${pnl}`);
    return { accountId, date, pnl, balance, tradeCount };
  } catch (e) {
    console.error('[AlertStorage] P&L save error:', e.message);
    return null;
  }
}

/**
 * Get historical P&L data for an account
 * @param {string} accountId - Account ID
 * @param {number} days - Number of days to fetch (default 30)
 */
async function getHistoricalPnL(accountId, days = 30) {
  const client = await getSupabase();

  if (!client) {
    console.warn('[AlertStorage] Cannot get P&L history - Supabase not configured');
    return [];
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await client
      .from('daily_pnl')
      .select('*')
      .eq('account_id', accountId)
      .gte('date', startDateStr)
      .order('date', { ascending: true });

    if (error) {
      console.error('[AlertStorage] Supabase P&L fetch error:', error.message);
      return [];
    }

    return data.map(row => ({
      date: row.date,
      pnl: row.pnl,
      balance: row.balance,
      tradeCount: row.trade_count,
    }));
  } catch (e) {
    console.error('[AlertStorage] P&L fetch error:', e.message);
    return [];
  }
}

/**
 * Get combined historical P&L for all accounts
 */
async function getAllHistoricalPnL(days = 30) {
  const client = await getSupabase();

  if (!client) {
    return [];
  }

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await client
      .from('daily_pnl')
      .select('*')
      .gte('date', startDateStr)
      .order('date', { ascending: true });

    if (error) {
      console.error('[AlertStorage] Supabase all P&L fetch error:', error.message);
      return [];
    }

    return data.map(row => ({
      accountId: row.account_id,
      date: row.date,
      pnl: row.pnl,
      balance: row.balance,
      tradeCount: row.trade_count,
    }));
  } catch (e) {
    console.error('[AlertStorage] All P&L fetch error:', e.message);
    return [];
  }
}

module.exports = {
  saveAlert,
  getAlerts,
  getTodayAlerts,
  clearAlerts,
  saveDailyPnL,
  getHistoricalPnL,
  getAllHistoricalPnL,
};
