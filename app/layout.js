import './globals.css'

export const metadata = {
  title: 'Christian Park | Trader, Creator, Builder',
  description: 'Algo trading, futures markets, and building things on the internet. Follow along on Instagram, YouTube, and TikTok.',
  icons: {
    icon: '/favicon.ico',
  },
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
