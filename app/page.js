'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

const SOCIALS = [
  {
    name: 'TikTok',
    handle: '@jung.ho.p',
    url: 'https://www.tiktok.com/@jung.ho.p',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
      </svg>
    ),
  },
  {
    name: 'YouTube',
    handle: 'Christian',
    url: 'https://www.youtube.com/@christiannpark',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/>
      </svg>
    ),
  },
  {
    name: 'Discord',
    handle: 'Join server',
    url: 'https://discord.gg/VUC937Z2',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056a19.904 19.904 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
  },
  {
    name: 'Instagram',
    handle: '@christiannpark',
    url: 'https://www.instagram.com/christiannpark',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
  {
    name: 'Email',
    handle: 'christian.park2002@gmail.com',
    url: 'mailto:christian.park2002@gmail.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
]

const TOOLS = [
  {
    name: 'Alpha Futures',
    desc: 'Prop firm I trade with — use my link to sign up',
    url: 'https://app.alpha-futures.com/signup/Christian018978/',
    tag: 'Prop Firm',
  },
  {
    name: 'TradingView',
    desc: 'Charting platform I use every day',
    url: 'https://www.tradingview.com/?aff_id=164318&aff_sub=jhp',
    tag: 'Charting',
  },
  {
    name: 'Eigenstate',
    desc: 'Trading analytics platform',
    url: 'https://eigenstate.app?ref=JHP',
    tag: 'Trading Tools',
  },
  {
    name: 'PDF.ai',
    desc: 'Best AI PDF reader out there',
    url: 'https://refer.pdf.ai/christian-park',
    tag: 'AI Tool',
  },
]

export default function Page() {
  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* subtle grid */}
      <div
        className="fixed inset-0 -z-10 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.6) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] -z-10 rounded-full bg-blue-600/[0.06] blur-[100px]" />

      {/* nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto">
        <span className="font-bold tracking-tight text-base">
          noctiq<span className="text-blue-500">.ai</span>
        </span>
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-white transition-colors"
        >
          dashboard →
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-20">

        {/* hero */}
        <FadeIn className="mt-12 mb-14">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm text-neutral-500">algo trader · builder</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            Christian
          </h1>
          <p className="text-neutral-400 text-lg max-w-md">
            I build automated trading systems and share everything along the way. Find me everywhere below.
          </p>
        </FadeIn>

        {/* socials */}
        <FadeIn delay={80}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-4">
            Socials
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-12">
            {SOCIALS.map((s, i) => (
              <FadeIn key={s.name} delay={80 + i * 50}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-blue-500/[0.08] hover:border-blue-500/30 transition-all duration-200"
                >
                  <span className="text-neutral-500 group-hover:text-blue-400 transition-colors shrink-0">
                    {s.icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white">{s.name}</div>
                    <div className="text-xs text-neutral-500 truncate">{s.handle}</div>
                  </div>
                  <svg className="w-3.5 h-3.5 text-neutral-700 group-hover:text-blue-500 ml-auto shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </a>
              </FadeIn>
            ))}
          </div>
        </FadeIn>

        {/* tools */}
        <FadeIn delay={200}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-4">
            Tools I Use
          </h2>
          <div className="space-y-3">
            {TOOLS.map((r, i) => (
              <FadeIn key={r.name} delay={220 + i * 60}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-4 p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-blue-500/[0.08] hover:border-blue-500/30 transition-all duration-200"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{r.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                        {r.tag}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">{r.desc}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-neutral-700 group-hover:text-blue-500 shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </a>
              </FadeIn>
            ))}
          </div>
        </FadeIn>

      </main>

      <footer className="border-t border-white/[0.05] py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xs text-neutral-700">noctiq.ai</span>
          <Link href="/dashboard" className="text-xs text-neutral-700 hover:text-white transition-colors">
            live dashboard
          </Link>
        </div>
      </footer>
    </div>
  )
}
