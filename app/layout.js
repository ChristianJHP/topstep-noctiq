import './globals.css'

export const metadata = {
  title: 'Noctiq',
  description: 'Trading dashboard',
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
