'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ── fade-in on scroll ── */
function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); ob.disconnect() }
    }, { threshold: 0.05 })
    ob.observe(el)
    return () => ob.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: on ? 1 : 0,
        transform: on ? 'translateY(0)' : 'translateY(16px)',
        transition: `opacity 0.6s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.6s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ── dark/light moon/sun icon ── */
function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label="Toggle dark mode"
      className="flex items-center justify-center w-9 h-9 rounded-xl border transition-colors duration-200
        border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100
        dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
    >
      {isDark ? (
        /* sun */
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
      ) : (
        /* moon */
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  )
}

/* ── proof carousel ── */
function ProofCarousel({ images, isDark }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive(i => (i + 1) % images.length), 5000)
    return () => clearInterval(t)
  }, [images.length])
  const n = images.length
  return (
    <div>
      <div style={{ overflow: 'hidden', borderRadius: 16 }}>
        <div style={{ position: 'relative', height: 300, perspective: '1000px' }}>
          {images.map(({ src, label }, i) => {
            let offset = ((i - active) % n + n) % n
            if (offset > Math.floor(n / 2)) offset -= n
            const isActive = offset === 0
            const isLeft   = offset === -1
            const isRight  = offset === 1
            let transform, opacity, zIndex, cursor
            if (isActive) {
              transform = 'translateX(0) rotateY(0deg) scale(1)'
              opacity = 1; zIndex = 10; cursor = 'default'
            } else if (isLeft) {
              transform = 'translateX(-72%) rotateY(45deg) scale(0.78)'
              opacity = 0.3; zIndex = 5; cursor = 'pointer'
            } else if (isRight) {
              transform = 'translateX(72%) rotateY(-45deg) scale(0.78)'
              opacity = 0.3; zIndex = 5; cursor = 'pointer'
            } else {
              transform = 'scale(0.6)'; opacity = 0; zIndex = 1; cursor = 'default'
            }
            return (
              <div
                key={src}
                onClick={() => !isActive && setActive(i)}
                style={{
                  position: 'absolute', top: 0, left: '7.5%',
                  width: '85%', height: '100%',
                  transform, opacity, zIndex, cursor,
                  transition: 'all 0.55s cubic-bezier(.16,1,.3,1)',
                  borderRadius: 12, overflow: 'hidden',
                  boxShadow: isActive
                    ? isDark
                      ? '0 16px 48px rgba(0,0,0,0.5)'
                      : '0 16px 48px rgba(0,0,0,0.12)'
                    : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <img
                  src={src}
                  alt={label}
                  style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block', borderRadius: 10 }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 14 }}>
        {images.map((_, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            style={{
              width: active === i ? 20 : 6, height: 6, borderRadius: 3,
              background: active === i ? '#2563eb' : isDark ? 'rgba(255,255,255,0.15)' : '#d1d5db',
              border: 'none', padding: 0, cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            aria-label={`View ${images[i].label}`}
          />
        ))}
      </div>
    </div>
  )
}

/* ── logo (adapts to theme) ── */
function Logo({ isDark }) {
  const textFill = isDark ? '#f1f5f9' : '#0f172a'
  return (
    <svg viewBox="0 0 148 52" width="148" height="52" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto block shrink-0">
      <line x1="8" y1="42" x2="140" y2="8" stroke="#94a3b8" strokeWidth="1.2" strokeOpacity="0.4" strokeLinecap="round"/>
      <line x1="8"  y1="34" x2="8"  y2="27" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.6"/>
      <rect x="5"   y="27" width="6" height="10" rx="0.5" fill="#94a3b8" fillOpacity="0.45"/>
      <line x1="8"  y1="37" x2="8"  y2="40" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.6"/>
      <line x1="17" y1="31" x2="17" y2="24" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.5"/>
      <rect x="14"  y="25" width="6" height="8"  rx="0.5" fill="#64748b" fillOpacity="0.5"/>
      <line x1="17" y1="33" x2="17" y2="36" stroke="#94a3b8" strokeWidth="1" strokeOpacity="0.5"/>
      <line x1="26" y1="28" x2="26" y2="20" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.6"/>
      <rect x="23"  y="20" width="6" height="10" rx="0.5" fill="#2563eb" fillOpacity="0.5"/>
      <line x1="26" y1="30" x2="26" y2="34" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.6"/>
      <text x="34" y="46" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="36" fill={textFill} letterSpacing="-1">JHP</text>
      <line x1="118" y1="26" x2="118" y2="18" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.7"/>
      <rect x="115"  y="19" width="6" height="11" rx="0.5" fill="#2563eb" fillOpacity="0.7"/>
      <line x1="118" y1="30" x2="118" y2="33" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.7"/>
      <line x1="128" y1="20" x2="128" y2="12" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.85"/>
      <rect x="125"  y="13" width="6" height="12" rx="0.5" fill="#2563eb" fillOpacity="0.85"/>
      <line x1="128" y1="25" x2="128" y2="28" stroke="#2563eb" strokeWidth="1" strokeOpacity="0.85"/>
      <line x1="138" y1="14" x2="138" y2="7"  stroke="#3b82f6" strokeWidth="1"/>
      <rect x="135"  y="8"  width="6" height="14" rx="0.5" fill="#2563eb"/>
      <line x1="138" y1="22" x2="138" y2="26" stroke="#3b82f6" strokeWidth="1"/>
    </svg>
  )
}

/* ── data ── */
const SOCIALS = [
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@jhp.trades',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
      </svg>
    ),
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/@JHPTrades',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/>
      </svg>
    ),
  },
  {
    name: 'Discord',
    url: 'https://discord.gg/aCNadDMvmH',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056a19.904 19.904 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/christiannpark',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
]

const TOOLS = [
  {
    name: 'TradingView',
    desc: 'My full chart setup — indicators, scripts, alerts, and execution all in one place',
    url: 'https://www.tradingview.com/?aff_id=164318&aff_sub=jhp',
    tag: 'Charting',
    accent: '#10b981',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <polyline points="2,18 8,11 13,15 22,5"/>
        <line x1="8" y1="11" x2="8" y2="20"/>
        <line x1="13" y1="15" x2="13" y2="20"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    name: 'TradeZella',
    desc: 'Journal built for active traders — track every trade, find patterns, cut losing habits',
    url: 'https://refer.tradezella.com/christian-park',
    tag: 'Journal',
    accent: '#0ea5e9',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <path d="M4 4h16v16H4z" rx="2"/>
        <line x1="8" y1="9" x2="16" y2="9"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
    ),
  },
]

const FIRMS = [
  {
    name: 'Alpha Futures',
    desc: "The prop firm I'm currently funded with — use my link if you're signing up anyway",
    url: 'https://app.alpha-futures.com/signup/Christian018978/',
    tag: 'Prop Firm',
    accent: '#2563eb',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <rect x="3" y="10" width="18" height="11" rx="1"/>
        <path d="M8 10V7a4 4 0 018 0v3"/>
        <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    name: 'Top One Futures',
    desc: 'Competitive prop firm with fast scaling and solid payouts — code JHP for 50% off',
    url: 'https://checkout.toponefutures.com/',
    tag: 'Prop Firm',
    accent: '#f59e0b',
    badge: 'CODE: JHP · 50% OFF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
]

const PROOF_IMAGES = [
  { src: '/tradezella.png', label: 'TradeZella stats' },
  { src: '/apex.png',       label: 'Apex payout' },
  { src: '/alpha.png',      label: 'Alpha Futures payout' },
]

/* ─────────────── page ─────────────── */
export default function Page() {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('theme')
    if (saved === 'dark') setIsDark(true)
  }, [])

  const toggleDark = () => {
    setIsDark(d => {
      const next = !d
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  const d = isDark

  return (
    <div
      className={d ? 'dark' : ''}
      suppressHydrationWarning
    >
      <div className="min-h-screen bg-white dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 transition-colors duration-300">

        <style>{`
          @keyframes badgepulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
            50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
          }
          .badge-pulse { animation: badgepulse 2s ease-in-out infinite; }
        `}</style>

        {/* ── nav ── */}
        <nav className="sticky top-0 z-50 bg-white/95 dark:bg-[#0f1117]/95 backdrop-blur-sm border-b border-gray-100 dark:border-white/[0.06] transition-colors duration-300">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-6">

            <Link href="/" aria-label="JHP Trades">
              {mounted ? <Logo isDark={d} /> : <Logo isDark={false} />}
            </Link>

            <div className="hidden md:flex items-center gap-7">
              <a href="https://discord.gg/aCNadDMvmH" target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">
                Community
              </a>
              <Link href="/apply"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">
                Mentorship
              </Link>
              <a href="#tools"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-medium">
                Tools
              </a>
            </div>

            <div className="flex items-center gap-2">
              {mounted && <ThemeToggle isDark={d} onToggle={toggleDark} />}
              <a
                href="https://discord.gg/aCNadDMvmH"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Join Free
              </a>
            </div>
          </div>
        </nav>

        {/* ── hero ── */}
        <section className="py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">

                <div>
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-4">
                    5 years trading · $30k+ proven results
                  </p>
                  <h1 className="text-5xl font-black leading-tight mb-5 tracking-tight">
                    Get funded.<br />
                    <span className="text-blue-600 dark:text-blue-400">Stay funded.</span>
                  </h1>
                  <p className="text-base text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    Most traders don't fail from strategy — they fail from execution.
                    That's what we fix. Live, every day.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="https://discord.gg/aCNadDMvmH"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Join Discord Free →
                    </a>
                    <Link
                      href="/apply"
                      className="inline-flex items-center gap-2 border text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors
                        border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50
                        dark:border-white/10 dark:text-gray-300 dark:hover:border-white/20 dark:hover:bg-white/5"
                    >
                      Apply for Mentorship
                    </Link>
                  </div>
                </div>

                <ProofCarousel images={PROOF_IMAGES} isDark={d} />

              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── stats bar ── */}
        <div className="border-y border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-[#161920] transition-colors duration-300">
          <div className="max-w-5xl mx-auto px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-black">1,300+</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">traders following</span>
            </div>
            <span className="text-gray-200 dark:text-white/10 select-none">·</span>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">200+</span>
              <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">active members</span>
            </div>
            <span className="text-gray-200 dark:text-white/10 select-none">·</span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              <span className="text-lg font-black text-red-500">Live</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">daily sessions</span>
            </div>
          </div>
        </div>

        {/* ── 2 offering cards ── */}
        <section className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="mb-10">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Start here</p>
                <h2 className="text-2xl font-black">Choose your path</h2>
              </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">

              {/* Discord */}
              <FadeIn delay={0}>
                <a
                  href="https://discord.gg/aCNadDMvmH"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col h-full rounded-2xl border p-6 transition-all duration-200
                    border-gray-100 hover:border-indigo-200 hover:shadow-lg bg-white
                    dark:border-white/[0.07] dark:hover:border-indigo-500/40 dark:hover:shadow-none dark:bg-[#161920]"
                  style={d ? { boxShadow: 'none' } : {}}
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                      Free
                    </span>
                    <svg className="w-4 h-4 text-gray-200 dark:text-white/20 group-hover:text-indigo-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-black mb-1">Discord Community</h3>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-3">Free · Live sessions this week</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
                    Watch trades live, understand execution in real time, and decide if you want in — no commitment required.
                  </p>
                  <div className="mt-5 pt-4 border-t border-gray-50 dark:border-white/[0.05]">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Join Free →</span>
                  </div>
                </a>
              </FadeIn>

              {/* 1-on-1 */}
              <FadeIn delay={80}>
                <Link
                  href="/apply"
                  className="group flex flex-col h-full rounded-2xl border p-6 transition-all duration-200
                    border-blue-100 hover:border-blue-300 hover:shadow-lg
                    dark:border-blue-500/20 dark:hover:border-blue-500/50 dark:hover:shadow-none"
                  style={d
                    ? { background: 'linear-gradient(160deg, rgba(37,99,235,0.08) 0%, #161920 60%)' }
                    : { background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 60%)' }
                  }
                >
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                      1-on-1
                    </span>
                    <svg className="w-4 h-4 text-gray-200 dark:text-white/20 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-black mb-1">1-on-1 Mentorship</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-3">Personalized · Limited spots</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed flex-1">
                    Deep-dive review of your actual trades. Fix your specific leaks and build a repeatable process with direct, personal coaching.
                  </p>
                  <div className="mt-5 pt-4 border-t border-blue-50 dark:border-white/[0.05]">
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">See if it's a fit →</span>
                  </div>
                </Link>
              </FadeIn>

            </div>
          </div>
        </section>

        {/* ── this is / not ── */}
        <section className="py-12 px-6 border-y border-gray-100 dark:border-white/[0.06] bg-gray-50 dark:bg-[#161920] transition-colors duration-300">
          <FadeIn>
            <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-5">

              <div className="px-6 py-6 rounded-2xl border border-red-100 dark:border-red-500/20 bg-white dark:bg-[#0f1117]">
                <div className="text-[10px] font-black uppercase tracking-widest mb-4 text-red-500">This is NOT</div>
                <div className="space-y-2.5">
                  {['Signals or alerts', 'Copy trading', 'Gambling tips', 'Hype or predictions'].map(x => (
                    <div key={x} className="flex items-center gap-2.5 text-sm text-gray-400 dark:text-gray-500">
                      <span className="text-red-400 text-xs font-bold">✕</span> {x}
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-6 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-white dark:bg-[#0f1117]">
                <div className="text-[10px] font-black uppercase tracking-widest mb-4 text-emerald-600 dark:text-emerald-400">This IS</div>
                <div className="space-y-2.5">
                  {['Execution discipline', 'Trade journaling', 'Real consistency', 'Funded account results'].map(x => (
                    <div key={x} className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                      <span className="text-emerald-500 text-xs font-bold">✓</span> {x}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </FadeIn>
        </section>

        {/* ── tools & prop firms ── */}
        <section id="tools" className="py-16 px-6">
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="mb-8">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Resources</p>
                <h2 className="text-2xl font-black">Tools & Prop Firms</h2>
              </div>
            </FadeIn>

            <div className="space-y-3">
              {[...TOOLS, ...FIRMS].map((t, i) => (
                <FadeIn key={t.name} delay={i * 60}>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200
                      border-gray-100 hover:border-gray-200 hover:shadow-sm bg-white
                      dark:border-white/[0.06] dark:hover:border-white/[0.12] dark:hover:shadow-none dark:bg-[#161920]"
                  >
                    <span
                      className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
                      style={{ background: t.accent + '15', color: t.accent }}
                    >
                      {t.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold">{t.name}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider uppercase border"
                          style={{ color: t.accent, borderColor: t.accent + '40', background: t.accent + '12' }}
                        >
                          {t.tag}
                        </span>
                        {t.badge && (
                          <span
                            className="badge-pulse text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md border"
                            style={{ color: t.accent, borderColor: t.accent + '50', background: t.accent + '15' }}
                          >
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">{t.desc}</p>
                    </div>
                    <svg className="w-3.5 h-3.5 text-gray-300 dark:text-white/20 group-hover:text-gray-500 dark:group-hover:text-white/50 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                  </a>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── socials ── */}
        <section className="py-10 px-6 border-t border-gray-100 dark:border-white/[0.06]">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-2">
              {SOCIALS.map(s => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.name}
                  className="flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200
                    border-gray-100 hover:border-gray-200 bg-gray-50 hover:bg-white text-gray-400 hover:text-gray-600
                    dark:border-white/[0.06] dark:hover:border-white/[0.12] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-gray-500 dark:hover:text-gray-300"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ── footer ── */}
        <footer className="border-t border-gray-100 dark:border-white/[0.06] py-6 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <span className="text-xs text-gray-300 dark:text-white/20 font-mono">noctiq.ai</span>
            <div className="flex items-center gap-5">
              <a href="mailto:christian.park2002@gmail.com"
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                christian.park2002@gmail.com
              </a>
              <Link href="/dashboard"
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                live charts →
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  )
}
