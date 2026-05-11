'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const STEPS = [
  {
    id: 'name',
    type: 'text',
    question: "What's your name?",
    placeholder: 'First name is fine',
  },
  {
    id: 'discord',
    type: 'text',
    question: 'Discord username',
    placeholder: 'e.g. jhp.trades',
  },
  {
    id: 'market',
    type: 'options',
    question: 'What do you mainly trade?',
    options: ['NQ', 'ES', 'Gold', 'Options', 'Crypto', 'Other'],
  },
  {
    id: 'experience',
    type: 'options',
    question: 'How long have you been trading?',
    options: ['Just getting started', 'Under 6 months', '6–12 months', '1–2 years', '2+ years'],
  },
  {
    id: 'struggle',
    type: 'options',
    question: 'What do you struggle with most right now?',
    options: ['Overtrading', 'Risk management', 'Psychology', 'Consistency', 'Entries', 'No clear system'],
  },
  {
    id: 'baddays',
    type: 'textarea',
    question: 'What usually causes your bad trading days?',
    placeholder: 'Be specific — this helps a lot',
  },
  {
    id: 'improve',
    type: 'textarea',
    question: 'What are you trying to improve most over the next few months?',
    placeholder: 'Where do you want to be?',
  },
  {
    id: 'commitment',
    type: 'options',
    question: 'How serious are you about improving right now?',
    options: ['Just exploring', 'Looking for more structure', 'Ready to fully lock in'],
  },
  {
    id: 'notes',
    type: 'textarea',
    question: 'Anything else I should know?',
    placeholder: 'Leave blank if not',
    optional: true,
  },
]

function SuccessCard() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-3">Got it.</h2>
        <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
          Next step is booking a quick call so we can go over where you're at and see if this is a good fit.
        </p>
        <a
          href="https://calendly.com/christian-park2002/1-on-1-introduction"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors text-sm"
        >
          Book a Call
        </a>
        <Link href="/" className="block mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Back to home
        </Link>
      </div>
    </div>
  )
}

export default function ApplyPage() {
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState({})
  const [visible, setVisible] = useState(true)
  const [direction, setDirection] = useState('forward')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const progressPct = Math.round(((stepIndex + 1) / STEPS.length) * 100)

  const canProceed = useCallback(() => {
    if (step.optional) return true
    const val = answers[step.id]
    return val !== undefined && val.toString().trim().length > 0
  }, [step, answers])

  const transition = useCallback((newIndex, dir) => {
    setDirection(dir)
    setVisible(false)
    setTimeout(() => {
      setStepIndex(newIndex)
      setVisible(true)
    }, 160)
  }, [])

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      setSubmitted(true)
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.')
      setSubmitting(false)
    }
  }, [answers])

  const goNext = useCallback(() => {
    if (!canProceed()) return
    if (isLast) { handleSubmit(); return }
    transition(stepIndex + 1, 'forward')
  }, [canProceed, isLast, stepIndex, transition, handleSubmit])

  const goBack = useCallback(() => {
    if (stepIndex === 0) return
    transition(stepIndex - 1, 'back')
  }, [stepIndex, transition])

  // keyboard: Enter advances text steps, option steps auto-advance on selection
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && step.type !== 'textarea') {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, goNext])

  if (submitted) return <SuccessCard />

  return (
    <div className="min-h-screen bg-white">

      {/* top bar */}
      <div className="max-w-lg mx-auto px-6 pt-8 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
          </svg>
          Back
        </Link>
        <span className="text-xs text-gray-400">{stepIndex + 1} / {STEPS.length}</span>
      </div>

      {/* progress bar */}
      <div className="max-w-lg mx-auto px-6 pt-4 pb-12">
        <div className="h-0.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* page title — only on step 0 */}
      {stepIndex === 0 && (
        <div className="max-w-lg mx-auto px-6 mb-10">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Apply for 1-on-1s</h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            A few quick questions so I can understand where you're at as a trader and whether this would be a good fit.
          </p>
        </div>
      )}

      {/* step card */}
      <div className="max-w-lg mx-auto px-6">
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible
              ? 'translateY(0)'
              : direction === 'forward'
              ? 'translateY(10px)'
              : 'translateY(-10px)',
            transition: 'opacity 0.16s ease, transform 0.16s ease',
          }}
        >
          {/* question */}
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {step.question}
          </h2>
          {step.optional && (
            <p className="text-xs text-gray-400 mb-6">optional</p>
          )}

          {/* inputs */}
          <div className={step.optional ? '' : 'mt-6'}>

            {step.type === 'text' && (
              <input
                key={step.id}
                type="text"
                autoFocus
                autoComplete="off"
                value={answers[step.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [step.id]: e.target.value }))}
                placeholder={step.placeholder}
                className="w-full text-lg border-0 border-b-2 border-gray-200 focus:border-blue-600 focus:outline-none py-3 bg-transparent text-gray-900 placeholder:text-gray-300 transition-colors duration-200"
              />
            )}

            {step.type === 'textarea' && (
              <textarea
                key={step.id}
                autoFocus
                value={answers[step.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [step.id]: e.target.value }))}
                placeholder={step.placeholder}
                rows={4}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-blue-400 resize-none bg-gray-50/60 transition-colors duration-200"
              />
            )}

            {step.type === 'options' && (
              <div className={`grid gap-2 ${step.options.length > 4 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {step.options.map(opt => {
                  const selected = answers[step.id] === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        setAnswers(a => ({ ...a, [step.id]: opt }))
                        // auto-advance after short delay so user sees selection
                        if (!isLast) {
                          setTimeout(() => transition(stepIndex + 1, 'forward'), 260)
                        }
                      }}
                      className={`text-left px-4 py-3.5 rounded-xl border text-sm font-medium transition-all duration-150 flex items-center gap-3 ${
                        selected
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-150 ${
                        selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                      }`}>
                        {selected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white block" />
                        )}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* error */}
          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}

          {/* controls */}
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={goBack}
              disabled={stepIndex === 0}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:pointer-events-none disabled:opacity-0"
            >
              ← Back
            </button>

            {/* for option steps the card auto-advances — show Next only for text/textarea */}
            {(step.type !== 'options' || isLast) && (
              <button
                onClick={goNext}
                disabled={!canProceed() || submitting}
                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-6 py-2.5 rounded-full hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
