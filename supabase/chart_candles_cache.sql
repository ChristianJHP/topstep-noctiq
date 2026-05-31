-- Durable candle cache for /bias charts (run once in Supabase SQL editor)

create table if not exists public.chart_candles_cache (
  cache_key text primary key,
  ticker text not null,
  interval text not null,
  range text not null,
  candles jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now()
);

create index if not exists chart_candles_cache_fetched_at
  on public.chart_candles_cache (fetched_at desc);

-- Optional: service role bypasses RLS; if using anon key, allow read:
-- alter table public.chart_candles_cache enable row level security;
-- create policy "public read" on public.chart_candles_cache for select using (true);
