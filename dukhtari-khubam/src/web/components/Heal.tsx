'use client'

import { useEffect, useState } from 'react'

import { leave, nextStep, report, type HealStep } from '../heal'

/**
 * What a broken screen shows: nothing alarming while the app repairs itself (heal.ts), and only if every
 * step failed, a calm card with "try again" and "home". `text` comes from the caller, because the
 * outermost boundary (global-error) lives outside the providers that hold the language.
 */
export function Heal({ error, reset, where, text }: {
  error: Error & { digest?: string }; reset: () => void; where: string
  text: { title: string; body: string; retry: string; home: string }
}) {
  const [step, setStep] = useState<HealStep | null>(null)
  useEffect(() => {
    report(error, where)
    const s = nextStep(Date.now(), location.pathname)
    setStep(s)
    if (s === 'reset') {
      const timer = setTimeout(reset, 120)
      return () => clearTimeout(timer)
    }
    if (s !== 'give_up') leave(s)
  }, [error, reset, where])

  if (step !== 'give_up') return <div className="heal-wait" aria-busy="true" />
  return (
    <div className="heal" role="alert">
      <span className="heal-icon" aria-hidden="true">🌸</span>
      <h1 className="heal-title">{text.title}</h1>
      <p className="heal-body">{text.body}</p>
      <div className="heal-actions">
        <button type="button" className="btn" onClick={() => { try { sessionStorage.removeItem('dk.heal') } catch { /* blocked */ } location.reload() }}>{text.retry}</button>
        <button type="button" className="btn btn-soft" onClick={() => { try { sessionStorage.removeItem('dk.heal') } catch { /* blocked */ } location.replace('/') }}>{text.home}</button>
      </div>
    </div>
  )
}
