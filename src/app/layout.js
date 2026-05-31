import './globals.css'

export const metadata = {
  title: 'JHP Trades',
  description: 'Fix your execution. Get funded. Real trades, journaling, and direct feedback — no signals.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
