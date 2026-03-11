'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

// ── Reusable components ─────────────────────────────────────────────────────

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

// ── Background ──────────────────────────────────────────────────────────────

function GridBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#0a0a0a]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-indigo-500/[0.04] blur-[120px]" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/[0.03] blur-[100px]" />
    </div>
  )
}

// ── Social icons ────────────────────────────────────────────────────────────

const TikTokIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
  </svg>
)

const YouTubeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2 31.5 31.5 0 000 12a31.5 31.5 0 00.5 5.8 3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1A31.5 31.5 0 0024 12a31.5 31.5 0 00-.5-5.8zM9.75 15.5v-7l6.25 3.5-6.25 3.5z"/>
  </svg>
)

const TwitterIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

// ── Referral card ───────────────────────────────────────────────────────────

function ReferralCard({ name, description, badge, badgeColor, href, cta }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col p-6 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.14] transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-white font-semibold text-base group-hover:text-indigo-300 transition-colors">{name}</h3>
        {badge && (
          <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium border ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm text-neutral-500 leading-relaxed flex-1 mb-4">{description}</p>
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors">
        {cta || 'Use my link'}
        <svg className="w-3 h-3 translate-x-0 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false)

  const scrollTo = useCallback((id) => {
    setMobileMenu(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const socials = [
    {
      label: '@jung.ho.p',
      href: 'https://www.tiktok.com/@jung.ho.p',
      icon: <TikTokIcon />,
      bg: 'bg-white text-black hover:bg-neutral-200',
    },
  ]

  const referrals = [
    {
      name: 'TopStep',
      description: 'The prop firm I trade on. Get funded up to $150K to trade futures — no risk to your own capital. Use my link to get a discount on your evaluation.',
      badge: 'Prop Firm',
      badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      href: 'https://www.topstep.com/?tap_a=131632-bf6e2e&tap_s=6076286-a1b88b',
      cta: 'Get funded',
    },
    {
      name: 'Apex Trader Funding',
      description: 'Another top prop firm for futures traders. Flexible evaluation rules and one of the best payout structures. Use my link for a discount.',
      badge: 'Prop Firm',
      badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
      href: 'https://apextraderfunding.com/member/aff/go/christianpark',
      cta: 'Get funded',
    },
    {
      name: 'TradingView',
      description: 'The charting platform I use for backtesting and building my Pine Script strategies. Best tool for technical analysis and algo development.',
      badge: 'Charting',
      badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
      href: 'https://www.tradingview.com/?aff_id=139364',
      cta: 'Try for free',
    },
  ]

  return (
    <div className="min-h-screen text-white relative scroll-smooth">
      <GridBackground />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">noctiq</span>
            <span className="text-indigo-500">.ai</span>
          </span>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('about')} className="text-sm text-neutral-400 hover:text-white transition-colors">About</button>
            <button onClick={() => scrollTo('referrals')} className="text-sm text-neutral-400 hover:text-white transition-colors">Referrals</button>
            <Link
              href="/dashboard"
              className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors font-medium"
            >
              Dashboard
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenu(m => !m)}
            className="md:hidden p-2 -mr-2 text-neutral-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenu
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenu && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl px-6 py-4 space-y-3">
            <button onClick={() => scrollTo('about')} className="block text-sm text-neutral-400 hover:text-white transition-colors w-full text-left">About</button>
            <button onClick={() => scrollTo('referrals')} className="block text-sm text-neutral-400 hover:text-white transition-colors w-full text-left">Referrals</button>
            <Link href="/dashboard" className="block text-sm text-indigo-400 font-medium">Dashboard</Link>
          </div>
        )}
      </nav>

      {/* ── Hero / About ── */}
      <section id="about" className="pt-32 pb-20 sm:pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            {/* Avatar / name */}
            <div className="mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-300 mb-6">
                C
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Algo trader &amp; content creator
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.15] mb-5">
                Hey, I&apos;m{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
                  Christian
                </span>
                .
              </h1>
              <p className="text-base sm:text-lg text-neutral-400 max-w-xl leading-relaxed mb-8">
                I build automated trading systems for futures markets and share everything I learn — the math, the code, the real results. I trade on funded prop firm accounts and post content on TikTok covering algo trading, backtesting, and quantitative strategy development.
              </p>
            </div>

            {/* Socials */}
            <div className="flex flex-wrap items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors ${s.bg}`}
                >
                  {s.icon}
                  {s.label}
                </a>
              ))}
              <button
                onClick={() => scrollTo('referrals')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all"
              >
                My referrals
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </FadeIn>

          {/* Quick stats */}
          <FadeIn delay={150}>
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Markets', value: 'MNQ / MES' },
                { label: 'Approach', value: 'Systematic' },
                { label: 'Platform', value: 'TopStep / Apex' },
                { label: 'Content', value: 'TikTok' },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.01] text-center">
                  <div className="text-white font-semibold text-sm mb-1">{item.value}</div>
                  <div className="text-neutral-500 text-xs">{item.label}</div>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Referrals ── */}
      <section id="referrals" className="py-20 sm:py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <FadeIn>
            <div className="mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Referrals &amp; resources</h2>
              <p className="text-neutral-500 max-w-lg text-sm leading-relaxed">
                Tools and platforms I personally use. Some of these links support the channel — I only recommend things I actually trade with or use daily.
              </p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {referrals.map((ref, i) => (
              <FadeIn key={ref.name} delay={i * 80}>
                <ReferralCard {...ref} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">
              <span className="text-white">noctiq</span>
              <span className="text-indigo-500">.ai</span>
            </span>
            <span className="text-neutral-600 text-sm">/ Christian</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="https://www.tiktok.com/@jung.ho.p"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="TikTok"
            >
              <TikTokIcon />
            </a>
            <Link href="/dashboard" className="text-sm text-neutral-500 hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
