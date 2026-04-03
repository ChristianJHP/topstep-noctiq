'use client'

import Link from 'next/link'

export default function MentorshipPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">

      {/* grid bg */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.03) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(59,130,246,0.03) 1px, transparent 1px)`,
          backgroundSize: '52px 52px',
        }}
      />
      <div
        className="fixed -z-10 rounded-full pointer-events-none"
        style={{
          width: 560, height: 400,
          top: '-80px', left: '50%', marginLeft: '-280px',
          background: 'radial-gradient(ellipse, rgba(37,99,235,0.09) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="max-w-2xl mx-auto px-6 py-10 pb-24">

        {/* back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition-colors duration-200 mb-10"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          back
        </Link>

        {/* header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
            </span>
            <span className="text-xs text-neutral-500 font-mono">1 on 1 · limited spots</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Work with me</h1>
          <p className="text-sm text-neutral-400 leading-relaxed max-w-md">
            Fill out the form below. If it looks like a fit I'll reach out directly — usually within a day or two.
          </p>
        </div>

        {/* form embed */}
        <div
          className="rounded-2xl overflow-hidden border border-white/[0.08]"
          style={{ background: '#0a0e17' }}
        >
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSemmGRvRjXYkQHpCV9WNFtcC7t8fFZUCl2SXX-_72PDN9zkeQ/viewform?embedded=true"
            width="100%"
            height="820"
            frameBorder="0"
            marginHeight="0"
            marginWidth="0"
            style={{ display: 'block', colorScheme: 'dark' }}
          >
            Loading…
          </iframe>
        </div>

      </div>
    </div>
  )
}
