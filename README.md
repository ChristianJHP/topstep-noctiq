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

## License

Private use only.
