'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { playIntro } from '../intro'
import { useLearner } from '../offline/learner'
import { checkPin, clearPin, hasPin, setPin, waitLeft } from '../offline/pin'
import { checkAnswer, hasRecovery, recoveryQuestions, recoveryWait } from '../offline/recovery'
import { endAccount } from '../offline/accountAuth'
import { sendEmailCode, verifyEmailCode } from '../offline/email'
import { checkPassword, unlockWithPhone } from '../offline/unlock'
import { usePrefs } from '../prefs'
import type { UiKey } from '../i18n'
import { Icon } from './Icon'
import { onBack } from './BackButton'
import { Dots } from './Busy'
import { OtpField, type OtpState } from './OtpField'
import { buzz, PinPad } from './PinPad'

const AWAY_MS = 60_000

type Stage = 'pin' | 'email' | 'questions' | 'choose' | 'new' | 'repeat'

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

/** Forgot PIN: a 6-digit code is sent to her e-mail; the right code opens the choices. */
function EmailCode({ email, onPassed, onCancel }: { email: string; onPassed: () => void; onCancel: () => void }) {
  const { t } = usePrefs()
  const [otp, setOtp] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<OtpState>('idle')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const send = async () => {
    setNote(null)
    const r = await sendEmailCode(email)
    if (r === 'sent') setResendAt(Date.now() + 30_000)
    else setNote(t(r === 'wait' ? 'email.wait' : r === 'offline' ? 'start.need_online' : 'email.send_failed'))
  }
  useEffect(() => {
    send()
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (otp.length !== 6 || busy || state !== 'idle') return
    ;(async () => {
      setBusy(true)
      const r = await verifyEmailCode(email, otp)
      await endAccount()
      setBusy(false)
      if (typeof r === 'string') {
        setNote(t(r === 'wrong' ? 'email.wrong_code' : r === 'offline' ? 'start.need_online' : 'state.error'))
        buzz([24, 50, 24])
        setState('bad')
        setTimeout(() => { setState('idle'); setOtp('') }, 650)
      } else {
        buzz(12)
        setState('ok')
        setTimeout(onPassed, 750)
      }
    })()
  }, [otp]) // eslint-disable-line react-hooks/exhaustive-deps
  const left = Math.max(0, Math.ceil((resendAt - now) / 1000))
  return (
    <div className="recovery">
      <span className="eyebrow">{t('email.code_title')}</span>
      <OtpField value={otp} onChange={setOtp} state={state} label={t('email.code_title')} />
      {busy ? <p className="muted" style={{ margin: 0 }} aria-hidden="true"><Dots /></p> : null}
      <p className="muted" style={{ margin: 0, fontSize: '0.82em' }}>{t('email.code_sent').replace('{email}', email)}</p>
      <p className="pin-hint" role="status">{note ?? ' '}</p>
      <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
        <button type="button" className="link-btn" onClick={onCancel}>{t('pin.cancel')}</button>
        <button type="button" className="link-btn" disabled={left > 0} onClick={send}>
          {left > 0 ? t('email.resend_in').replace('{n}', String(left)) : t('email.resend')}
        </button>
      </div>
    </div>
  )
}

/**
 * With a PIN set, the app opens behind the PIN pad, and again when it comes back after more than a
 * minute away. Until the PIN is right nothing of the app is drawn (the boot script in layout.tsx marks
 * <html> as locked before the first paint). "Forgot PIN" sends a 6-digit code to her e-mail; the right
 * code offers to turn the PIN off or to set a new one. Without an e-mail it asks the three life questions
 * chosen with the PIN, or the phone's own lock, or the login password.
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
  // wrong PINs in a row: after five, a clear "forgot your PIN?" with the reset by e-mail
  const [wrongs, setWrongs] = useState(0)
  const onSupport = /^\/support(\/|$)/.test(path)

  // before the first paint, so nothing behind the lock flashes
  useLayoutEffect(() => {
    // without a PIN the opening screen (Splash.tsx) plays the entrance when it goes
    if (hasPin()) setLocked(true)
    else document.documentElement.classList.remove('locked')
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

  // the phone's back button steps back inside the recovery screens (on the PIN pad it leaves the app)
  useEffect(() => (locked && stage !== 'pin' ? onBack(() => { setHint(null); setStage(stage === 'repeat' ? 'new' : stage === 'new' ? 'choose' : 'pin') }) : undefined), [locked, stage])

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
  /**
   * Forgot PIN: first the phone's own lock (fingerprint, face or the screen code) proves it is her phone,
   * then the 6-digit code sent to her e-mail opens the reset. Without an e-mail: her life questions; with
   * neither, the phone's lock alone (or the login password).
   */
  const forgot = async () => {
    setHint(null)
    const r = await unlockWithPhone(t('pin.phone_title'), t('pin.phone_reason'))
    if (r === 'cancelled') return setHint(t('pin.phone_needed'))
    if (learner?.email) return setStage('email')
    if (hasRecovery()) return setStage('questions')
    if (r === 'ok') return setStage('choose')
    if (learner?.username) setAsking(true)
    else setHint(t('pin.reinstall'))
  }
  /** "Forgot it?": the life questions first when she chose them; otherwise straight to the e-mail way. */
  const forgotAsk = () => {
    setHint(null)
    if (hasRecovery()) return setStage('questions')
    return forgot()
  }
  const submitPassword = async (e: FormEvent) => {
    e.preventDefault()
    const r = await checkPassword(learner!.username!, password)
    if (r === 'ok') {
      setAsking(false)
      setStage('choose')
    } else setHint(t(r === 'invalid' ? 'start.invalid_login' : r === 'locked' ? 'start.locked' : 'start.need_online'))
  }

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

  if (stage === 'questions' || stage === 'choose' || stage === 'email') {
    return createPortal(
      <div className="pin-screen" role="dialog" aria-modal="true" aria-label={t('recovery.title')}>
        <div className="pin-head">
          <span className={`pin-lock${stage === 'choose' ? ' is-ok' : ''}`} aria-hidden="true">
            <Icon name="key" size={34} strokeWidth={1.4} className="pin-lock-shape" />
            <svg className="pin-tick" width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="17" /><path d="M12.5 20.5l5.2 5.2L28 15" /></svg>
          </span>
          <h1 className="pin-title">{t(stage === 'choose' ? 'recovery.passed' : stage === 'email' ? 'pin.by_email_title' : 'recovery.title')}</h1>
        </div>
        {stage === 'email' && learner?.email ? (
          <EmailCode email={learner.email} onPassed={() => setStage('choose')} onCancel={() => setStage('pin')} />
        ) : stage === 'questions' ? (
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
          {/* the other way, small, below the questions: a code sent to her e-mail */}
          {stage === 'questions' && learner?.email ? <button type="button" className="link-btn pin-small" onClick={forgot}>{t('pin.by_email')}</button> : null}
        </div>
      </div>,
      document.body
    )
  }

  return (
    <PinPad title={t('pin.enter')} hint={hint} celebrate onSuccess={open} extra={{ label: t('pin.forgot_q'), onClick: forgotAsk }} onDone={async (pin) => {
      const r = await checkPin(pin)
      if (r === 'ok') {
        setHint(null)
        setWrongs(0)
        return true
      }
      setWrongs((n) => n + 1)
      setHint(r === 'wait' ? t('pin.wait').replace('{n}', String(waitLeft())) : t('pin.wrong'))
      return false
    }}>
      {asking ? (
        <form className="pin-password" onSubmit={submitPassword}>
          <input className="input" type="password" autoComplete="current-password" placeholder={t('settings.unlock_password')}
            aria-label={t('settings.unlock_password')} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className="btn" disabled={!password}>{t('start.save')}</button>
        </form>
      ) : wrongs >= 5 ? (
        <div className="pin-forgot-card glass" role="alert">
          <b>{t('pin.too_many')}</b>
          <span className="row-sub">{t('pin.too_many_sub')}</span>
          <button type="button" className="btn btn-block" onClick={forgotAsk}>{t('pin.reset')}</button>
        </div>
      ) : null}
    </PinPad>
  )
}
