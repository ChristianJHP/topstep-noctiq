-- Noctiq Trading Automation - Supabase Schema
-- Run this in your Supabase SQL editor

-- Alerts table (if not exists)
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_id TEXT UNIQUE NOT NULL,
  action TEXT NOT NULL,
  symbol TEXT DEFAULT 'MNQ',
  account TEXT,
  status TEXT,
  stop_price DECIMAL,
  tp_price DECIMAL,
  error_msg TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily P&L table for historical tracking
CREATE TABLE IF NOT EXISTS daily_pnl (
  id BIGSERIAL PRIMARY KEY,
  account_id TEXT NOT NULL,
  date DATE NOT NULL,
  pnl DECIMAL NOT NULL DEFAULT 0,
  balance DECIMAL,
  trade_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, date)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_pnl_account_date
ON daily_pnl(account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at
ON alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_account
ON alerts(account);
