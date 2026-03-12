'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

/* ── scramble hook ── */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%'
function useScramble(text, { speed = 28, delay = 120 } = {}) {
  const [out, setOut] = useState(() =>
    text.split('').map(() => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('')
  )
  useEffect(() => {
    let iter = 0
    let iv
    const t = setTimeout(() => {
      iv = setInterval(() => {
        setOut(
          text.split('').map((ch, i) =>
            i < iter ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          ).join('')
        )
        iter += 0.45
        if (iter > text.length) clearInterval(iv)
      }, speed)
    }, delay)
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [text, speed, delay])
  return out
}

/* ── spring fade-in ── */
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
        transform: on ? 'translateY(0px)' : 'translateY(22px)',
        transition: `opacity 0.65s cubic-bezier(.16,1,.3,1) ${delay}ms, transform 0.65s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ── 3-D tilt card ── */
function TiltCard({ children, className = '' }) {
  const ref = useRef(null)
  const raf = useRef(null)

  const onMove = useCallback((e) => {
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width - 0.5
      const y = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(700px) rotateX(${-y * 7}deg) rotateY(${x * 7}deg) scale(1.025)`
    })
  }, [])

  const onLeave = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current)
    const el = ref.current
    if (el) el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)'
  }, [])

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: 'transform 0.35s cubic-bezier(.16,1,.3,1)', willChange: 'transform' }}
    >
      {children}
    </div>
  )
}

/* ── drifting blob ── */
function Blob({ style }) {
  return (
    <div
      className="fixed -z-10 rounded-full blur-[120px] pointer-events-none"
      style={style}
    />
  )
}

/* ─────────────── data ─────────────── */
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
    handle: '@JHPTrades',
    url: 'https://www.youtube.com/@JHPTrades',
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
    name: 'TradeZella',
    desc: 'Trading journal I use to track and improve my performance',
    url: 'https://refer.tradezella.com/christian-park',
    tag: 'Journal',
  },
]

/* ─────────────── page ─────────────── */
export default function Page() {
  const name = useScramble('Christian', { speed: 26, delay: 80 })

  return (
    <div className="min-h-screen bg-[#06060e] text-white overflow-x-hidden">

      {/* CSS for shine sweep & grid */}
      <style>{`
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(60px,-40px) scale(1.08); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-50px,50px) scale(1.05); }
        }
        @keyframes drawline {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .blob1 { animation: drift1 12s ease-in-out infinite; }
        .blob2 { animation: drift2 16s ease-in-out infinite; }

        .shine {
          position: relative;
          overflow: hidden;
        }
        .shine::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(59,130,246,0.08) 50%, transparent 60%);
          transform: translateX(-100%);
          transition: transform 0s;
        }
        .shine:hover::after {
          transform: translateX(100%);
          transition: transform 0.55s ease;
        }

        .section-line {
          display: block;
          height: 1px;
          background: #3b82f6;
          transform-origin: left;
          animation: drawline 0.6s cubic-bezier(.16,1,.3,1) both;
        }
      `}</style>

      {/* background blobs */}
      <div
        className="blob1 fixed -z-10 rounded-full pointer-events-none"
        style={{
          width: 560, height: 400,
          top: '-80px', left: '50%', marginLeft: '-280px',
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.09) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="blob2 fixed -z-10 rounded-full pointer-events-none"
        style={{
          width: 400, height: 320,
          bottom: '10%', right: '-80px',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.06) 0%, transparent 70%)',
          filter: 'blur(100px)',
        }}
      />

      {/* grid */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)`,
          backgroundSize: '52px 52px',
        }}
      />

      {/* nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-3xl mx-auto">
        <span className="font-bold tracking-tight text-base select-none">
          noctiq<span className="text-blue-500">.ai</span>
        </span>
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-white transition-colors duration-200"
        >
          dashboard →
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-24">

        {/* hero */}
        <FadeIn className="mt-14 mb-16">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            <span className="text-sm text-neutral-500 tracking-wide">algo trader · builder</span>
          </div>
          <h1
            className="text-5xl sm:text-6xl font-black tracking-tight mb-4 font-mono"
            style={{ letterSpacing: '-0.03em' }}
          >
            {name}
          </h1>
          <p className="text-neutral-400 text-lg max-w-sm leading-relaxed">
            Automated trading systems. Sharing everything.
          </p>
        </FadeIn>

        {/* ── socials ── */}
        <FadeIn delay={100} className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-600">Socials</span>
            <span className="section-line flex-1" />
          </div>

          {/* 2×2 grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {SOCIALS.map((s, i) => (
              <FadeIn key={s.name} delay={120 + i * 55}>
                <TiltCard>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shine group flex items-center gap-3 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:border-blue-500/40 hover:bg-blue-500/[0.06] transition-colors duration-200 cursor-pointer"
                  >
                    <span className="text-neutral-600 group-hover:text-blue-400 transition-colors duration-200 shrink-0">
                      {s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white leading-none mb-1">{s.name}</div>
                      <div className="text-[11px] text-neutral-600 truncate">{s.handle}</div>
                    </div>
                    <svg
                      className="w-3 h-3 text-neutral-700 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                </TiltCard>
              </FadeIn>
            ))}
          </div>

          {/* email — full width */}
          <FadeIn delay={360}>
            <TiltCard>
              <a
                href="mailto:christian.park2002@gmail.com"
                className="shine group flex items-center gap-3 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:border-blue-500/40 hover:bg-blue-500/[0.06] transition-colors duration-200"
              >
                <span className="text-neutral-600 group-hover:text-blue-400 transition-colors duration-200 shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white leading-none mb-1">Email</div>
                  <div className="text-[11px] text-neutral-600">christian.park2002@gmail.com</div>
                </div>
                <svg
                  className="w-3 h-3 text-neutral-700 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </a>
            </TiltCard>
          </FadeIn>
        </FadeIn>

        {/* ── tools ── */}
        <FadeIn delay={280}>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-600">Tools I Use</span>
            <span className="section-line flex-1" />
          </div>
          <div className="space-y-2.5">
            {TOOLS.map((t, i) => (
              <FadeIn key={t.name} delay={300 + i * 60}>
                <TiltCard>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shine group flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] hover:border-blue-500/40 hover:bg-blue-500/[0.06] transition-colors duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-white">{t.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wide uppercase">
                          {t.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-600 leading-relaxed">{t.desc}</p>
                    </div>
                    <svg
                      className="w-3 h-3 text-neutral-700 group-hover:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                </TiltCard>
              </FadeIn>
            ))}
          </div>
        </FadeIn>

      </main>

      <footer className="border-t border-white/[0.04] py-6 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-xs text-neutral-800 font-mono">noctiq.ai</span>
          <Link href="/dashboard" className="text-xs text-neutral-700 hover:text-white transition-colors duration-200">
            live dashboard
          </Link>
        </div>
      </footer>
    </div>
  )
}
