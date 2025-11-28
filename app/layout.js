import './globals.css'

export const metadata = {
  title: 'Noctiq | Automated Trading',
  description: 'AI-powered automated trading system for TopStepX',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased text-white min-h-screen">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass-card border-t-0 border-x-0 rounded-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">N</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    <span className="text-white">Noctiq</span>
                    <span className="text-indigo-400">.ai</span>
                  </h1>
                  <p className="text-xs text-gray-500">Automated Trading</p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex items-center gap-6">
                <a href="/" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Dashboard
                </a>
                <a href="/api/trading/status" target="_blank" className="text-sm text-gray-300 hover:text-white transition-colors">
                  API Status
                </a>
              </nav>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="pt-20 pb-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 glass-card border-b-0 border-x-0 rounded-none py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Noctiq Trading Automation v0.1.0</span>
              <span>TopStepX Integration</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
