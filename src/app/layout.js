import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'JHP Trades',
  description: 'Fix your execution. Get funded. Real trades, journaling, and direct feedback — no signals.',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
