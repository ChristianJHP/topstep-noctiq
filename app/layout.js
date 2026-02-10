import './globals.css'

export const metadata = {
  title: 'noctiq.ai | Christian - Algo Trading & Market Research',
  description: 'Finding market inefficiencies. Algorithmic trading, futures & options, statistical analysis, and automated trading systems.',
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
