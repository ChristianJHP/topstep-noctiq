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

function useMouseGlow() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleMove = (e) => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
      el.style.setProperty('--my', `${e.clientY - rect.top}px`)
    }
    el.addEventListener('mousemove', handleMove)
    return () => el.removeEventListener('mousemove', handleMove)
  }, [])
  return ref
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

function AnimatedCounter({ end, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const startTime = performance.now()
          const animate = (now) => {
            const progress = Math.min((now - startTime) / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * end))
            if (progress < 1) requestAnimationFrame(animate)
          }
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// ── Terminal animation ──────────────────────────────────────────────────────

function TerminalText() {
  const lines = [
    { text: '$ python backtest.py --strategy mean_reversion --instrument MNQ', color: 'text-emerald-400' },
    { text: '> Loading 252 trading days of tick data...', color: 'text-neutral-500' },
    { text: '> Running Monte Carlo simulation (10,000 paths)...', color: 'text-neutral-500' },
    { text: '', color: '' }, // blank line for spacing
    { text: '  ┌─────────────────────────────────────┐', color: 'text-neutral-600' },
    { text: '  │  Sharpe Ratio    2.41               │', color: 'text-indigo-400' },
    { text: '  │  Win Rate        67.3%              │', color: 'text-emerald-400' },
    { text: '  │  Profit Factor   1.89               │', color: 'text-emerald-400' },
    { text: '  │  Max Drawdown   -4.2%               │', color: 'text-amber-400' },
    { text: '  │  Expectancy     +$12.40/trade       │', color: 'text-indigo-400' },
    { text: '  └─────────────────────────────────────┘', color: 'text-neutral-600' },
    { text: '', color: '' },
    { text: '> Strategy passed validation. Deploying to live...', color: 'text-neutral-500' },
    { text: '> ✓ Connected to TopStepX account', color: 'text-emerald-400' },
    { text: '> ✓ Risk manager active (max 8 trades, $400 daily limit)', color: 'text-emerald-400' },
    { text: '> ✓ Live execution enabled', color: 'text-emerald-400' },
    { text: '$ _', color: 'text-emerald-400' },
  ]
  const [visibleLines, setVisibleLines] = useState([])
  const [currentChar, setCurrentChar] = useState(0)
  const [lineIndex, setLineIndex] = useState(0)
  const started = useRef(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          setLineIndex(0)
          setCurrentChar(0)
        }
      },
      { threshold: 0.2 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started.current || lineIndex >= lines.length) return
    const line = lines[lineIndex]
    if (line.text === '') {
      const timeout = setTimeout(() => {
        setVisibleLines(prev => [...prev, line])
        setLineIndex(i => i + 1)
        setCurrentChar(0)
      }, 100)
      return () => clearTimeout(timeout)
    }
    if (currentChar < line.text.length) {
      const speed = line.text.startsWith('$') ? 35 : line.text.startsWith('  │') || line.text.startsWith('  ┌') || line.text.startsWith('  └') ? 8 : 15
      const timeout = setTimeout(() => setCurrentChar(c => c + 1), speed)
      return () => clearTimeout(timeout)
    } else {
      const pause = line.text.startsWith('$') ? 400 : line.text.includes('✓') ? 250 : 150
      const timeout = setTimeout(() => {
        setVisibleLines(prev => [...prev, line])
        setLineIndex(i => i + 1)
        setCurrentChar(0)
      }, pause)
      return () => clearTimeout(timeout)
    }
  }, [lineIndex, currentChar])

  const typingLine = lineIndex < lines.length ? lines[lineIndex] : null

  return (
    <div ref={ref} className="font-mono text-[11px] sm:text-xs leading-relaxed min-h-[280px]">
      {visibleLines.map((line, i) => (
        <div key={i} className={line.color || 'h-4'}>{line.text}</div>
      ))}
      {typingLine && typingLine.text && (
        <div className={typingLine.color}>
          {typingLine.text.slice(0, currentChar)}
          <span className="animate-pulse text-white/60">▋</span>
        </div>
      )}
    </div>
  )
}

// ── Architecture diagram ────────────────────────────────────────────────────

function ArchitectureDiagram() {
  const [ref, visible] = useFadeIn(0.2)
  const [activeNode, setActiveNode] = useState(null)

  const nodes = [
    { id: 'tv', label: 'TradingView', sublabel: 'Pine Script Signals', x: 0, y: 0, color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30' },
    { id: 'webhook', label: 'Webhook API', sublabel: 'Validation & Routing', x: 1, y: 0, color: 'from-indigo-500/20 to-indigo-600/10', border: 'border-indigo-500/30' },
    { id: 'risk', label: 'Risk Manager', sublabel: 'Limits & Controls', x: 2, y: -1, color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30' },
    { id: 'exec', label: 'Order Engine', sublabel: 'Bracket Execution', x: 2, y: 1, color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30' },
    { id: 'broker', label: 'TopStepX', sublabel: 'Live Account', x: 3, y: 0, color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30' },
    { id: 'dash', label: 'Dashboard', sublabel: 'Real-time Monitor', x: 3, y: 1.5, color: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/30' },
  ]

  return (
    <div ref={ref} className="relative">
      {/* Mobile: vertical flow */}
      <div className="sm:hidden space-y-3">
        {nodes.map((node, i) => (
          <div key={node.id} className={`flex items-center gap-3 transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`} style={{ transitionDelay: `${i * 100}ms` }}>
            <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${node.color} border ${node.border} shrink-0`} />
            <div className={`flex-1 px-4 py-3 rounded-lg bg-gradient-to-r ${node.color} border ${node.border}`}>
              <div className="text-xs font-semibold text-white">{node.label}</div>
              <div className="text-[10px] text-neutral-500">{node.sublabel}</div>
            </div>
            {i < nodes.length - 1 && (
              <svg className="w-4 h-4 text-neutral-600 shrink-0 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: grid layout with arrows */}
      <div className="hidden sm:block relative h-[280px]">
        {nodes.map((node, i) => {
          const left = `${node.x * 25 + 4}%`
          const top = `${50 + node.y * 30}%`
          return (
            <div
              key={node.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 px-5 py-3 rounded-xl bg-gradient-to-br ${node.color} border ${node.border} cursor-default transition-all duration-500 hover:scale-105 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
              style={{ left, top, transitionDelay: `${i * 120}ms` }}
              onMouseEnter={() => setActiveNode(node.id)}
              onMouseLeave={() => setActiveNode(null)}
            >
              <div className="text-xs font-semibold text-white whitespace-nowrap">{node.label}</div>
              <div className="text-[10px] text-neutral-400 whitespace-nowrap">{node.sublabel}</div>
            </div>
          )
        })}

        {/* Connection lines (simplified) */}
        <svg className={`absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '600ms' }}>
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(99,102,241,0.3)" />
              <stop offset="100%" stopColor="rgba(99,102,241,0.05)" />
            </linearGradient>
          </defs>
          {/* TV -> Webhook */}
          <line x1="16%" y1="50%" x2="25%" y2="50%" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
          </line>
          {/* Webhook -> Risk */}
          <line x1="37%" y1="48%" x2="50%" y2="25%" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
          </line>
          {/* Webhook -> Exec */}
          <line x1="37%" y1="52%" x2="50%" y2="78%" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
          </line>
          {/* Risk -> Broker */}
          <line x1="62%" y1="25%" x2="75%" y2="48%" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
          </line>
          {/* Exec -> Broker */}
          <line x1="62%" y1="78%" x2="75%" y2="52%" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
          </line>
          {/* Broker -> Dashboard */}
          <line x1="79%" y1="58%" x2="79%" y2="85%" stroke="url(#lineGrad)" strokeWidth="1" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" from="8" to="0" dur="1s" repeatCount="indefinite" />
          </line>
        </svg>
      </div>
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

// ── Main page ───────────────────────────────────────────────────────────────

export default function LandingPage() {
  const glowRef = useMouseGlow()
  const [mobileMenu, setMobileMenu] = useState(false)

  const scrollTo = useCallback((id) => {
    setMobileMenu(false)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }, [])

  return (
    <div className="min-h-screen text-white relative scroll-smooth">
      <GridBackground />

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">noctiq</span>
            <span className="text-indigo-500">.ai</span>
          </span>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => scrollTo('about')} className="text-sm text-neutral-400 hover:text-white transition-colors">About</button>
            <button onClick={() => scrollTo('expertise')} className="text-sm text-neutral-400 hover:text-white transition-colors">Expertise</button>
            <button onClick={() => scrollTo('system')} className="text-sm text-neutral-400 hover:text-white transition-colors">System</button>
            <button onClick={() => scrollTo('resources')} className="text-sm text-neutral-400 hover:text-white transition-colors">Resources</button>
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

        {/* Mobile menu dropdown */}
        {mobileMenu && (
          <div className="md:hidden border-t border-white/5 bg-[#0a0a0a]/95 backdrop-blur-xl px-6 py-4 space-y-3">
            <button onClick={() => scrollTo('about')} className="block text-sm text-neutral-400 hover:text-white transition-colors w-full text-left">About</button>
            <button onClick={() => scrollTo('expertise')} className="block text-sm text-neutral-400 hover:text-white transition-colors w-full text-left">Expertise</button>
            <button onClick={() => scrollTo('system')} className="block text-sm text-neutral-400 hover:text-white transition-colors w-full text-left">System</button>
            <button onClick={() => scrollTo('resources')} className="block text-sm text-neutral-400 hover:text-white transition-colors w-full text-left">Resources</button>
            <Link href="/dashboard" className="block text-sm text-indigo-400 font-medium">Dashboard</Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <FadeIn>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Building automated trading systems
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                Finding{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
                  market
                </span>
                <br />
                inefficiencies.
              </h1>
              <p className="text-base sm:text-lg text-neutral-400 max-w-md mb-8 leading-relaxed">
                I&apos;m Christian. I build algo trading systems, research statistical edges in futures &amp; options, and share everything I learn along the way.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="https://www.tiktok.com/@junho.p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
                  </svg>
                  @junho.p
                </a>
                <button
                  onClick={() => scrollTo('resources')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all"
                >
                  Free resources
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </FadeIn>

            {/* Terminal card */}
            <FadeIn delay={200}>
              <div
                ref={glowRef}
                className="relative rounded-2xl border border-white/[0.06] bg-[#111113] p-5 sm:p-6 overflow-hidden"
              >
                <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: 'radial-gradient(400px circle at var(--mx) var(--my), rgba(99,102,241,0.06), transparent 60%)' }}
                />
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <span className="ml-3 text-[10px] text-neutral-600 font-mono">noctiq ~ strategy_runner</span>
                </div>
                <TerminalText />
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Tech stack strip ── */}
      <section className="border-y border-white/5 bg-white/[0.01] overflow-hidden">
        <FadeIn>
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-neutral-500 font-mono">
            {['Python', 'Pine Script', 'Next.js', 'TradingView', 'Monte Carlo', 'TopStepX API', 'Supabase', 'Vercel'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 hover:text-neutral-300 transition-colors">
                <span className="w-1 h-1 rounded-full bg-indigo-500/50" />
                {t}
              </span>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── About ── */}
      <section id="about" className="py-20 sm:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
            <FadeIn className="lg:col-span-3">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
                Hey, I&apos;m <span className="text-indigo-400">Christian</span>.
              </h2>
              <div className="space-y-4 text-neutral-400 leading-relaxed">
                <p>
                  I trade futures and options with a quantitative, systematic approach &mdash; building
                  automated strategies that exploit statistical edges in the market. Mean reversion on
                  micro e-mini Nasdaq, volatility-based options plays, ATR-adjusted risk management.
                </p>
                <p>
                  I share everything I learn on TikTok: backtesting frameworks, how I built my
                  automated system from scratch, and the real math behind profitable strategies.
                  My goal is to make quantitative trading accessible to anyone willing to learn.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={150} className="lg:col-span-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 space-y-5">
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase">Quick stats</h3>
                {[
                  { label: 'Focus', value: 'MNQ / MES Futures' },
                  { label: 'Approach', value: 'Systematic & Automated' },
                  { label: 'Platform', value: 'TradingView + Custom API' },
                  { label: 'Content', value: '@junho.p on TikTok' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center text-sm border-b border-white/[0.04] pb-3 last:border-0 last:pb-0">
                    <span className="text-neutral-500">{item.label}</span>
                    <span className="text-white font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── Expertise ── */}
      <section id="expertise" className="py-20 sm:py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">What I work on</h2>
            <p className="text-neutral-500 max-w-lg mb-12">
              Building at the intersection of software engineering, statistics, and financial markets.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />,
                title: 'Algorithmic Trading',
                desc: 'End-to-end automated strategies: Pine Script signals, webhook routing, bracket order execution with stop loss and take profit, all via API.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
                title: 'Statistical Analysis',
                desc: 'Monte Carlo simulations, walk-forward backtesting, Sharpe ratio optimization. Data-driven edge quantification, not gut feelings.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
                title: 'Futures & Options',
                desc: 'MNQ, MES, and micro futures. Options for hedging and directional plays. Greeks, vol surfaces, and term structure analysis.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
                title: 'Full-Stack Engineering',
                desc: 'Next.js + React dashboards, REST APIs, webhook pipelines, Supabase for persistence, Vercel for deployment. Production-grade infra.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />,
                title: 'Risk Management',
                desc: 'Daily loss limits, per-trade cooldowns, max trade caps, drawdown protection, concurrent trade mutexes. Capital preservation first.',
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
                title: 'Prop Firm Trading',
                desc: 'Strategies built for funded accounts. Understanding evaluation rules, trailing drawdowns, and building systems that pass and sustain accounts.',
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="group h-full p-6 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">{item.icon}</svg>
                  </div>
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Noctiq System ── */}
      <section id="system" className="py-20 sm:py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
              The system
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">noctiq</h2>
            <p className="text-neutral-400 max-w-2xl mb-12 leading-relaxed">
              My end-to-end automated trading infrastructure. Signals from TradingView flow through
              a webhook API, get validated by a risk manager, and execute bracket orders on prop firm
              accounts &mdash; all monitored in real-time.
            </p>
          </FadeIn>

          <FadeIn delay={100}>
            <ArchitectureDiagram />
          </FadeIn>

          <FadeIn delay={200}>
            <div className="mt-12 grid sm:grid-cols-3 gap-4">
              {[
                { num: '8', label: 'Max trades/day', detail: 'Hard-coded risk limit' },
                { num: '$400', label: 'Daily loss cap', detail: 'Auto-stops trading' },
                { num: '60s', label: 'Trade cooldown', detail: 'Prevents overtrading' },
              ].map((item) => (
                <div key={item.label} className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.01] text-center">
                  <div className="text-2xl font-bold text-white mb-1">{item.num}</div>
                  <div className="text-sm text-neutral-400 font-medium">{item.label}</div>
                  <div className="text-xs text-neutral-600 mt-1">{item.detail}</div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors font-semibold text-sm text-white"
              >
                View live dashboard
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Resources (actually helpful) ── */}
      <section id="resources" className="py-20 sm:py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Free resources</h2>
            <p className="text-neutral-500 max-w-lg mb-12">
              Concepts and tools I wish someone had explained to me when I started. No fluff, just the actual stuff that matters.
            </p>
          </FadeIn>

          {/* Concepts grid */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {[
              {
                title: 'ATR-Based Position Sizing',
                desc: 'Stop using fixed stop losses. ATR (Average True Range) adjusts your stops to current volatility, so you\'re not getting stopped out on noise or leaving money on the table in quiet markets.',
                tag: 'Risk',
                tagColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
              },
              {
                title: 'Monte Carlo Backtesting',
                desc: 'A single backtest tells you almost nothing. Run 10,000 randomized simulations of your trade sequence to understand the real distribution of outcomes and worst-case drawdowns.',
                tag: 'Statistics',
                tagColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
              },
              {
                title: 'Walk-Forward Optimization',
                desc: 'In-sample optimization + out-of-sample validation, rolled forward through time. The only way to know if your strategy parameters are robust or curve-fitted.',
                tag: 'Backtesting',
                tagColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
              },
              {
                title: 'Prop Firm Evaluation Math',
                desc: 'The trailing drawdown on most evaluations means you need a strategy with specific characteristics: low variance, consistent edge, and disciplined risk per trade. Here\'s how to calculate what you need.',
                tag: 'Prop Firms',
                tagColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
              },
              {
                title: 'Bracket Orders Explained',
                desc: 'Entry + stop loss + take profit, submitted as one atomic order. This is how you automate risk management at the order level instead of relying on manual exits.',
                tag: 'Execution',
                tagColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
              },
              {
                title: 'Expectancy & Profit Factor',
                desc: 'Win rate means nothing without knowing your average win vs. average loss. Expectancy = (Win% × Avg Win) - (Loss% × Avg Loss). If it\'s positive and your sample size is large enough, you have an edge.',
                tag: 'Fundamentals',
                tagColor: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className="group h-full p-6 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.12] transition-all duration-300">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${item.tagColor}`}>
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Video content */}
          <FadeIn>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-white font-semibold text-lg mb-1">Video walkthroughs</h3>
                  <p className="text-sm text-neutral-500">Deep dives on TikTok covering these topics and more</p>
                </div>
                <a
                  href="https://www.tiktok.com/@junho.p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
                  </svg>
                  Follow @junho.p
                </a>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { title: 'Algo Trading Tutorial', views: '9.2K', desc: 'Building an automated system from scratch' },
                  { title: 'How I Became an Algo Trader', views: '6.1K', desc: 'The full journey and steps to get started' },
                  { title: 'ATR-Based Stops', views: '165', desc: 'Why dynamic stops beat fixed stops' },
                ].map((vid) => (
                  <a
                    key={vid.title}
                    href="https://www.tiktok.com/@junho.p"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-4 rounded-lg border border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.02] transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <svg className="w-4 h-4 text-neutral-600 group-hover:text-indigo-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      <span className="text-[10px] text-neutral-600 font-mono">{vid.views} views</span>
                    </div>
                    <div className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">{vid.title}</div>
                    <div className="text-xs text-neutral-600 mt-1">{vid.desc}</div>
                  </a>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 sm:py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.06] via-purple-500/[0.03] to-transparent p-10 sm:p-14 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">
                Want to learn more?
              </h2>
              <p className="text-neutral-400 max-w-md mx-auto mb-8">
                I post new content regularly on TikTok covering algo trading, backtesting, prop firms, and the math behind it all.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://www.tiktok.com/@junho.p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
                  </svg>
                  Follow on TikTok
                </a>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all font-medium"
                >
                  See the live system
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">
              <span className="text-white">noctiq</span>
              <span className="text-indigo-500">.ai</span>
            </span>
            <span className="text-neutral-600 text-sm">/ Christian</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://www.tiktok.com/@junho.p"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="TikTok"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
              </svg>
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
