'use client'

import Link from 'next/link'
import './home.css'

function Logo() {
  return (
    <svg viewBox="0 0 106 36" width="106" height="36" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-8 w-auto block shrink-0" aria-hidden>
      <line x1="6.5" y1="9" x2="6.5" y2="13" stroke="#94a3b8" strokeWidth="1.2"/>
      <rect x="3" y="13" width="7" height="10" rx="1" fill="#94a3b8" fillOpacity="0.55"/>
      <line x1="6.5" y1="23" x2="6.5" y2="27" stroke="#94a3b8" strokeWidth="1.2"/>
      <line x1="16.5" y1="7" x2="16.5" y2="11" stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.9"/>
      <rect x="13" y="11" width="7" height="14" rx="1" fill="#3b82f6" fillOpacity="0.55"/>
      <line x1="16.5" y1="25" x2="16.5" y2="29" stroke="#3b82f6" strokeWidth="1.2" strokeOpacity="0.9"/>
      <line x1="26.5" y1="2" x2="26.5" y2="6" stroke="#60a5fa" strokeWidth="1.2"/>
      <rect x="23" y="6" width="7" height="22" rx="1" fill="#3b82f6"/>
      <line x1="26.5" y1="28" x2="26.5" y2="33" stroke="#60a5fa" strokeWidth="1.2"/>
      <text x="36" y="29" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="26" fill="#e8eaed" letterSpacing="-0.5">JHP</text>
    </svg>
  )
}

const OFFERS = [
  {
    href: '/apply',
    external: false,
    primary: true,
    title: '1-on-1 Help',
    desc: 'We go through your trades and execution. Small cohort — you apply first.',
    tag: 'Apply',
    tagClass: 'home-card-tag--apply',
    cta: 'Apply',
  },
  {
    href: '/bias',
    external: false,
    title: 'Daily Bias',
    desc: 'NQ and ES levels, 4H/1H color, headlines, and macro times. Updates through the session.',
    tag: 'Free',
    tagClass: 'home-card-tag--free',
    cta: 'Daily bias',
  },
  {
    href: 'https://discord.gg/aCNadDMvmH',
    external: true,
    title: 'Discord',
    desc: 'I trade RTH live in the server. Journal, watch fills, ask questions.',
    tag: 'Free',
    tagClass: 'home-card-tag--free',
    cta: 'Join Discord',
  },
]

const TOOLS = [
  { name: 'TradingView', url: 'https://www.tradingview.com/?aff_id=164318&aff_sub=jhp', note: 'Charts & alerts' },
  { name: 'TradeZella', url: 'https://refer.tradezella.com/christian-park', note: 'Journal' },
]

const SOCIALS = [
  { name: 'TikTok', url: 'https://www.tiktok.com/@jhp.trades', icon: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.72a8.19 8.19 0 004.76 1.52V6.79a4.83 4.83 0 01-1-.1z' },
  { name: 'YouTube', url: 'https://www.youtube.com/@JHPTrades', icon: 'M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z' },
  { name: 'Discord', url: 'https://discord.gg/aCNadDMvmH', icon: 'M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056a19.904 19.904 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z' },
  { name: 'Instagram', url: 'https://www.instagram.com/christiannpark', icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
]

function OfferCard({ offer }) {
  const className = `home-card${offer.primary ? ' home-card--primary' : ''}`
  const inner = (
    <>
      <div className="home-card-top">
        <div>
          <div className="home-card-title">{offer.title}</div>
          <p className="home-card-desc">{offer.desc}</p>
        </div>
        <span className={`home-card-tag ${offer.tagClass}`}>{offer.tag}</span>
      </div>
      <div className="home-card-cta">{offer.cta} →</div>
    </>
  )

  if (offer.external) {
    return (
      <a href={offer.href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    )
  }
  return <Link href={offer.href} className={className}>{inner}</Link>
}

export default function Page() {
  return (
    <div className="home-page">
      <header className="home-nav sticky top-0 z-50">
        <div className="home-shell home-nav-inner">
          <Link href="/" aria-label="JHP Trades home">
            <Logo />
          </Link>
          <nav className="home-nav-links">
            <Link href="/apply" className="home-nav-cta">1-on-1</Link>
            <Link href="/bias">Bias</Link>
            <a href="https://discord.gg/aCNadDMvmH" target="_blank" rel="noopener noreferrer">Discord</a>
          </nav>
        </div>
      </header>

      <main>
        <section className="home-shell home-hero">
          <p className="home-live">
            <span className="home-live-dot" />
            NQ & ES · RTH
          </p>
          <h1>JHP Trades</h1>
          <p className="home-hero-lead">
            Free daily bias, live Discord during the session, and a small 1-on-1 cohort.
          </p>
          <p className="home-contact">
            Contact me at{' '}
            <a href="mailto:christian@jhptrades.com">christian@jhptrades.com</a>
          </p>
        </section>

        <section className="home-shell">
          <div className="home-cards">
            {OFFERS.map((offer) => (
              <OfferCard key={offer.title} offer={offer} />
            ))}
          </div>
        </section>

        <section className="home-shell home-tools">
          <p className="home-divider-label">Tools</p>
          {TOOLS.map((t) => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="home-tool-row"
            >
              <strong>{t.name}</strong>
              <span>{t.note} ↗</span>
            </a>
          ))}
        </section>

        <section className="home-shell">
          <div className="home-socials">
            {SOCIALS.map((s) => (
              <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" title={s.name}>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d={s.icon} />
                </svg>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-shell home-footer-row">
          <span>jhptrades.com</span>
          <div className="home-footer-links">
            <a href="mailto:christian@jhptrades.com">Email</a>
            <Link href="/apply">1-on-1</Link>
            <Link href="/bias">Daily Bias</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
