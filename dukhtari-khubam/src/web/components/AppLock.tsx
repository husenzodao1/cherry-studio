'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { playIntro } from '../intro'
import { useLearner } from '../offline/learner'
import { checkPin, clearPin, hasPin, setPin, waitLeft } from '../offline/pin'
import { checkAnswer, hasRecovery, recoveryQuestions, recoveryWait } from '../offline/recovery'
import { checkPassword, unlockWithPhone } from '../offline/unlock'
import { usePrefs } from '../prefs'
import type { UiKey } from '../i18n'
import { Icon } from './Icon'
import { buzz, PinPad } from './PinPad'

const AWAY_MS = 60_000

type Stage = 'pin' | 'questions' | 'choose' | 'new' | 'repeat'

/** Three life questions, one after another; each right answer is ticked before the next comes in. */
function Questions({ onPassed }: { onPassed: () => void }) {
  const { t } = usePrefs()
  const qs = recoveryQuestions()
  const [at, setAt] = useState(0)
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState<'idle' | 'ok' | 'bad'>('idle')
  const [hint, setHint] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!answer.trim() || state === 'ok') return
    const r = await checkAnswer(at, answer)
    if (r === 'ok') {
      setState('ok')
      setHint(null)
      buzz(12)
      setTimeout(() => {
        setAnswer('')
        setState('idle')
        if (at + 1 >= qs.length) onPassed()
        else setAt(at + 1)
      }, 850)
    } else {
      setState('bad')
      buzz([24, 50, 24])
      setHint(r === 'wait' ? t('pin.wait').replace('{n}', String(recoveryWait())) : t('recovery.wrong'))
      setTimeout(() => setState('idle'), 600)
    }
  }
  return (
    <form className="recovery" onSubmit={submit} key={at}>
      <div className="recovery-steps" aria-hidden="true">
        {qs.map((_, i) => <span key={i} className={i < at || (i === at && state === 'ok') ? 'is-done' : i === at ? 'is-now' : ''} />)}
      </div>
      <span className="eyebrow">{t('recovery.step').replace('{n}', String(at + 1)).replace('{total}', String(qs.length))}</span>
      <h2 className="recovery-q">{t(`recovery.q.${qs[at]}` as UiKey)}</h2>
      <div className={`recovery-field${state === 'ok' ? ' is-ok' : state === 'bad' ? ' is-bad' : ''}`}>
        <input className="input" value={answer} autoFocus autoComplete="off" autoCapitalize="sentences" spellCheck={false}
          aria-label={t(`recovery.q.${qs[at]}` as UiKey)} placeholder={t('recovery.answer')} onChange={(e) => setAnswer(e.target.value)} />
        <button className="recovery-go" disabled={!answer.trim()} aria-label={t('action.check')}>
          <Icon name={state === 'ok' ? 'check' : 'arrow'} size={20} />
        </button>
      </div>
      <p className="pin-hint" role="status">{hint ?? ' '}</p>
    </form>
  )
}

/**
 * With a PIN set, the app opens behind the PIN pad, and again when it comes back after more than a
 * minute away. Until the PIN is right nothing of the app is drawn (the boot script in layout.tsx marks
 * <html> as locked before the first paint). "Forgot PIN" asks the three life questions chosen with the
 * PIN, then offers to turn the PIN off or to set a new one; without questions it asks the phone's own
 * lock or the login password. When all of that is forgotten too, the support chat stays open.
 */
export function AppLock() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const path = usePathname() ?? '/'
  const [locked, setLocked] = useState(false)
  const [stage, setStage] = useState<Stage>('pin')
  const [hint, setHint] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [first, setFirst] = useState('')
  const onSupport = /^\/support(\/|$)/.test(path)

  // before the first paint, so nothing behind the lock flashes
  useLayoutEffect(() => {
    if (hasPin()) setLocked(true)
    else {
      document.documentElement.classList.remove('locked')
      playIntro()
    }
  }, [])
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('locked', locked && !onSupport)
  }, [locked, onSupport])
  useEffect(() => {
    let hiddenAt = 0
    const onVisible = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && hasPin()) {
        document.documentElement.classList.add('locked')
        setStage('pin')
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  if (!locked || onSupport) return null
  const open = () => {
    setLocked(false)
    setStage('pin')
    setHint(null)
    setAsking(false)
    setPassword('')
    setFirst('')
    playIntro()
  }
  const forgot = async () => {
    setHint(null)
    if (hasRecovery()) return setStage('questions')
    const r = await unlockWithPhone(t('settings.unlock_title'), t('pin.forgot'))
    if (r === 'ok') setStage('choose')
    else if (r === 'password') {
      if (learner?.username) setAsking(true)
      else setHint(t('pin.reinstall'))
    }
  }
  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    const r = await checkPassword(learner!.username!, password)
    if (r === 'ok') {
      setAsking(false)
      setStage('choose')
    } else setHint(t(r === 'invalid' ? 'start.invalid_login' : r === 'locked' ? 'start.locked' : 'start.need_online'))
  }
  const support = <Link href="/support" className="link-btn">{t('recovery.support')}</Link>

  if (stage === 'new' || stage === 'repeat') {
    return (
      <PinPad key={stage} title={t(stage === 'new' ? 'pin.new' : 'pin.repeat')} hint={hint} celebrate={stage === 'repeat'} onSuccess={open}
        onCancel={() => { setStage('choose'); setHint(null) }}
        onDone={async (pin) => {
          if (stage === 'new') {
            setFirst(pin)
            setHint(null)
            setStage('repeat')
            return true
          }
          if (pin !== first) {
            setHint(t('pin.mismatch'))
            setTimeout(() => setStage('new'), 700)
            return false
          }
          await setPin(pin)
          return true
        }} />
    )
  }

  if (stage === 'questions' || stage === 'choose') {
    return createPortal(
      <div className="pin-screen" role="dialog" aria-modal="true" aria-label={t('recovery.title')}>
        <div className="pin-head">
          <span className={`pin-lock${stage === 'choose' ? ' is-ok' : ''}`} aria-hidden="true">
            <Icon name="key" size={34} strokeWidth={1.4} className="pin-lock-shape" />
            <svg className="pin-tick" width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="17" /><path d="M12.5 20.5l5.2 5.2L28 15" /></svg>
          </span>
          <h1 className="pin-title">{t(stage === 'choose' ? 'recovery.passed' : 'recovery.title')}</h1>
        </div>
        {stage === 'questions' ? (
          <Questions onPassed={() => setStage('choose')} />
        ) : (
          <div className="recovery-choose stagger">
            <button type="button" className="btn btn-block btn-lg" onClick={() => { setHint(null); setStage('new') }}>
              <Icon name="key" size={18} /> {t('recovery.new_pin')}
            </button>
            <button type="button" className="btn btn-soft btn-block btn-lg" onClick={() => { clearPin(); open() }}>
              <Icon name="lock" size={18} /> {t('recovery.pin_off')}
            </button>
          </div>
        )}
        <div className="pin-foot recovery-foot">
          {stage === 'questions' ? <button type="button" className="link-btn" onClick={() => setStage('pin')}>{t('pin.cancel')}</button> : null}
          {stage === 'questions' ? support : null}
        </div>
      </div>,
      document.body
    )
  }

  return (
    <PinPad title={t('pin.enter')} hint={hint} celebrate onSuccess={open} onDone={async (pin) => {
      const r = await checkPin(pin)
      if (r === 'ok') {
        setHint(null)
        return true
      }
      setHint(r === 'wait' ? t('pin.wait').replace('{n}', String(waitLeft())) : t('pin.wrong'))
      return false
    }}>
      {asking ? (
        <form className="pin-password" onSubmit={submitPassword}>
          <input className="input" type="password" autoComplete="current-password" placeholder={t('settings.unlock_password')}
            aria-label={t('settings.unlock_password')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" disabled={!password}>{t('start.save')}</button>
        </form>
      ) : (
        <div className="recovery-foot">
          <button type="button" className="link-btn" onClick={forgot}>{t('pin.forgot')}</button>
          {hint === t('pin.reinstall') ? support : null}
        </div>
      )}
    </PinPad>
  )
}
