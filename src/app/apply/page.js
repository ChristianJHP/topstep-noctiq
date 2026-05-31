'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import './apply.css'

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
    question: "What's your Discord username?",
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
    id: 'livetrading',
    type: 'options',
    question: 'Are you currently trading live?',
    options: ['Live money', 'Funded account', 'Paper trading', 'Not yet'],
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
    id: 'referral',
    type: 'options',
    question: 'How did you find me?',
    options: ['YouTube', 'Discord', 'Live stream', 'Someone referred me', 'Other'],
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
    <div className="apply-page apply-success">
      <div className="apply-success-inner">
        <div className="apply-success-icon">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <h2>Got it.</h2>
        <p>
          Next step is booking a quick call so we can go over where you&apos;re at and see if this is a good fit.
        </p>
        <a
          href="https://calendly.com/christian-park2002/1-on-1-introduction"
          target="_blank"
          rel="noopener noreferrer"
          className="apply-success-cta"
        >
          Book a Call
        </a>
        <Link href="/" className="apply-success-home">
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
    <div className="apply-page">
      <div className="apply-shell apply-top">
        <Link href="/" className="apply-back">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
          </svg>
          Back
        </Link>
        <span className="apply-step-count">{stepIndex + 1} / {STEPS.length}</span>
      </div>

      <div className="apply-shell apply-progress-wrap">
        <div className="apply-progress-track">
          <div
            className="apply-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {stepIndex === 0 && (
        <div className="apply-shell apply-intro">
          <h1>Apply for 1-on-1s</h1>
          <p>
            A few quick questions so I can understand where you&apos;re at as a trader and whether this would be a good fit.
          </p>
        </div>
      )}

      <div className="apply-shell">
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
          <h2 className="apply-question">{step.question}</h2>
          {step.optional && (
            <p className="apply-optional">optional</p>
          )}

          <div className={`apply-input-wrap${step.optional ? ' apply-input-wrap--optional' : ''}`}>
            {step.type === 'text' && (
              <input
                key={step.id}
                type="text"
                autoFocus
                autoComplete="off"
                value={answers[step.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [step.id]: e.target.value }))}
                placeholder={step.placeholder}
                className="apply-text-input"
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
                className="apply-textarea"
              />
            )}

            {step.type === 'options' && (
              <div className={`apply-options${step.options.length > 4 ? ' apply-options--multi' : ''}`}>
                {step.options.map(opt => {
                  const selected = answers[step.id] === opt
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setAnswers(a => ({ ...a, [step.id]: opt }))
                        if (!isLast) {
                          setTimeout(() => transition(stepIndex + 1, 'forward'), 260)
                        }
                      }}
                      className={`apply-option${selected ? ' apply-option--selected' : ''}`}
                    >
                      <span className="apply-option-radio">
                        {selected && <span className="apply-option-dot" />}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {error && (
            <p className="apply-error">{error}</p>
          )}

          <div className="apply-controls">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="apply-btn-back"
            >
              ← Back
            </button>

            {(step.type !== 'options' || isLast) && (
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceed() || submitting}
                className="apply-btn-next"
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
