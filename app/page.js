'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

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

function TerminalText() {
  const lines = [
    '$ python backtest.py --strategy mean_reversion --instrument MNQ',
    '> Loading 252 trading days of tick data...',
    '> Running Monte Carlo simulation (10,000 paths)...',
    '> Sharpe: 2.41 | Win Rate: 67.3% | Max DD: -4.2%',
    '> Strategy deployed to live account.',
    '$ _'
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
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!started.current || lineIndex >= lines.length) return
    const line = lines[lineIndex]
    if (currentChar < line.length) {
      const speed = line.startsWith('$') ? 45 : 20
      const timeout = setTimeout(() => setCurrentChar(c => c + 1), speed)
      return () => clearTimeout(timeout)
    } else {
      const timeout = setTimeout(() => {
        setVisibleLines(prev => [...prev, line])
        setLineIndex(i => i + 1)
        setCurrentChar(0)
      }, line.startsWith('>') ? 300 : 500)
      return () => clearTimeout(timeout)
    }
  }, [lineIndex, currentChar])

  const typingLine = lineIndex < lines.length ? lines[lineIndex].slice(0, currentChar) : null

  return (
    <div ref={ref} className="font-mono text-xs sm:text-sm leading-relaxed">
      {visibleLines.map((line, i) => (
        <div key={i} className={line.startsWith('$') ? 'text-emerald-400' : line.includes('Sharpe') ? 'text-indigo-400' : 'text-neutral-500'}>
          {line}
        </div>
      ))}
      {typingLine !== null && (
        <div className={lines[lineIndex]?.startsWith('$') ? 'text-emerald-400' : lines[lineIndex]?.includes('Sharpe') ? 'text-indigo-400' : 'text-neutral-500'}>
          {typingLine}
          <span className="animate-pulse">|</span>
        </div>
      )}
    </div>
  )
}

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

export default function LandingPage() {
  const glowRef = useMouseGlow()
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen text-white relative">
      <GridBackground />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">
            <span className="text-white">noctiq</span>
            <span className="text-indigo-500">.ai</span>
          </span>
          <div className="flex items-center gap-6">
            <a href="#about" className="text-sm text-neutral-400 hover:text-white transition-colors">About</a>
            <a href="#expertise" className="text-sm text-neutral-400 hover:text-white transition-colors">Expertise</a>
            <a href="#content" className="text-sm text-neutral-400 hover:text-white transition-colors">Content</a>
            <Link
              href="/dashboard"
              className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors font-medium"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Algo trader & content creator
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
                Finding{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                  market
                </span>
                <br />
                inefficiencies.
              </h1>
              <p className="text-lg text-neutral-400 max-w-md mb-8 leading-relaxed">
                I build automated trading systems, research statistical edges in futures & options markets, and teach others how to do the same.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://www.tiktok.com/@jung.ho.p"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
                  </svg>
                  Follow @jung.ho.p
                </a>
                <a
                  href="#expertise"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/10 text-sm text-neutral-300 hover:border-white/25 hover:text-white transition-all"
                >
                  Learn more
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Terminal card */}
            <div
              ref={glowRef}
              className="relative rounded-2xl border border-white/[0.06] bg-[#111113] p-6 overflow-hidden glow-card"
            >
              <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: 'radial-gradient(400px circle at var(--mx) var(--my), rgba(99,102,241,0.06), transparent 60%)' }}
              />
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 text-xs text-neutral-600 font-mono">noctiq ~ strategy_runner</span>
              </div>
              <TerminalText />
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: 97, suffix: '+', label: 'TikTok Followers' },
            { value: 8700, suffix: '+', label: 'Video Views' },
            { value: 3, suffix: '+', label: 'Years Trading' },
            { value: 100, suffix: '%', label: 'Automated Systems' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-sm text-neutral-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
              Hey, I'm <span className="text-indigo-400">Christian</span>.
            </h2>
            <div className="space-y-4 text-neutral-400 leading-relaxed">
              <p>
                I trade futures and options with a quantitative, systematic approach. My focus is on
                building automated strategies that exploit statistical edges in the market — from mean
                reversion setups on micro e-mini Nasdaq futures to volatility-based options plays.
              </p>
              <p>
                I share everything I learn on TikTok — from backtesting frameworks and ATR-based stop
                losses to how I became a retail algorithmic trader. My goal is to make quantitative
                trading accessible to anyone willing to put in the work.
              </p>
              <p>
                Noctiq is the system I built to automate my trading — from TradingView signal
                generation to automated order execution on prop firm accounts, complete with risk
                management and real-time monitoring.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Expertise */}
      <section id="expertise" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">What I work on</h2>
            <p className="text-neutral-500 max-w-lg">
              Building at the intersection of software engineering, statistics, and financial markets.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: 'Algorithmic Trading',
                desc: 'Automated strategies on futures markets. From signal generation in Pine Script to execution via API with bracket orders and risk controls.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Statistical Analysis',
                desc: 'Monte Carlo simulations, backtesting with walk-forward optimization, and edge quantification. Data-driven decisions, not gut feelings.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Futures & Options',
                desc: 'Trading MNQ, MES, and other micro futures. Options strategies for hedging and directional plays. Understanding Greeks and volatility surfaces.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
                title: 'Software Engineering',
                desc: 'Full-stack systems powering the trading operation. Next.js dashboards, API integrations, real-time monitoring, and webhook pipelines.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: 'Risk Management',
                desc: 'Position sizing, daily loss limits, cooldown systems, and automated drawdown protection. Capital preservation is the priority.',
              },
              {
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                ),
                title: 'Education & Content',
                desc: 'Breaking down complex quant concepts on TikTok. Algo trading tutorials, backtesting walkthroughs, and prop firm strategies.',
              },
            ].map((item, i) => (
              <div
                key={i}
                className="group p-6 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-500/15 transition-colors">
                  {item.icon}
                </div>
                <h3 className="text-white font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content / TikTok */}
      <section id="content" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Content & community</h2>
            <p className="text-neutral-500 max-w-lg">
              I share what I learn about quantitative trading, markets, and building automated systems.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                title: 'ATR-Based Stop Losses',
                desc: 'Why fixed stops are leaving money on the table and how volatility-adjusted stops adapt to market conditions.',
                views: '165',
                tag: 'Strategy',
              },
              {
                title: 'Algo Trading Tutorial',
                desc: 'Step-by-step walkthrough of building an automated trading system from scratch.',
                views: '9.2K',
                tag: 'Tutorial',
              },
              {
                title: 'How I Became an Algo Trader',
                desc: 'My journey from zero to building and deploying automated trading strategies on prop firm accounts.',
                views: '6.1K',
                tag: 'Story',
              },
            ].map((item, i) => (
              <a
                key={i}
                href="https://www.tiktok.com/@jung.ho.p"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-6 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {item.tag}
                  </span>
                  <span className="text-xs text-neutral-600">{item.views} views</span>
                </div>
                <h3 className="text-white font-semibold mb-2 group-hover:text-indigo-400 transition-colors">{item.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
              </a>
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href="https://www.tiktok.com/@jung.ho.p"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z"/>
              </svg>
              See all videos on TikTok
            </a>
          </div>
        </div>
      </section>

      {/* Noctiq system */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/[0.05] to-purple-500/[0.03] p-10 sm:p-14">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-6">
                The system
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-6">
                noctiq
              </h2>
              <div className="space-y-4 text-neutral-400 leading-relaxed">
                <p>
                  Noctiq is my end-to-end automated trading infrastructure. It takes signals from
                  TradingView strategies, executes bracket orders on prop firm accounts via API,
                  and monitors everything in real-time through a custom dashboard.
                </p>
                <p>
                  Built with Next.js, it includes risk management (daily loss limits, trade
                  cooldowns, position sizing), AI-powered market analysis, multi-account support,
                  and a full trade journal with P&L tracking.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-4">
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
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6">
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
              href="https://www.tiktok.com/@jung.ho.p"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
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
