'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/** A soft tap of the phone's motor, where the phone allows it (Android app and Chrome). */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* no vibration motor or not allowed */
  }
}

const OK_MS = 1050
const BAD_MS = 720

/**
 * A minimal 4-digit pad on its own screen: four dots that fill as digits are typed and round glass keys.
 * A right PIN is not let through at once: the four dots rise one after another and settle, the lock turns
 * into a drawn tick, and only then the pad opens. A wrong PIN makes the dots jump, turn red and shake from
 * side to side with a soft vibration. The phone keyboard's digits and Backspace work too.
 */
export function PinPad({ title, hint, onDone, onSuccess, onCancel, celebrate = false, children }: {
  title: string
  hint?: string | null
  /** called with the four digits; false (or a promise of it) refuses them */
  onDone: (pin: string) => boolean | Promise<boolean>
  /** called after the success animation (only with `celebrate`) */
  onSuccess?: () => void
  onCancel?: () => void
  /** play the rising dots and the tick before `onSuccess` */
  celebrate?: boolean
  children?: ReactNode
}) {
  const { t } = usePrefs()
  const [pin, setPin] = useState('')
  const [phase, setPhase] = useState<'idle' | 'ok' | 'bad'>('idle')
  const busy = useRef(false)

  const press = useCallback(async (key: string) => {
    if (busy.current) return
    if (key === 'del') return setPin((p) => p.slice(0, -1))
    const next = (pin + key).slice(0, 4)
    setPin(next)
    if (next.length < 4) return
    busy.current = true
    const ok = await onDone(next)
    if (!ok) {
      setPhase('bad')
      buzz([28, 60, 28])
      setTimeout(() => {
        setPhase('idle')
        setPin('')
        busy.current = false
      }, BAD_MS)
    } else if (celebrate) {
      setPhase('ok')
      buzz(14)
      setTimeout(() => onSuccess?.(), OK_MS)
    } else {
      setPin('')
      busy.current = false
    }
  }, [pin, onDone, onSuccess, celebrate])

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
    <div className={`pin-screen${phase === 'ok' ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="pin-head">
        <span className={`pin-lock${phase === 'ok' ? ' is-ok' : phase === 'bad' ? ' is-bad' : ''}`} aria-hidden="true">
          <Icon name="lock" size={34} strokeWidth={1.4} className="pin-lock-shape" />
          <svg className="pin-tick" width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="17" />
            <path d="M12.5 20.5l5.2 5.2L28 15" />
          </svg>
        </span>
        <h1 className="pin-title">{title}</h1>
        <p className="pin-hint" role="status">{hint ?? ' '}</p>
        <div className={`pin-dots${phase === 'bad' ? ' is-wrong' : phase === 'ok' ? ' is-right' : ''}`} aria-label={`${pin.length} / 4`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={i < pin.length ? 'is-on' : ''} style={{ ['--i' as string]: i }} />)}
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
