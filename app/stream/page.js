'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

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

/* ── candlestick background (full-screen, prominent) ── */
function CandlestickBg() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animId
    let frameOffset = 0

    const CW = 10
    const GAP = 7
    const STRIDE = CW + GAP
    const SPEED = 0.25

    const nextCandle = (prev) => {
      const open = prev
      const change = (Math.random() - 0.48) * 0.09
      const close = Math.max(0.06, Math.min(0.94, open + change))
      const wickUp = Math.random() * 0.05
      const wickDown = Math.random() * 0.05
      return {
        open,
        close,
        high: Math.min(Math.max(open, close) + wickUp, 0.97),
        low: Math.max(Math.min(open, close) - wickDown, 0.03),
      }
    }

    const candles = []
    let price = 0.5
    for (let i = 0; i < 120; i++) {
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
          candles.push(nextCandle(candles[candles.length - 1].close))
          candles.shift()
        }
      }

      const chartTop = H * 0.06
      const chartH = H * 0.88
      const toY = (v) => chartTop + (1 - v) * chartH

      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]
        const stepsFromRight = candles.length - 1 - i
        const x = W - GAP - CW - stepsFromRight * STRIDE - frameOffset
        if (x + CW < -STRIDE || x > W + STRIDE) continue

        const isBullish = c.close >= c.open
        const openY = toY(c.open)
        const closeY = toY(c.close)
        const bodyTop = Math.min(openY, closeY)
        const bodyH = Math.max(Math.abs(closeY - openY), 2)

        ctx.strokeStyle = isBullish ? 'rgba(96,165,250,0.45)' : 'rgba(203,213,225,0.28)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x + CW / 2, toY(c.high))
        ctx.lineTo(x + CW / 2, toY(c.low))
        ctx.stroke()

        ctx.fillStyle = isBullish ? 'rgba(59,130,246,0.3)' : 'rgba(148,163,184,0.18)'
        ctx.fillRect(x, bodyTop, CW, bodyH)

        ctx.strokeStyle = isBullish ? 'rgba(96,165,250,0.65)' : 'rgba(203,213,225,0.38)'
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

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
}

/* ── pulsing live dot ── */
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  )
}

/* ─────────────── stream page ─────────────── */
export default function StreamPage() {
  const brand = useScramble('noctiq', { speed: 30, delay: 200 })
  const handle = useScramble('@JHPTrades', { speed: 24, delay: 600 })

  return (
    <div
      className="relative w-screen h-screen overflow-hidden text-white select-none"
      style={{ background: '#050810' }}
    >
      <style>{`
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(40px,-30px) scale(1.06); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-30px,40px) scale(1.04); }
        }
        @keyframes fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .blob1 { animation: drift1 14s ease-in-out infinite; }
        .blob2 { animation: drift2 18s ease-in-out infinite; }
        .fadein { animation: fadein 1s cubic-bezier(.16,1,.3,1) both; }
        @keyframes scanline {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .scanline {
          animation: scanline 8s linear infinite;
          background: linear-gradient(transparent, rgba(59,130,246,0.03), transparent);
        }
      `}</style>

      {/* ambient blobs */}
      <div className="blob1 absolute -z-0 rounded-full pointer-events-none"
        style={{ width: 500, height: 380, top: '-60px', left: '50%', marginLeft: '-250px',
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.12) 0%, transparent 70%)',
          filter: 'blur(80px)' }} />
      <div className="blob2 absolute -z-0 rounded-full pointer-events-none"
        style={{ width: 340, height: 280, bottom: '5%', right: '-60px',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
          filter: 'blur(90px)' }} />

      {/* subtle grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(59,130,246,0.025) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(59,130,246,0.025) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />

      {/* scanline sweep */}
      <div className="scanline absolute inset-x-0 h-32 pointer-events-none" style={{ zIndex: 1 }} />

      {/* candlestick */}
      <CandlestickBg />

      {/* top-left — brand */}
      <div className="fadein absolute top-5 left-5 z-10" style={{ animationDelay: '100ms' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-black text-lg tracking-tight font-mono" style={{ letterSpacing: '-0.04em' }}>
            {brand}<span className="text-blue-500">.ai</span>
          </span>
        </div>
        <p className="text-[10px] text-neutral-600 tracking-wide">turning my trading systems into a platform</p>
      </div>

      {/* top-right — live badge */}
      <div className="fadein absolute top-5 right-5 z-10 flex items-center gap-2" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10">
          <LiveDot />
          <span className="text-[11px] font-bold text-red-400 tracking-widest uppercase">Live</span>
        </div>
      </div>

      {/* center — main visual element */}
      <div className="fadein absolute inset-x-0 flex flex-col items-center justify-center z-10"
        style={{ top: '38%', animationDelay: '500ms' }}>
        <div
          className="text-[11px] font-semibold uppercase tracking-[0.25em] text-neutral-600 mb-3"
        >
          Futures · Quant · Systems
        </div>
        <div
          className="font-black text-white font-mono"
          style={{ fontSize: 'clamp(2.2rem, 8vw, 3.5rem)', letterSpacing: '-0.04em',
            textShadow: '0 0 40px rgba(59,130,246,0.3)' }}
        >
          {handle}
        </div>
      </div>

      {/* bottom — subtle bar */}
      <div className="fadein absolute bottom-0 inset-x-0 z-10 px-5 pb-5 pt-8"
        style={{ animationDelay: '700ms',
          background: 'linear-gradient(to top, rgba(5,8,16,0.85) 0%, transparent 100%)' }}>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-neutral-600 uppercase tracking-widest mb-1">Quant tools for futures traders</div>
            <div className="text-[11px] text-neutral-500 font-mono">noctiq.ai</div>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-neutral-700 uppercase tracking-wider">
            <span>TikTok</span>
            <span className="text-neutral-800">·</span>
            <span>YouTube</span>
            <span className="text-neutral-800">·</span>
            <span>Discord</span>
          </div>
        </div>
      </div>
    </div>
  )
}
