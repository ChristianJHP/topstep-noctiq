# Noctiq Trading Automation

TradingView webhook to TopStepX automated trading system for MES futures.

## Features

- Receives TradingView alerts via webhook
- Executes bracket orders (entry + stop loss + take profit) on MES futures
- Built-in risk management:
  - Max 8 trades per day
  - Max $400 daily loss limit
  - 60 second cooldown between trades
  - Only trades during RTH (9:30 AM - 4:00 PM ET)
- Real-time system status monitoring
- Extensive logging for debugging

## Tech Stack

- Next.js 15 with App Router
- ProjectX API for TopStepX trading
- Deployed on Vercel (noctiq.ai)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your credentials:

```env
PROJECTX_USERNAME=christian.park2002@gmail.com
PROJECTX_API_KEY=your-new-api-key-here
WEBHOOK_SECRET=your-random-secret-here
```

**IMPORTANT: Regenerate your ProjectX API key** from the TopStepX/ProjectX dashboard for security.

To generate a webhook secret, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Testing

### Test 1: Check System Status

```bash
curl http://localhost:3000/api/trading/status
```

Expected response:
```json
{
  "status": "healthy",
  "projectx": {
    "connected": true,
    "accountId": "..."
  },
  "trading": {
    "withinRTH": true,
    "canTrade": true
  },
  "dailyStats": {
    "tradesExecuted": 0,
    "tradesRemaining": 8
  }
}
```

### Test 2: Test Webhook (BUY order)

```bash
curl -X POST http://localhost:3000/api/trading/webhook \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"your-webhook-secret\",\"action\":\"buy\",\"stop\":6800.00,\"tp\":6850.00}"
```

Expected response:
```json
{
  "success": true,
  "message": "BUY order executed successfully",
  "action": "buy",
  "orders": {
    "entry": {...},
    "stopLoss": {...},
    "takeProfit": {...}
  },
  "dailyStats": {
    "tradesExecuted": 1,
    "tradesRemaining": 7
  }
}
```

### Test 3: Test Webhook (SELL order)

```bash
curl -X POST http://localhost:3000/api/trading/webhook \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"your-webhook-secret\",\"action\":\"sell\",\"stop\":6900.00,\"tp\":6850.00}"
```

### Test 4: Test Risk Management (Cooldown)

Run the BUY test again within 60 seconds. Expected response:
```json
{
  "success": false,
  "error": "Trade blocked by risk management",
  "reason": "Cooldown period active (45s remaining)"
}
```

### Test 5: Test Invalid Secret

```bash
curl -X POST http://localhost:3000/api/trading/webhook \
  -H "Content-Type: application/json" \
  -d "{\"secret\":\"wrong-secret\",\"action\":\"buy\",\"stop\":6800.00,\"tp\":6850.00}"
```

Expected response:
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

## TradingView Setup

### 1. Create Alert in TradingView

1. Open your indicator/strategy on TradingView
2. Click "Create Alert" (alarm icon)
3. Configure alert conditions (e.g., when indicator fires LONG/SHORT signal)

### 2. Configure Webhook URL

In the alert settings:

**For Production (Vercel):**
```
https://noctiq.ai/api/trading/webhook
```

**For Local Testing:**
```
http://localhost:3000/api/trading/webhook
```

### 3. Set Alert Message

For a **BUY** signal:
```json
{"secret":"your-webhook-secret","action":"buy","stop":6800.00,"tp":6850.00}
```

For a **SELL** signal:
```json
{"secret":"your-webhook-secret","action":"sell","stop":6900.00,"tp":6850.00}
```

**TIP:** Use TradingView's Pine Script variables to dynamically set stop and TP:
```json
{"secret":"your-webhook-secret","action":"buy","stop":{{plot_0}},"tp":{{plot_1}}}
```

Where `plot_0` and `plot_1` are your indicator's plotted stop loss and take profit levels.

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: TradingView to TopStepX automation"
git branch -M main
git remote add origin https://github.com/yourusername/noctiq-trading.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Configure environment variables:
   - `PROJECTX_USERNAME`
   - `PROJECTX_API_KEY`
   - `WEBHOOK_SECRET`
4. Deploy!

### 3. Verify Deployment

```bash
curl https://noctiq.ai/api/trading/status
```

## Project Structure

```
topstep-noctiq/
├── app/
│   ├── api/
│   │   └── trading/
│   │       ├── webhook/
│   │       │   └── route.js       # TradingView webhook handler
│   │       └── status/
│   │           └── route.js       # System status endpoint
│   ├── layout.js                  # Root layout
│   └── page.js                    # Homepage
├── lib/
│   ├── projectx.js                # ProjectX API client
│   └── riskManager.js             # Risk management module
├── .env.example                   # Environment variables template
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```

## API Reference

### POST /api/trading/webhook

Receives TradingView alerts and executes trades.

**Request Body:**
```json
{
  "secret": "string (required)",
  "action": "buy|sell|close (required)",
  "stop": "number (required for buy/sell)",
  "tp": "number (required for buy/sell)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "BUY order executed successfully",
  "action": "buy",
  "orders": {...},
  "dailyStats": {...},
  "executionTimeMs": 1234,
  "timestamp": "2025-11-28T12:00:00.000Z"
}
```

### GET /api/trading/status

Returns system health and trading statistics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-28T12:00:00.000Z",
  "etTime": "11/28/2025, 7:00:00 AM",
  "projectx": {
    "connected": true,
    "accountId": "..."
  },
  "trading": {
    "withinRTH": true,
    "canTrade": true
  },
  "dailyStats": {
    "tradesExecuted": 3,
    "tradesRemaining": 5,
    "totalProfit": 150,
    "totalLoss": 50
  },
  "riskLimits": {...}
}
```

## Risk Management Rules

1. **Max Trades Per Day:** 8 trades
2. **Max Daily Loss:** $400
3. **Cooldown Period:** 60 seconds between trades
4. **Trading Hours:** 9:30 AM - 4:00 PM ET (Regular Trading Hours)

All rules are enforced automatically. Trades that violate any rule will be rejected with a detailed reason.

## Logging

All webhook requests, trade executions, and errors are logged to console with timestamps. Monitor logs in Vercel dashboard or local terminal.

## Troubleshooting

### "Unauthorized" error
- Check that your `WEBHOOK_SECRET` matches in both `.env.local` and TradingView alert message

### "Authentication failed"
- Verify your `PROJECTX_API_KEY` is valid and not expired
- Regenerate API key from TopStepX/ProjectX dashboard if needed

### "Outside regular trading hours"
- System only trades 9:30 AM - 4:00 PM ET
- Check current ET time in status endpoint

### "Cooldown period active"
- Wait 60 seconds between trades
- Check `lastTradeTime` in status endpoint

### Orders not executing
- Check logs in Vercel dashboard or terminal
- Verify system status: `curl https://noctiq.ai/api/trading/status`
- Ensure ProjectX account is active and funded

## Security Notes

- Never commit `.env.local` to Git
- Regenerate API keys periodically
- Use a strong random webhook secret
- Monitor trades regularly
- Start with paper trading to test the system

## Support

For issues or questions:
- Check logs first
- Review `/api/trading/status` for system health
- Verify TradingView webhook is sending correct format

## Truth Social Alerts Setup

Polls Trump's Truth Social account every minute via cron-job.org and forwards new posts to a Discord channel. No paid hosting required — runs entirely on Vercel serverless functions with Supabase for deduplication.

### 1. Supabase SQL

Run this in the Supabase SQL editor (already included in `supabase/schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS truthsocial_alerts (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  content TEXT,
  url TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ,
  sent_to_discord_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truthsocial_alerts_created_at
ON truthsocial_alerts(created_at DESC);
```

### 2. Environment Variables (add in Vercel dashboard)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Already set — your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Already set — Supabase service role key |
| `DISCORD_TRUTH_WEBHOOK_URL` | Discord webhook URL for the alert channel |
| `CRON_SECRET` | Random secret token to authenticate cron requests |
| `TRUTH_SOCIAL_USERNAME` | Truth Social handle to monitor (default: `realDonaldTrump`) |

Generate a `CRON_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Create a Discord Webhook

1. Open your Discord server and go to the channel you want alerts in.
2. Click **Edit Channel** → **Integrations** → **Webhooks** → **New Webhook**.
3. Give it a name (e.g. "Trump Alerts") and copy the webhook URL.
4. Paste the URL as `DISCORD_TRUTH_WEBHOOK_URL` in Vercel.

### 4. Set Up cron-job.org

1. Sign up free at [cron-job.org](https://cron-job.org).
2. Create a new cron job with these settings:
   - **URL:** `https://jhptrades.com/api/truthsocial/check?secret=YOUR_CRON_SECRET`
   - **Schedule:** Every 1 minute (`* * * * *`)
   - **Request method:** GET
3. Save and enable the job.

### 5. Test Manually

Browser or curl:
```bash
curl "https://jhptrades.com/api/truthsocial/check?secret=YOUR_CRON_SECRET"
```

Expected response when no new posts:
```json
{ "ok": true, "checked": 10, "sent": 0, "duplicates": 10, "errors": [] }
```

Expected response when a new post is forwarded:
```json
{ "ok": true, "checked": 10, "sent": 1, "duplicates": 9, "errors": [] }
```

If Truth Social blocks the request:
```json
{ "ok": false, "error": "Account lookup failed: HTTP 403 — ...", ... }
```

The endpoint URL to paste into cron-job.org:
```
https://jhptrades.com/api/truthsocial/check?secret=YOUR_CRON_SECRET
```

## License

Private use only.
