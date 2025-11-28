export const metadata = {
  title: 'Noctiq Trading Automation',
  description: 'TradingView to TopStepX automated trading system',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
