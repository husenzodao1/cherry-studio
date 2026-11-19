'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { checkPin, clearPin, hasPin, setPin, waitLeft } from '../offline/pin'
import { clearRecovery, hasRecovery, normalizeAnswer, RECOVERY_COUNT, RECOVERY_QUESTIONS, recoveryQuestions, setRecovery, type RecoveryQuestion } from '../offline/recovery'
import { usePrefs } from '../prefs'
import type { UiKey } from '../i18n'
import { Icon } from './Icon'
import { PinPad } from './PinPad'

/**
 * Choosing the three life questions that open the app when the PIN is forgotten: each row picks a
 * question (no question twice) and takes its answer.
 */
export function RecoverySetup({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const { t } = usePrefs()
  const start = recoveryQuestions()
  const [rows, setRows] = useState<{ q: RecoveryQuestion; answer: string }[]>(() =>
    Array.from({ length: RECOVERY_COUNT }, (_, i) => ({ q: start[i] ?? RECOVERY_QUESTIONS[i], answer: '' })))
  const [busy, setBusy] = useState(false)
  const ok = new Set(rows.map((r) => r.q)).size === RECOVERY_COUNT && rows.every((r) => normalizeAnswer(r.answer).length >= 2)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    await setRecovery(rows)
    setBusy(false)
    onDone()
  }
  const change = (i: number, patch: Partial<{ q: RecoveryQuestion; answer: string }>) =>
    setRows((rs) => rs.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pin-screen recovery-setup" role="dialog" aria-modal="true" aria-label={t('recovery.setup_title')}>
      <form className="recovery-form" onSubmit={save}>
        <div style={{ textAlign: 'center' }}>
          <span className="pin-lock" aria-hidden="true"><Icon name="key" size={30} strokeWidth={1.4} /></span>
          <h1 className="pin-title">{t('recovery.setup_title')}</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.88em' }}>{t('recovery.setup_hint')}</p>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="glass recovery-row stagger">
            <span className="recovery-num">{i + 1}</span>
            <select className="input" value={r.q} aria-label={t('recovery.question')} onChange={(e) => change(i, { q: e.target.value as RecoveryQuestion })}>
              {RECOVERY_QUESTIONS.filter((q) => q === r.q || !rows.some((o) => o.q === q)).map((q) => (
                <option key={q} value={q}>{t(`recovery.q.${q}` as UiKey)}</option>
              ))}
            </select>
            <input className="input" value={r.answer} autoComplete="off" spellCheck={false} placeholder={t('recovery.answer')}
              aria-label={t('recovery.answer')} onChange={(e) => change(i, { answer: e.target.value })} />
          </div>
        ))}
        <button className="btn btn-block btn-lg" disabled={busy || !ok}>{t('start.save')} <Icon name="check" size={18} /></button>
        {onCancel ? <button type="button" className="link-btn" onClick={onCancel}>{t('pin.cancel')}</button> : null}
      </form>
    </div>,
    document.body
  )
}

type Flow = 'set' | 'change' | 'off'
type Step = 'current' | 'new' | 'repeat'

/** Settings: turn the app PIN on or off, or change it (the current PIN is asked first). */
export function PinSettings() {
  const { t } = usePrefs()
  const [on, setOn] = useState(false)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [step, setStep] = useState<Step>('new')
  const [first, setFirst] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  // a new PIN is followed by its three life questions
  const [questions, setQuestions] = useState<'required' | 'change' | null>(null)
  useEffect(() => setOn(hasPin()), [])

  const start = (f: Flow) => {
    setFlow(f)
    setStep(f === 'set' ? 'new' : 'current')
    setHint(null)
  }
  const close = () => {
    setFlow(null)
    setFirst('')
    setOn(hasPin())
  }
  const done = async (pin: string): Promise<boolean> => {
    if (step === 'current') {
      const r = await checkPin(pin)
      if (r !== 'ok') {
        setHint(r === 'wait' ? t('pin.wait').replace('{n}', String(waitLeft())) : t('pin.wrong'))
        return false
      }
      if (flow === 'off') {
        clearPin()
        clearRecovery()
        close()
      } else {
        setStep('new')
        setHint(null)
      }
      return true
    }
    if (step === 'new') {
      setFirst(pin)
      setStep('repeat')
      setHint(null)
      return true
    }
    if (pin !== first) {
      setStep('new')
      setFirst('')
      setHint(t('pin.mismatch'))
      return false
    }
    await setPin(pin)
    const needQuestions = !hasRecovery()
    close()
    if (needQuestions) setQuestions('required')
    return true
  }

  return (
    <>
      <div className="glass menu">
        <div className="menu-row">
          <Icon name="lock" />
          <span className="grow">{t('pin.title')}<span className="row-sub">{t('pin.hint')}</span></span>
          <button type="button" role="switch" className="switch" aria-checked={on} aria-label={t('pin.title')} onClick={() => start(on ? 'off' : 'set')} />
        </div>
        {on ? (
          <button type="button" className="menu-row" onClick={() => start('change')}>
            <Icon name="key" /><span className="grow">{t('pin.change')}</span><Icon name="forward" size={18} />
          </button>
        ) : null}
        {on ? (
          <button type="button" className="menu-row" onClick={() => setQuestions('change')}>
            <Icon name="info" /><span className="grow">{t('recovery.setup_title')}<span className="row-sub">{t(hasRecovery() ? 'recovery.set' : 'recovery.not_set')}</span></span>
            <Icon name="forward" size={18} />
          </button>
        ) : null}
      </div>
      {questions ? <RecoverySetup onDone={() => setQuestions(null)} onCancel={questions === 'change' ? () => setQuestions(null) : undefined} /> : null}
      {flow ? (
        <PinPad key={step} title={t(step === 'current' ? 'pin.current' : step === 'new' ? 'pin.new' : 'pin.repeat')} hint={hint} onDone={done} onCancel={close} />
      ) : null}
    </>
  )
}
