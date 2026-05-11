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

/* ── proof carousel ── */
function ProofCarousel({ images }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive(i => (i + 1) % images.length), 5000)
    return () => clearInterval(t)
  }, [images.length])
  const n = images.length
  return (
    <div>
      <div style={{ overflow: 'hidden', borderRadius: 16 }}>
        <div style={{ position: 'relative', height: 280, perspective: '1000px' }}>
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
              opacity = 0.25; zIndex = 5; cursor = 'pointer'
            } else if (isRight) {
              transform = 'translateX(72%) rotateY(-45deg) scale(0.78)'
              opacity = 0.25; zIndex = 5; cursor = 'pointer'
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
                  boxShadow: isActive ? '0 16px 48px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <img src={src} alt={label}
                  style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block', borderRadius: 10 }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingTop: 12 }}>
        {images.map((_, i) => (
          <button key={i} onClick={() => setActive(i)}
            style={{
              width: active === i ? 20 : 6, height: 6, borderRadius: 3,
              background: active === i ? '#2563eb' : '#d1d5db',
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

/* ── feature card (TTrades-style icon + label) ── */
function FeatureCard({ icon, label, sub, href, external = false }) {
  const inner = (
    <div className="group flex flex-col items-center gap-3 cursor-pointer">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-gray-200 transition-colors duration-200">
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
  if (external) return <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
  return <Link href={href}>{inner}</Link>
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

/* ── subtle trading background for hero ── */
function HeroBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden="true">
      {/* fine grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(15,23,42,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.025) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      {/* minimal market texture */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1200 480"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        style={{ filter: 'blur(0.4px)' }}
      >
        {/* two subtle level lines */}
        <line x1="0" y1="148" x2="1200" y2="148" stroke="#1e3a8a" strokeWidth="0.6" strokeDasharray="5 14" opacity="0.14"/>
        <line x1="0" y1="320" x2="1200" y2="320" stroke="#1e3a8a" strokeWidth="0.6" strokeDasharray="5 14" opacity="0.1"/>
        {/* session ticks */}
        <line x1="220" y1="141" x2="220" y2="155" stroke="#2563eb" strokeWidth="1.2" opacity="0.2"/>
        <line x1="860" y1="313" x2="860" y2="327" stroke="#2563eb" strokeWidth="1.2" opacity="0.18"/>
        {/* left candles — only 2, pushed to edge */}
        <line x1="60"  y1="60"  x2="60"  y2="200" stroke="#94a3b8" strokeWidth="0.8" opacity="0.2"/>
        <rect x="53"   y="95"  width="14" height="72" rx="1" fill="#94a3b8" opacity="0.07"/>
        <line x1="84"  y1="30"  x2="84"  y2="200" stroke="#1d4ed8" strokeWidth="0.8" opacity="0.22"/>
        <rect x="77"   y="45"  width="14" height="130" rx="1" fill="#1d4ed8" opacity="0.08"/>
        {/* right candles — only 2, pushed to edge */}
        <line x1="1116" y1="50"  x2="1116" y2="210" stroke="#2563eb" strokeWidth="0.8" opacity="0.2"/>
        <rect x="1109"  y="70"  width="14" height="112" rx="1" fill="#2563eb" opacity="0.07"/>
        <line x1="1140" y1="25"  x2="1140" y2="200" stroke="#1d4ed8" strokeWidth="0.8" opacity="0.22"/>
        <rect x="1133"  y="38"  width="14" height="136" rx="1" fill="#1d4ed8" opacity="0.08"/>
      </svg>
    </div>
  )
}

/* ─────────────── page ─────────────── */
export default function Page() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#0B1020]">

      <style>{`
        @keyframes badgepulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.4); }
          50%      { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
        }
        .badge-pulse { animation: badgepulse 2s ease-in-out infinite; }
      `}</style>

      {/* ── nav ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-[10px] border-b border-gray-200/80">
        <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">

          {/* logo */}
          <Link href="/" aria-label="JHP Trades">
            <svg viewBox="0 0 106 36" width="106" height="36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-auto block shrink-0">
              {/* candle 1 — slate/neutral */}
              <line x1="6.5" y1="9"  x2="6.5" y2="13" stroke="#94a3b8" strokeWidth="1.2"/>
              <rect x="3"   y="13" width="7" height="10" rx="1" fill="#94a3b8" fillOpacity="0.55"/>
              <line x1="6.5" y1="23" x2="6.5" y2="27" stroke="#94a3b8" strokeWidth="1.2"/>
              {/* candle 2 — blue/mid */}
              <line x1="16.5" y1="7"  x2="16.5" y2="11" stroke="#2563eb" strokeWidth="1.2" strokeOpacity="0.7"/>
              <rect x="13"   y="11" width="7" height="14" rx="1" fill="#2563eb" fillOpacity="0.55"/>
              <line x1="16.5" y1="25" x2="16.5" y2="29" stroke="#2563eb" strokeWidth="1.2" strokeOpacity="0.7"/>
              {/* candle 3 — navy/breakout */}
              <line x1="26.5" y1="2"  x2="26.5" y2="6"  stroke="#1d4ed8" strokeWidth="1.2"/>
              <rect x="23"   y="6"  width="7" height="22" rx="1" fill="#1d4ed8"/>
              <line x1="26.5" y1="28" x2="26.5" y2="33" stroke="#1d4ed8" strokeWidth="1.2"/>
              {/* JHP */}
              <text x="36" y="29" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="26" fill="#0f172a" letterSpacing="-0.5">JHP</text>
            </svg>
          </Link>

          {/* nav links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="https://discord.gg/aCNadDMvmH" target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
              Community
            </a>
            <Link href="/apply"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
              1-on-1s
            </Link>
            <a href="#tools"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
              Tools
            </a>
            <a href="#firms"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
              Prop Firms
            </a>
          </div>

        </div>
      </nav>

      {/* ── hero ── */}
      <section className="relative pt-14 pb-12 px-6 text-center overflow-hidden">
        <HeroBg />
        <FadeIn>
          <div className="relative z-10 max-w-xl mx-auto">

            {/* pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-7">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-red-600 shadow-sm">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                Live daily
              </span>
              <span className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[#0B1020] shadow-sm">
                Futures
              </span>
              <span className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[#0B1020] shadow-sm">
                No signals
              </span>
            </div>

            <h1 className="text-[2rem] sm:text-4xl md:text-5xl font-black text-[#0B1020] leading-[1.15] tracking-tight mb-4">
              Trading doesn't have<br className="hidden sm:block" /> to be complicated.
            </h1>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-8 max-w-md mx-auto">
              Focused on clean execution, market structure, and staying consistent in live markets.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://discord.gg/aCNadDMvmH"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-[#2563EB] text-white font-semibold px-6 py-3 rounded-full hover:bg-blue-700 transition-colors text-sm shadow-sm"
              >
                Watch Live →
              </a>
              <Link
                href="/apply"
                className="inline-flex items-center bg-white border border-gray-200 text-[#0B1020] font-semibold px-6 py-3 rounded-full hover:border-gray-300 hover:shadow-sm transition-all text-sm shadow-sm"
              >
                Apply for 1-on-1s
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-400 font-light italic text-center">
              A few good decisions repeated consistently can change your life.
            </p>
          </div>
        </FadeIn>
      </section>

      {/* ── nav cards ── */}
      <section className="pb-12 px-6 border-b border-gray-200/70">
        <FadeIn delay={80}>
          <div className="max-w-2xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3">

            {[
              {
                href: 'https://discord.gg/aCNadDMvmH', external: true,
                label: 'Community', sub: 'Live sessions daily',
                color: '#4F46E5',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
              },
              {
                href: '/apply', external: false,
                label: '1-on-1s', sub: 'Personalized feedback',
                color: '#2563EB',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
              },
              {
                href: '#tools', external: false,
                label: 'Tools', sub: 'Charts & journal',
                color: '#059669',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4"><polyline points="2,18 8,11 13,15 22,5"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
              },
              {
                href: '#firms', external: false,
                label: 'Prop Firms', sub: 'Funded accounts',
                color: '#D97706',
                icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4"><rect x="3" y="10" width="18" height="11" rx="1"/><path d="M8 10V7a4 4 0 018 0v3"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>,
              },
            ].map(({ href, external, label, sub, color, icon }) => {
              const cls = 'group bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-md hover:border-gray-300 transition-all duration-200 cursor-pointer'
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: color + '12', color }}>
                      {icon}
                    </span>
                    <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0B1020]">{label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
                  </div>
                </>
              )
              return external
                ? <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
                : <Link key={label} href={href} className={cls}>{inner}</Link>
            })}

          </div>
        </FadeIn>
      </section>

      {/* ── stats ── */}
      <section className="py-10 px-6 bg-white border-b border-gray-200/70">
        <FadeIn>
          <div className="max-w-2xl mx-auto flex flex-wrap justify-center items-center gap-x-12 gap-y-4 text-center">
            <div>
              <div className="text-2xl font-black text-[#0B1020]">1,800+</div>
              <div className="text-xs text-slate-400 mt-0.5">traders following</div>
            </div>
            <div className="text-gray-200 select-none text-xl">·</div>
            <div>
              <div className="text-2xl font-black text-[#2563EB]">300+</div>
              <div className="text-xs text-slate-400 mt-0.5">active members</div>
            </div>
            <div className="text-gray-200 select-none text-xl">·</div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
              </span>
              <div>
                <div className="text-2xl font-black text-red-500 leading-none">Live</div>
                <div className="text-xs text-slate-400 mt-0.5">daily sessions</div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── proof carousel ── */}
      <section className="py-16 px-6">
        <FadeIn>
          <div className="max-w-lg mx-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest text-center mb-8">Results</p>
            <ProofCarousel images={PROOF_IMAGES} />
          </div>
        </FadeIn>
      </section>

      {/* ── tools ── */}
      <section id="tools" className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <FadeIn>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 text-center">Resources</p>
            <h2 className="text-2xl font-black text-[#0B1020] text-center mb-8">Tools</h2>
          </FadeIn>
          <div className="space-y-3">
            {TOOLS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 60}>
                <a href={t.url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md bg-white transition-all duration-200">
                  <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{ background: t.accent + '15', color: t.accent }}>
                    {t.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-[#0B1020]">{t.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider uppercase border"
                        style={{ color: t.accent, borderColor: t.accent + '40', background: t.accent + '12' }}>
                        {t.tag}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{t.desc}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
                  </svg>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── prop firms ── */}
      <section id="firms" className="pb-16 px-6">
        <div className="max-w-2xl mx-auto">
          <FadeIn>
            <h2 className="text-2xl font-black text-[#0B1020] text-center mb-8">Prop Firms</h2>
          </FadeIn>
          <div className="space-y-3">
            {FIRMS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 60}>
                <a href={t.url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md bg-white transition-all duration-200">
                  <span className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl"
                    style={{ background: t.accent + '15', color: t.accent }}>
                    {t.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-[#0B1020]">{t.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider uppercase border"
                        style={{ color: t.accent, borderColor: t.accent + '40', background: t.accent + '12' }}>
                        {t.tag}
                      </span>
                      {t.badge && (
                        <span className="badge-pulse text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-md border"
                          style={{ color: t.accent, borderColor: t.accent + '50', background: t.accent + '15' }}>
                          {t.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{t.desc}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10"/>
                  </svg>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── socials ── */}
      <section className="py-10 px-6 border-t border-gray-200/70">
        <div className="max-w-2xl mx-auto flex justify-center gap-2">
          {SOCIALS.map(s => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" title={s.name}
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm text-slate-400 hover:text-slate-600 transition-all duration-200">
              {s.icon}
            </a>
          ))}
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-gray-200/70 py-6 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs text-slate-300 font-mono">noctiq.ai</span>
          <div className="flex items-center gap-5">
            <a href="mailto:christian.park2002@gmail.com"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              christian.park2002@gmail.com
            </a>
            <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
              live charts →
            </Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
