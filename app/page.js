export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Noctiq Trading Automation</h1>
      <p>TradingView to TopStepX automated trading system</p>

      <div style={{ marginTop: '2rem' }}>
        <h2>API Endpoints</h2>
        <ul>
          <li>
            <strong>POST /api/trading/webhook</strong> - TradingView webhook handler
          </li>
          <li>
            <strong>GET /api/trading/status</strong> - System status and health check
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Quick Links</h2>
        <ul>
          <li>
            <a href="/api/trading/status" target="_blank" rel="noopener noreferrer">
              View System Status
            </a>
          </li>
          <li>
            <a href="/api/trading/webhook" target="_blank" rel="noopener noreferrer">
              Webhook Info
            </a>
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
        <h3>Risk Management</h3>
        <ul>
          <li>Max 8 trades per day</li>
          <li>Max $400 daily loss limit</li>
          <li>60 second cooldown between trades</li>
          <li>Trading only during RTH (9:30 AM - 4:00 PM ET)</li>
        </ul>
      </div>
    </main>
  )
}
