'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

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
      <div className="absolute top-[40%] left-[-100px] w-[400px] h-[400px] rounded-full bg-emerald-500/[0.02] blur-[100px]" />
    </div>
  )
}

// ── Socials data ────────────────────────────────────────────────────────────

const socials = [
  {
    name: 'Instagram',
    handle: '@christiannpark',
    href: 'https://www.instagram.com/christiannpark',
    icon: InstagramIcon,
    color: 'from-pink-500/20 to-purple-500/20',
    border: 'hover:border-pink-500/30',
    iconColor: 'text-pink-400',
    hoverBg: 'hover:bg-gradient-to-br hover:from-pink-500/[0.08] hover:to-purple-500/[0.04]',
  },
  {
    name: 'YouTube',
    handle: '@christiannpark',
    href: 'https://www.youtube.com/@christiannpark',
    icon: YouTubeIcon,
    color: 'from-red-500/20 to-red-600/20',
    border: 'hover:border-red-500/30',
    iconColor: 'text-red-400',
    hoverBg: 'hover:bg-gradient-to-br hover:from-red-500/[0.08] hover:to-red-600/[0.04]',
  },
  {
    name: 'TikTok',
    handle: '@jung.ho.p',
    href: 'https://www.tiktok.com/@jung.ho.p',
    icon: TikTokIcon,
    color: 'from-cyan-500/20 to-pink-500/20',
    border: 'hover:border-cyan-500/30',
    iconColor: 'text-cyan-400',
    hoverBg: 'hover:bg-gradient-to-br hover:from-cyan-500/[0.08] hover:to-pink-500/[0.04]',
  },
]

// ── Time display ────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/New_York',
        hour12: true,
      }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])
  return <span className="font-mono text-xs text-neutral-600">{time} ET</span>
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
          <div className="flex items-center gap-5">
            <LiveClock />
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
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 sm:pt-40 pb-16 sm:pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-neutral-400 text-xs font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Trader &middot; Creator &middot; Builder
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
            <p className="text-lg sm:text-xl text-neutral-400 max-w-xl mx-auto mb-10 leading-relaxed">
              Algo trading, futures markets, and building things on the internet.
              Sharing what I learn along the way.
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

      {/* ── Social Cards ── */}
      <section className="px-6 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-4">
            {socials.map((social, i) => (
              <FadeIn key={social.name} delay={i * 100}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex items-center gap-4 p-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] ${social.border} ${social.hoverBg} transition-all duration-300 hover:scale-[1.02]`}
                >
                  <div className={`w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center ${social.iconColor} group-hover:scale-110 transition-transform`}>
                    <social.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{social.name}</div>
                    <div className="text-xs text-neutral-500">{social.handle}</div>
                  </div>
                  <svg className="w-4 h-4 text-neutral-600 ml-auto group-hover:text-white group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── NQ TradingView Chart ── */}
      <section className="px-6 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">NQ / MNQ</h2>
                <p className="text-sm text-neutral-500 mt-1">Micro E-Mini Nasdaq Futures &mdash; live chart</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-medium">Live</span>
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="rounded-2xl border border-white/[0.06] overflow-hidden bg-[#111113]">
              <iframe
                src="https://www.tradingview.com/widgetembed/?symbol=CME_MINI%3ANQ1!&interval=5&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=0a0a0a&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=[]&disabled_features=[]&locale=en&utm_source=localhost"
                style={{ width: '100%', height: '500px', border: 'none' }}
                allowFullScreen
                title="NQ Futures Chart"
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── What I Do ── */}
      <section className="px-6 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">What I do</h2>
            <p className="text-neutral-500 max-w-lg mb-10">
              Building at the intersection of markets, code, and content.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Algo Trading',
                desc: 'Building automated trading systems for futures markets. Pine Script strategies, webhook execution, and real-time risk management.',
                accent: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                ),
                title: 'Content Creation',
                desc: 'Sharing my trading journey, strategies, and the real math behind it all on TikTok and YouTube. Making quant trading accessible.',
                accent: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
                title: 'Software Engineering',
                desc: 'Full-stack development with Next.js, React, and APIs. Building tools and dashboards for trading and beyond.',
                accent: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Market Research',
                desc: 'Statistical analysis, Monte Carlo simulations, and backtesting frameworks. Data-driven edge quantification.',
                accent: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Futures Trading',
                desc: 'MNQ and MES micro futures. Prop firm evaluations, risk management, and systematic strategy development.',
                accent: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                title: 'Noctiq',
                desc: 'Something new I\'m building. Stay tuned.',
                accent: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="group h-full p-6 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] transition-all duration-300">
                  <div className={`w-10 h-10 rounded-xl ${item.accent} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {item.icon}
                  </div>
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Content ── */}
      <section className="px-6 pb-16 sm:pb-20">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Featured content</h2>
            <p className="text-neutral-500 max-w-lg mb-10">
              Videos, tutorials, and breakdowns across platforms.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'Algo Trading Tutorial',
                platform: 'TikTok',
                desc: 'Building an automated trading system from scratch',
                views: '9.2K views',
                href: 'https://www.tiktok.com/@jung.ho.p',
                icon: TikTokIcon,
                accent: 'text-cyan-400',
              },
              {
                title: 'How I Became an Algo Trader',
                platform: 'TikTok',
                desc: 'The full journey and steps to get started',
                views: '6.1K views',
                href: 'https://www.tiktok.com/@jung.ho.p',
                icon: TikTokIcon,
                accent: 'text-cyan-400',
              },
              {
                title: 'ATR-Based Stops Explained',
                platform: 'TikTok',
                desc: 'Why dynamic stops beat fixed stops every time',
                views: '165 views',
                href: 'https://www.tiktok.com/@jung.ho.p',
                icon: TikTokIcon,
                accent: 'text-cyan-400',
              },
            ].map((vid, i) => (
              <FadeIn key={i} delay={i * 100}>
                <a
                  href={vid.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block p-5 rounded-2xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <vid.icon className={`w-3.5 h-3.5 ${vid.accent}`} />
                      <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">{vid.platform}</span>
                    </div>
                    <span className="text-[10px] text-neutral-600 font-mono">{vid.views}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors mb-1">{vid.title}</h3>
                  <p className="text-xs text-neutral-600">{vid.desc}</p>
                </a>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Connect CTA ── */}
      <section className="px-6 pb-20 sm:pb-24">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.06] via-purple-500/[0.03] to-transparent p-10 sm:p-14 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Let&apos;s connect
              </h2>
              <p className="text-neutral-400 max-w-md mx-auto mb-8">
                Follow along as I build, trade, and share everything I learn about markets and technology.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a
                  href="https://www.instagram.com/christiannpark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <InstagramIcon className="w-4 h-4" />
                  Instagram
                </a>
                <a
                  href="https://www.youtube.com/@christiannpark"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <YouTubeIcon className="w-4 h-4" />
                  YouTube
                </a>
                <a
                  href="https://www.tiktok.com/@jung.ho.p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <TikTokIcon className="w-4 h-4" />
                  TikTok
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold text-white">
            Christian Park
          </span>
          <div className="flex items-center gap-5">
            <a href="https://www.instagram.com/christiannpark" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-pink-400 transition-colors" aria-label="Instagram">
              <InstagramIcon className="w-4.5 h-4.5" />
            </a>
            <a href="https://www.youtube.com/@christiannpark" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-red-400 transition-colors" aria-label="YouTube">
              <YouTubeIcon className="w-4.5 h-4.5" />
            </a>
            <a href="https://www.tiktok.com/@jung.ho.p" target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-cyan-400 transition-colors" aria-label="TikTok">
              <TikTokIcon className="w-4.5 h-4.5" />
            </a>
            <span className="text-neutral-700">|</span>
            <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
