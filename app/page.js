'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import Script from 'next/script'

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

/* ── candlestick background ── */
function CandlestickBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animId
    let frameOffset = 0

    const CW = 14
    const GAP = 10
    const STRIDE = CW + GAP
    const SPEED = 0.3

    const nextCandle = (prev) => {
      const open = prev
      const change = (Math.random() - 0.48) * 0.09
      const close = Math.max(0.08, Math.min(0.92, open + change))
      const wickUp = Math.random() * 0.04
      const wickDown = Math.random() * 0.04
      return {
        open,
        close,
        high: Math.min(Math.max(open, close) + wickUp, 0.96),
        low: Math.max(Math.min(open, close) - wickDown, 0.04),
      }
    }

    const INIT_COUNT = 100
    const candles = []
    let price = 0.48
    for (let i = 0; i < INIT_COUNT; i++) {
      const c = nextCandle(price)
      candles.push(c)
      price = c.close
    }

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)

      frameOffset += SPEED
      const fullShifts = Math.floor(frameOffset / STRIDE)
      if (fullShifts > 0) {
        frameOffset -= fullShifts * STRIDE
        for (let i = 0; i < fullShifts; i++) {
          const last = candles[candles.length - 1]
          candles.push(nextCandle(last.close))
          candles.shift()
        }
      }

      const chartTop = H * 0.08
      const chartH = H * 0.84
      const toY = (v) => chartTop + (1 - v) * chartH

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]
        const stepsFromRight = candles.length - 1 - i
        const x = W - GAP - CW - stepsFromRight * STRIDE - frameOffset
        if (x + CW < -STRIDE || x > W + STRIDE) continue

        const isBullish = c.close >= c.open
        const openY = toY(c.open)
        const closeY = toY(c.close)
        const highY = toY(c.high)
        const lowY = toY(c.low)
        const bodyTop = Math.min(openY, closeY)
        const bodyH = Math.max(Math.abs(closeY - openY), 2)

        // wick
        ctx.strokeStyle = isBullish
          ? 'rgba(96,165,250,0.28)'
          : 'rgba(203,213,225,0.18)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + CW / 2, highY)
        ctx.lineTo(x + CW / 2, lowY)
        ctx.stroke()

        // body fill
        ctx.fillStyle = isBullish
          ? 'rgba(59,130,246,0.22)'
          : 'rgba(148,163,184,0.14)'
        ctx.fillRect(x, bodyTop, CW, bodyH)

        // body border
        ctx.strokeStyle = isBullish
          ? 'rgba(96,165,250,0.45)'
          : 'rgba(203,213,225,0.28)'
        ctx.lineWidth = 0.8
        ctx.strokeRect(x, bodyTop, CW, bodyH)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.35 }}
    />
  )
}

/* ─────────────── data ─────────────── */
const SOCIALS = [
  {
    name: 'TikTok',
    handle: '@jhp.trades',
    url: 'https://www.tiktok.com/@jhp.trades',
    accent: '#e2e8f0',
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
    accent: '#f87171',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z"/>
      </svg>
    ),
  },
  {
    name: 'Discord',
    handle: 'Join server',
    url: 'https://discord.gg/dStyYWm8',
    accent: '#818cf8',
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
    accent: '#e879f9',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
      </svg>
    ),
  },
]

const EMAIL = { accent: '#60a5fa' }

const TOOLS = [
  {
    name: 'Eigenstate',
    desc: 'Quant & ML-powered tool built for futures trading — surface edges you can actually act on',
    url: 'https://eigenstate.app?ref=JHP',
    tag: 'Quant / ML',
    accent: '#a78bfa',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <circle cx="12" cy="5" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/>
        <line x1="12" y1="6.5" x2="5" y2="17.5"/><line x1="12" y1="6.5" x2="19" y2="17.5"/>
        <line x1="6.5" y1="19" x2="17.5" y2="19"/>
        <circle cx="12" cy="13" r="1.2" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    name: 'TradingView',
    desc: 'My full chart setup — indicators, scripts, alerts, and execution all in one place',
    url: 'https://www.tradingview.com/?aff_id=164318&aff_sub=jhp',
    tag: 'Charting',
    accent: '#34d399',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <polyline points="2,18 8,11 13,15 22,5"/>
        <line x1="8" y1="11" x2="8" y2="20"/><line x1="13" y1="15" x2="13" y2="20"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    name: 'TradeZella',
    desc: 'Journal built for active traders — track every trade, find patterns, cut losing habits',
    url: 'https://refer.tradezella.com/christian-park',
    tag: 'Journal',
    accent: '#38bdf8',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <path d="M4 4h16v16H4z" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/>
        <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/>
      </svg>
    ),
  },
]

const FIRMS = [
  {
    name: 'Alpha Futures',
    desc: 'The prop firm I\'m currently funded with — use my link if you\'re signing up anyway',
    url: 'https://app.alpha-futures.com/signup/Christian018978/',
    tag: 'Prop Firm',
    accent: '#60a5fa',
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
    accent: '#fbbf24',
    badge: 'CODE: JHP · 50% OFF',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="w-4 h-4">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
]

/* ─────────────── page ─────────────── */
export default function Page() {
  const name = useScramble('Christian', { speed: 26, delay: 80 })

  return (
    <div className="min-h-screen text-white overflow-x-hidden">

      {/* candlestick chart background */}
      <CandlestickBackground />

      {/* page content sits above the canvas */}
      <div className="relative z-10">

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
        @keyframes badgepulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.35); }
          50%      { box-shadow: 0 0 0 5px rgba(251,191,36,0); }
        }
        .badge-pulse { animation: badgepulse 2s ease-in-out infinite; }
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
      <nav className="px-6 py-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold tracking-tight text-base select-none">
            noctiq<span className="text-blue-500">.ai</span>
          </span>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors duration-200 border border-white/[0.06] px-3 py-1.5 rounded-lg"
          >
            live charts →
          </Link>
        </div>
        <p className="text-[11px] text-neutral-600">turning my trading systems into a platform</p>
      </nav>

      <main className="max-w-3xl mx-auto px-6 pb-24">

        {/* ── hero ── */}
        <FadeIn className="mt-10 mb-10">
          <h1
            className="text-3xl sm:text-4xl font-black tracking-tight mb-2"
            style={{ letterSpacing: '-0.02em' }}
          >
            Quant tools and trading systems for futures traders.
          </h1>
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
            </span>
            <span className="text-sm text-neutral-500 font-mono">{name}</span>
          </div>
          <p className="text-neutral-500 text-sm leading-relaxed mb-6 max-w-sm">
            Live trading, research, and a free community — no course BS.
          </p>

          {/* stats */}
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { val: '37.4K+', label: 'weekly TikTok views' },
              { val: '154K+', label: 'total likes' },
              { val: '100+', label: 'traders in Discord' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03]">
                <span className="text-sm font-bold text-white">{s.val}</span>
                <span className="text-[11px] text-neutral-500">{s.label}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3">
            <a
              href="https://discord.gg/dStyYWm8"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors duration-200"
            >
              Join the Discord
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a
              href="#tools"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.1] text-neutral-400 hover:text-white text-sm font-medium transition-colors duration-200"
            >
              View tools
            </a>
          </div>
        </FadeIn>

        {/* ── discord featured ── */}
        <FadeIn delay={150} className="mb-10">
          <TiltCard>
            <a
              href="https://discord.gg/dStyYWm8"
              target="_blank"
              rel="noopener noreferrer"
              className="shine group relative flex flex-col gap-3 px-6 py-5 rounded-2xl border bg-[#0a0e17] overflow-hidden transition-all duration-200"
              style={{ borderColor: 'rgba(129,140,248,0.2)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(129,140,248,0.45)'
                e.currentTarget.style.boxShadow = '0 0 32px rgba(129,140,248,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(129,140,248,0.2)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <span className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(129,140,248,0.5), transparent)' }} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0" style={{ background: 'rgba(129,140,248,0.12)', color: '#a5b4fc' }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056a19.904 19.904 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                  </span>
                  <div>
                    <div className="text-sm font-bold text-white leading-none mb-1">Free Discord Community</div>
                    <div className="text-[11px] font-semibold" style={{ color: '#a5b4fc' }}>100+ members · launched last week</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                </svg>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Live trading, quant research, and system building — a community focused on edge, not just entries.
              </p>
            </a>
          </TiltCard>
        </FadeIn>

        {/* ── tools ── */}
        <div id="tools">
        <FadeIn delay={250} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Tools</span>
            <span className="section-line flex-1" />
          </div>

          {/* tools — stacked */}
          <div className="space-y-2 mb-4">
            {TOOLS.map((t, i) => (
              <FadeIn key={t.name} delay={520 + i * 55}>
                <TiltCard>
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shine group relative flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/[0.08] bg-[#0a0e17] overflow-hidden transition-all duration-200"
                    style={{ '--accent': t.accent }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = t.accent + '55'
                      e.currentTarget.style.boxShadow = `0 0 24px ${t.accent}18`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {/* left accent strip */}
                    <span
                      className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-70"
                      style={{ background: t.accent }}
                    />
                    {/* icon badge */}
                    <span
                      className="shrink-0 flex items-center justify-center w-8 h-8 rounded-xl"
                      style={{ background: t.accent + '18', color: t.accent }}
                    >
                      {t.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white">{t.name}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wider uppercase"
                          style={{ background: t.accent + '18', color: t.accent, border: `1px solid ${t.accent}40` }}
                        >
                          {t.tag}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 leading-relaxed">{t.desc}</p>
                    </div>
                    <svg
                      className="w-3 h-3 text-neutral-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0"
                      style={{ color: 'inherit' }}
                      onMouseEnter={e => e.currentTarget.style.color = t.accent}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                </TiltCard>
              </FadeIn>
            ))}
          </div>

          {/* prop firms — 2-col grid */}
          <div className="grid grid-cols-2 gap-2">
            {FIRMS.map((f, i) => (
              <FadeIn key={f.name} delay={685 + i * 60}>
                <TiltCard>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shine group relative flex flex-col gap-3 p-4 rounded-2xl border border-white/[0.08] bg-[#0a0e17] overflow-hidden transition-all duration-200"
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = f.accent + '55'
                      e.currentTarget.style.boxShadow = `0 0 24px ${f.accent}18`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {/* top accent bar */}
                    <span
                      className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full opacity-60"
                      style={{ background: f.accent }}
                    />
                    <div className="flex items-center justify-between">
                      <span
                        className="flex items-center justify-center w-7 h-7 rounded-lg"
                        style={{ background: f.accent + '18', color: f.accent }}
                      >
                        {f.icon}
                      </span>
                      <svg className="w-3 h-3 text-neutral-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M17 7H7M17 7v10" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white mb-0.5">{f.name}</div>
                      <p className="text-[11px] text-neutral-500 leading-relaxed">{f.desc}</p>
                    </div>
                    {f.badge && (
                      <span
                        className="badge-pulse self-start text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-lg"
                        style={{ background: f.accent + '20', color: f.accent, border: `1px solid ${f.accent}50` }}
                      >
                        {f.badge}
                      </span>
                    )}
                  </a>
                </TiltCard>
              </FadeIn>
            ))}
          </div>
        </FadeIn>
        </div>{/* end #tools */}

        {/* ── socials ── */}
        <FadeIn delay={500} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Socials</span>
            <span className="section-line flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SOCIALS.map((s, i) => (
              <FadeIn key={s.name} delay={520 + i * 50}>
                <TiltCard>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shine group relative flex items-center gap-3 p-4 rounded-2xl border border-white/[0.08] bg-[#0a0e17] overflow-hidden transition-all duration-200"
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = s.accent + '55'
                      e.currentTarget.style.boxShadow = `0 0 20px ${s.accent}18`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-60" style={{ background: s.accent }} />
                    <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-xl" style={{ background: s.accent + '18', color: s.accent }}>
                      {s.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white leading-none mb-1">{s.name}</div>
                      <div className="text-[11px] text-neutral-500 truncate">{s.handle}</div>
                    </div>
                    <svg className="w-3 h-3 text-neutral-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="flex items-center gap-4">
            <a href="mailto:christian.park2002@gmail.com" className="text-xs text-neutral-700 hover:text-neutral-400 transition-colors duration-200">
              christian.park2002@gmail.com
            </a>
            <Link href="/dashboard" className="text-xs text-neutral-700 hover:text-white transition-colors duration-200">
              live charts →
            </Link>
          </div>
        </div>
      </footer>
      </div>{/* end relative z-10 content wrapper */}

      <Script
        src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.kofiWidgetOverlay.draw('jhp_trades', {
            'type': 'floating-chat',
            'floating-chat.donateButton.text': 'Support me',
            'floating-chat.donateButton.background-color': '#323842',
            'floating-chat.donateButton.text-color': '#fff',
          })
        }}
      />
    </div>
  )
}
