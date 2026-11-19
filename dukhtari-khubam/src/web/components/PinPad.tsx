'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/**
 * A minimal 4-digit pad on its own screen: four dots that fill as digits are typed, round glass keys,
 * a short shake when the PIN is refused. The phone keyboard's digits and Backspace work too.
 */
export function PinPad({ title, hint, onDone, onCancel, children }: {
  title: string
  hint?: string | null
  /** called with the four digits; false (or a promise of it) refuses them */
  onDone: (pin: string) => boolean | Promise<boolean>
  onCancel?: () => void
  children?: ReactNode
}) {
  const { t } = usePrefs()
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [busy, setBusy] = useState(false)

  const press = useCallback(async (key: string) => {
    if (busy) return
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, 4)
    setPin(next)
    if (next.length < 4) return
    setBusy(true)
    const ok = await onDone(next)
    setBusy(false)
    if (!ok) {
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setPin('')
      }, 420)
    } else setPin('')
  }, [busy, pin, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Escape' && onCancel) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, onCancel])

  if (typeof document === 'undefined') return null
  // on <body>, so no card or animation around it can confine the full-screen pad
  return createPortal(
    <div className="pin-screen" role="dialog" aria-modal="true" aria-label={title}>
      <div className="pin-head">
        <span className="pin-lock" aria-hidden="true"><Icon name="lock" size={34} strokeWidth={1.4} /></span>
        <h1 className="pin-title">{title}</h1>
        <p className="pin-hint" role="status">{hint ?? ' '}</p>
        <div className={`pin-dots${shake ? ' is-wrong' : ''}`} aria-label={`${pin.length} / 4`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'is-on' : ''} />)}
        </div>
      </div>
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
          <button key={k} type="button" className="pin-key" onClick={() => press(k)}>{k}</button>
        ))}
        {onCancel ? <button type="button" className="pin-key pin-key-text" onClick={onCancel}>{t('pin.cancel')}</button> : <span />}
        <button type="button" className="pin-key" onClick={() => press('0')}>0</button>
        <button type="button" className="pin-key pin-key-text" onClick={() => press('del')} aria-label={t('pin.delete')} disabled={!pin}>
          <Icon name="backspace" size={24} />
        </button>
      </div>
      <div className="pin-foot">{children}</div>
    </div>,
    document.body
  )
}
