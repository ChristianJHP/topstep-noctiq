# JHP Trades (jhptrades.com)

Unified site based on [topstep-noctiq@2ce016e](https://github.com/ChristianJHP/topstep-noctiq/commit/2ce016ea58247861593ec81d14f2f472dff802d0) with **Daily Bias** at `/bias`.

## Routes

| Path | Description |
|------|-------------|
| `/` | JHP Trades landing page |
| `/bias` | Daily Bias — NQ/ES structure & levels |
| `/dashboard` | Live charts & trading dashboard |
| `/apply` | 1-on-1 mentorship application |
| `/api/trading/webhook` | TradingView → TopStepX webhook |
| `/api/radar`, `/api/headlines`, `/api/chart` | Daily Bias data |

## Daily Bias (`/bias`)

Mobile-first futures radar. Glance and leave — no journaling, no uploads.

| UI | Source | Refresh |
|----|--------|---------|
| 4H / 1H timers | Client-side ET clock | Every second |
| Market status | NQ=F hourly → 4H aggregation (Yahoo Finance) | ~60s |
| News + Calendar | USD macro events (ForexFactory) | ~60s |
| NQ / ES charts | Yahoo Finance OHLC | ~60s |
| Headlines | FinancialJuice RSS | ~90s |

No env vars required for the radar.

## Trading / Dashboard

Copy `.env.example` to `.env.local` and configure:

- `PROJECTX_USERNAME`, `PROJECTX_API_KEY`, `PROJECTX_ACCOUNT_ID`
- `WEBHOOK_SECRET`
- `AUTH_USERNAME`, `AUTH_PASSWORD` (dashboard)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (daily briefings, optional)
- `NEXT_PUBLIC_FINNHUB_API_KEY` (news/calendar, optional)

## Run

```bash
npm install
npm run dev
```

- Home: http://localhost:3000
- Daily Bias: http://localhost:3000/bias
- Dashboard: http://localhost:3000/dashboard

## Deploy

Deploy to Vercel. Set trading env vars in the project dashboard. The briefing cron is configured in `vercel.json`.

## Project structure

```
src/
├── app/
│   ├── page.js              # JHP Trades home
│   ├── bias/                # Daily Bias
│   ├── dashboard/           # Live charts
│   ├── api/
│   │   ├── trading/         # TopStepX webhooks & status
│   │   ├── radar/           # Radar snapshot
│   │   ├── headlines/       # RSS headlines
│   │   └── chart/           # Chart OHLC
│   └── …                    # apply, briefing, referrals, etc.
├── components/              # Radar UI
└── lib/                     # Radar + trading libs
```
