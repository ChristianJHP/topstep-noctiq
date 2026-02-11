'use client'

import { useState, useEffect, useRef } from 'react'

// ── Hooks ───────────────────────────────────────────────────────────────────

function useFadeIn(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, visible]
}

function FadeIn({ children, className = '', delay = 0 }) {
  const [ref, visible] = useFadeIn()
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// ── Social Icons ────────────────────────────────────────────────────────────

function InstagramIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}

function YouTubeIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function TikTokIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
    </svg>
  )
}

function ArrowIcon({ className = 'w-3 h-3' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

// ── Background ──────────────────────────────────────────────────────────────

function GridBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />
      <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-indigo-500/[0.03] blur-[150px]" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[600px] h-[600px] rounded-full bg-purple-500/[0.025] blur-[120px]" />
    </div>
  )
}

// ── TradingView Chart ───────────────────────────────────────────────────────

function TradingViewChart() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "PEPPERSTONE:NAS100",
      interval: "5",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(10, 10, 10, 1)",
      gridColor: "rgba(30, 30, 30, 1)",
      hide_top_toolbar: false,
      hide_legend: true,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      hide_volume: true,
      support_host: "https://www.tradingview.com"
    })

    containerRef.current.appendChild(script)
  }, [])

  return (
    <div className="tradingview-widget-container" style={{ height: '500px', width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} className="tradingview-widget-container__widget" />
    </div>
  )
}

// ── AI Market Brief ─────────────────────────────────────────────────────────

function AIMarketBrief() {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generatedAt, setGeneratedAt] = useState(null)

  useEffect(() => {
    async function fetchBrief() {
      try {
        const res = await fetch('/api/market/brief')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        setBrief(data.brief)
        setGeneratedAt(data.generatedAt)
      } catch {
        setBrief(null)
      } finally {
        setLoading(false)
      }
    }
    fetchBrief()
  }, [])

  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }) + ' ET'
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 sm:p-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Market Brief</h3>
            {generatedAt && (
              <p className="text-[10px] text-neutral-600">Updated {formatTime(generatedAt)}</p>
            )}
          </div>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2.5">
          <div className="h-3 bg-white/[0.04] rounded-full w-full animate-pulse" />
          <div className="h-3 bg-white/[0.04] rounded-full w-4/5 animate-pulse" />
          <div className="h-3 bg-white/[0.04] rounded-full w-3/5 animate-pulse" />
        </div>
      ) : brief ? (
        <div className="text-sm text-neutral-400 leading-relaxed whitespace-pre-line">{brief}</div>
      ) : (
        <p className="text-sm text-neutral-600 italic">Market brief currently unavailable.</p>
      )}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white relative">
      <GridBackground />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">
            Christian Park
          </span>
          <div className="flex items-center gap-3">
            <a href="https://www.instagram.com/christiannpark" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-pink-400 transition-colors" aria-label="Instagram">
              <InstagramIcon className="w-4 h-4" />
            </a>
            <a href="https://www.youtube.com/@christiannpark" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-red-400 transition-colors" aria-label="YouTube">
              <YouTubeIcon className="w-4 h-4" />
            </a>
            <a href="https://www.tiktok.com/@jung.ho.p" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-cyan-400 transition-colors" aria-label="TikTok">
              <TikTokIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 sm:pt-40 pb-20 sm:pb-28 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-neutral-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Algo trading &middot; Futures &middot; Content
            </div>
          </FadeIn>

          <FadeIn delay={100}>
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6">
              Christian{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                Park
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              I build automated trading systems for Nasdaq futures and break down
              exactly how they work &mdash; the code, the math, and the risk management.
              No fluff, just the real stuff.
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://www.youtube.com/@christiannpark"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <YouTubeIcon className="w-4 h-4" />
                Watch on YouTube
              </a>
              <a
                href="https://www.tiktok.com/@jung.ho.p"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <TikTokIcon className="w-4 h-4" />
                @jung.ho.p
              </a>
              <a
                href="https://www.instagram.com/christiannpark"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <InstagramIcon className="w-4 h-4" />
                @christiannpark
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Nasdaq Futures Live Price ── */}
      <section className="px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Nasdaq Futures</h2>
                <p className="text-sm text-neutral-500 mt-1">NAS100 &mdash; live chart</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Live</span>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-[#111113]">
              <TradingViewChart />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── AI Market Brief ── */}
      <section className="px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <AIMarketBrief />
          </FadeIn>
        </div>
      </section>

      {/* ── What I cover ── */}
      <section className="px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">What I cover</h2>
            <p className="text-neutral-500 max-w-lg mb-10">
              Everything I post is stuff I actually use. No theory-only content.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Automated Systems',
                desc: 'TradingView signals to live execution via webhooks, with bracket orders and risk limits.',
                accent: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Backtesting & Stats',
                desc: 'Monte Carlo sims, walk-forward optimization, and how to know if your edge is real.',
                accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Risk Management',
                desc: 'ATR-based stops, daily loss caps, position sizing, and why capital preservation comes first.',
                accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
                title: 'The Code',
                desc: 'Pine Script, Python, Next.js. I show the actual code behind everything I build.',
                accent: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="group h-full p-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] transition-all duration-300">
                  <div className={`w-10 h-10 rounded-xl ${item.accent} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <h3 className="text-white font-semibold mb-1.5 text-sm">{item.title}</h3>
                  <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Content / Where to find me ── */}
      <section className="px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10">Where to find me</h2>
          </FadeIn>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* TikTok */}
            <FadeIn delay={0}>
              <a
                href="https://www.tiktok.com/@jung.ho.p"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-cyan-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                    <TikTokIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">TikTok</div>
                    <div className="text-xs text-neutral-500">@jung.ho.p</div>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-neutral-600 ml-auto group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Short-form breakdowns of algo trading, backtesting frameworks, and how I built my automated system from scratch.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Algo Trading Tutorial', 'ATR-Based Stops', 'My Trading Journey'].map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            </FadeIn>

            {/* YouTube */}
            <FadeIn delay={100}>
              <a
                href="https://www.youtube.com/@christiannpark"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-red-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                    <YouTubeIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">YouTube</div>
                    <div className="text-xs text-neutral-500">@christiannpark</div>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-neutral-600 ml-auto group-hover:text-red-400 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Longer deep dives, full strategy walkthroughs, and behind-the-scenes of building trading infrastructure.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Deep Dives', 'Strategy Builds', 'System Design'].map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            </FadeIn>

            {/* Instagram */}
            <FadeIn delay={200}>
              <a
                href="https://www.instagram.com/christiannpark"
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-pink-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                    <InstagramIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Instagram</div>
                    <div className="text-xs text-neutral-500">@christiannpark</div>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-neutral-600 ml-auto group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Day-to-day updates, quick takes, and a look at life outside of trading.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Updates', 'Behind the Scenes', 'Life'].map((tag) => (
                    <span key={tag} className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
                      {tag}
                    </span>
                  ))}
                </div>
              </a>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.06] via-purple-500/[0.03] to-transparent p-10 sm:p-14 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
                Coming soon
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Noctiq
              </h2>
              <p className="text-neutral-400 max-w-md mx-auto mb-8">
                Something new I&apos;m building. Follow me on socials to be the first to know when it launches.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://www.youtube.com/@christiannpark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <YouTubeIcon className="w-4 h-4" />
                  Subscribe on YouTube
                </a>
                <a
                  href="https://www.tiktok.com/@jung.ho.p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <TikTokIcon className="w-4 h-4" />
                  Follow on TikTok
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <span className="text-sm font-bold text-white">
              Christian Park
            </span>
            <div className="flex items-center gap-4">
              <a href="https://www.instagram.com/christiannpark" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-pink-400 transition-colors" aria-label="Instagram">
                <InstagramIcon className="w-4 h-4" />
              </a>
              <a href="https://www.youtube.com/@christiannpark" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-red-400 transition-colors" aria-label="YouTube">
                <YouTubeIcon className="w-4 h-4" />
              </a>
              <a href="https://www.tiktok.com/@jung.ho.p" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-cyan-400 transition-colors" aria-label="TikTok">
                <TikTokIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/[0.04]">
            <p className="text-[11px] text-neutral-600 leading-relaxed max-w-3xl">
              Not financial advice. All content is for educational and informational purposes only.
              Trading futures involves substantial risk of loss and is not suitable for all investors.
              Past performance, whether actual or indicated by historical tests of strategies, is not
              indicative of future results. You should not assume that any information or strategy
              presented will be profitable or equal past performance.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
