'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { birthdayMask, parseBirthday } from '@/lib/progress'
import { isMeaningful, MAX_AGE, MIN_AGE } from '@/lib/sanity'
import { ART } from '@/web/art'
import { Dots, GoIcon } from '@/web/components/Busy'
import { OtpField, type OtpState } from '@/web/components/OtpField'
import { buzz } from '@/web/components/PinPad'
import { StartLanguage, StartScene } from '@/web/components/StartScene'
import { endAccount, linkAccount, type AccountProfile } from '@/web/offline/accountAuth'
import { isEmail, normalizeEmail, sendEmailCode, verifyEmailCode } from '@/web/offline/email'
import { endGoogle, googlePhotoFile, lastGoogleStep, linkGoogle, signInWithGoogle, warmGoogle, type GoogleAccount } from '@/web/offline/google'
import { savePhoto } from '@/web/offline/photo'
import { useLearner, type AccountLink } from '@/web/offline/learner'
import { Icon } from '@/web/components/Icon'
import { usePrefs, type Mode } from '@/web/prefs'

/**
 * First launch and sign-in, one screen: Google, or her e-mail and the 6-digit code sent to it.
 * An address or Google account that already keeps a profile brings it back at once (the profile comes
 * whole with the sign-in); a new one is asked her name and birthday, and the profile is made.
 * Learners registered before birthdays were asked are asked for theirs once; one with no way back in
 * (no e-mail or Google) is asked for her e-mail once online.
 */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="stack" style={{ gap: 6, textAlign: 'start' }}>
      <span className="eyebrow" style={{ paddingInline: 8 }}>{label}</span>
      {children}
      {hint ? <span className="muted" style={{ paddingInline: 8, fontSize: '0.78em' }}>{hint}</span> : null}
    </label>
  )
}

/** "By continuing you agree to the [terms] and the [privacy policy]": the bracketed words become links. */
function Agree() {
  const { t } = usePrefs()
  const parts = t('start.agree').split(/\[([^\]]+)\]/)
  const links = ['/page?slug=terms', '/page?slug=privacy']
  let n = 0
  return (
    <p className="agree">
      {parts.map((p, i) => (i % 2 ? <Link key={i} href={links[n++] ?? '/page?slug=terms'}>{p}</Link> : <span key={i}>{p}</span>))}
    </p>
  )
}

/** Google's "G", in its own colours (Sign in with Google button guidelines). */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.6 7l7.4 5.8c4.3-4 6.9-9.9 6.9-17.3z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/** dd.mm.yyyy with the number keyboard; the dots come by themselves. */
function BirthdayField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = usePrefs()
  const wrong = value.length === 10 && !parseBirthday(value)
  // a real date with an age no learner can have (this year, a small child, over forty)
  const realDate = wrong && /^\d{2}\.\d{2}\.\d{4}$/.test(value) && (() => {
    const [d, m, y] = value.split('.').map(Number)
    const date = new Date(y, m - 1, d)
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  })()
  return (
    <Field label={t('start.birthday')} hint={wrong ? (realDate ? t('start.birthday_age').replace('{min}', String(MIN_AGE)).replace('{max}', String(MAX_AGE)) : t('start.birthday_wrong')) : undefined}>
      <input className="input birthday-input" inputMode="numeric" pattern="[0-9.]*" autoComplete="bday" placeholder={t('start.birthday_ph')}
        value={value} maxLength={10} aria-invalid={wrong} onChange={(e) => onChange(birthdayMask(e.target.value))} />
    </Field>
  )
}

/** The code step: typing the sixth digit checks it, no button press needed. */
function CodeStep({ email, onBack, onResend, onVerified }: {
  email: string; onBack: () => void; onResend: () => Promise<boolean>
  onVerified: (profile: AccountProfile | null) => Promise<string | null>
}) {
  const { t } = usePrefs()
  const [otp, setOtp] = useState('')
  const [state, setState] = useState<OtpState>('idle')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [resendAt, setResendAt] = useState(() => Date.now() + 60_000)
  const [now, setNow] = useState(() => Date.now())
  const checking = useRef(false)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const check = async (code: string) => {
    if (checking.current || code.length !== 6) return
    checking.current = true
    setBusy(true)
    setNote(null)
    const r = await verifyEmailCode(email, code)
    if (typeof r === 'string') {
      setBusy(false)
      setState('bad')
      buzz([24, 50, 24])
      setNote(t(r === 'wrong' ? 'email.wrong_code' : r === 'offline' ? 'start.need_online' : 'state.error'))
      setTimeout(() => { setState('idle'); setOtp(''); checking.current = false }, 650)
      return
    }
    setState('ok')
    buzz(12)
    // the boxes hop and the button turns into a tick, then the next screen opens
    await new Promise((res) => setTimeout(res, 750))
    const problem = await onVerified(r.profile)
    setBusy(false)
    checking.current = false
    if (problem) {
      setState('idle')
      setOtp('')
      setNote(problem)
    }
  }
  const left = Math.max(0, Math.ceil((resendAt - now) / 1000))
  const done = state === 'ok'
  return (
    <form className="glass google-card stack otp-card" onSubmit={(e) => { e.preventDefault(); check(otp) }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="h-page">{t('email.code_title')}</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.9em' }}>{t('email.code_sent').replace('{email}', email)}</p>
      </div>
      <OtpField value={otp} state={state} label={t('email.code_title')} onChange={(v) => { setOtp(v); if (v.length === 6) check(v) }} />
      <p role="status" className="muted start-note">{note ?? ' '}</p>
      <button className={`btn btn-block btn-lg${done ? ' is-done' : ''}`} disabled={(otp.length !== 6 && !done) || (busy && !done)} aria-busy={busy && !done}>
        <span className="btn-label">{t('email.confirm')}{busy ? <Dots /> : null}</span>
        {done ? <svg className="done-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.6 4.6L19 7.6" /></svg> : null}
      </button>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button type="button" className="link-btn" onClick={onBack}>{t('action.back')}</button>
        <button type="button" className="link-btn" disabled={left > 0 || busy}
          onClick={async () => { if (await onResend()) setResendAt(Date.now() + 60_000) }}>
          {left > 0 ? t('email.resend_in').replace('{n}', String(left)) : t('email.resend')}
        </button>
      </div>
    </form>
  )
}

/**
 * The very first question: a boy or a girl. Two bright cards with their picture; the choice sets the app's
 * schools, look and words at once (changed later in the settings).
 */
function GenderPick({ onPick }: { onPick: (m: Mode) => void }) {
  const { t } = usePrefs()
  return (
    <div className="start gender-start">
      <StartLanguage />
      <div className="gender-head">
        <h1 className="h-page">{t('gender.title')}</h1>
        <p className="muted">{t('gender.hint')}</p>
      </div>
      <div className="gender-cards">
        {(['boy', 'girl'] as const).map((m) => (
          <button key={m} type="button" className={`gender-card is-${m}`} onClick={() => onPick(m)}>
            <img src={`/assets/mascot/pick-${m}.webp`} alt="" aria-hidden="true" />
            <span className="gender-label"><Icon name={m === 'boy' ? 'male' : 'female'} size={18} />{t(m === 'boy' ? 'gender.boy' : 'gender.girl')}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

type Step =
  | { at: 'start' }
  | { at: 'code'; email: string; purpose: 'sign_in' | 'confirm' }
  | { at: 'about'; account: AccountLink; google?: GoogleAccount }

export default function StartPage() {
  const { t, mode, set: setPrefs } = usePrefs()
  const router = useRouter()
  const { learner, progress, register, adopt, backupNow, confirmEmail, setBirthday, pendingLogin } = useLearner()
  const [step, setStep] = useState<Step>({ at: 'start' })
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [birthday, setBirthdayText] = useState('')
  const [gBusy, setGBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const born = parseBirthday(birthday)
  // a name made of real letters (not "аааа" or a keyboard row)
  const nameOk = name.trim().length >= 2 && isMeaningful(name)

  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  const needsBirthday = !!learner && progress.born === undefined
  // an e-mail given offline waits for its code; a learner with no way back in (no login, Google or
  // e-mail) is asked for her e-mail once online
  const needsAccount = !!learner && online && (!!learner.emailPending || (!learner.username && !learner.google && !learner.email && !pendingLogin))
  // already set up on this phone
  useEffect(() => {
    if (learner && !needsBirthday && !needsAccount && step.at !== 'about') router.replace('/')
  }, [learner, needsBirthday, needsAccount, step.at, router])
  useEffect(() => {
    if (learner?.emailPending) setEmail(learner.emailPending)
  }, [learner?.emailPending])
  // Google's sign-in is loaded while she looks at the screen, so the button opens the sheet at once
  useEffect(() => warmGoogle(), [])

  // the popup of Google's account chooser (website) comes back to this page: the sign-in library
  // finishes it as soon as it is loaded
  useEffect(() => {
    if (/[#&](id_token|access_token|error)=/.test(window.location.hash) || window.opener) import('@capgo/capacitor-social-login').catch(() => undefined)
  }, [])

  /** A profile the account already keeps: taken over on the phone, home at once. */
  const welcomeBack = (profile: AccountProfile, account: AccountLink) => {
    adopt(profile, account)
    router.replace('/')
  }

  const onGoogle = async () => {
    setMessage(null)
    setGBusy(true)
    const r = await signInWithGoogle()
    if (typeof r === 'string') {
      setGBusy(false)
      if (r !== 'cancelled') setMessage(`${t(r === 'offline' ? 'start.need_online' : r === 'not_configured' ? 'google.not_configured' : 'google.failed')}${r === 'error' && lastGoogleStep ? ` (${lastGoogleStep})` : ''}`)
      return
    }
    if (r.profile) {
      endGoogle()
      return welcomeBack(r.profile, { google: r.email ?? 'google' })
    }
    setGBusy(false)
    setName(r.name)
    setBirthdayText(r.birthday ?? '')
    setStep({ at: 'about', account: { google: r.email ?? 'google' }, google: r })
  }

  /** Sends the 6-digit code and opens the code step. */
  const askCode = async (address: string, purpose: 'sign_in' | 'confirm'): Promise<boolean> => {
    const r = await sendEmailCode(address)
    if (r === 'sent') {
      setStep({ at: 'code', email: normalizeEmail(address), purpose })
      setMessage(null)
      return true
    }
    setMessage(t(r === 'wait' ? 'email.wait' : r === 'invalid' ? 'email.invalid' : r === 'offline' ? 'start.need_online' : 'email.send_failed'))
    return false
  }
  const onEmail = async (e: FormEvent) => {
    e.preventDefault()
    if (!isEmail(email) || busy) return
    setMessage(null)
    if (!online) {
      // no connection: the profile is made now, the e-mail is confirmed with its code once online
      setStep({ at: 'about', account: { emailPending: normalizeEmail(email) } })
      return
    }
    setBusy(true)
    await askCode(email, 'sign_in')
    setBusy(false)
  }

  /** After the right code: brings her profile back, or asks her name and birthday for a new one. */
  const onVerified = (address: string, purpose: 'sign_in' | 'confirm') => async (profile: AccountProfile | null): Promise<string | null> => {
    const account = { email: address }
    if (purpose === 'confirm' && learner) {
      if (profile && profile.code !== learner.code) {
        await endAccount()
        return t('email.taken')
      }
      await backupNow()
      if (!(await linkAccount(learner.code))) return t('state.error')
      confirmEmail(address)
      router.replace('/')
      return null
    }
    if (profile) {
      endAccount()
      welcomeBack(profile, account)
      return null
    }
    setStep({ at: 'about', account })
    return null
  }

  const onAbout = async (e: FormEvent) => {
    e.preventDefault()
    if (step.at !== 'about' || !nameOk || !born || busy) return
    setBusy(true)
    setMessage(null)
    const l = register(name, born, step.account)
    if (step.account.emailPending) return router.replace('/')
    await backupNow()
    const linked = step.google ? await linkGoogle(l.code) : await linkAccount(l.code)
    if (step.google) {
      const photo = await googlePhotoFile(step.google.photo)
      if (photo) await savePhoto(photo)
    }
    if (!linked) setMessage(t('google.link_later'))
    router.replace('/')
  }

  const note = <p role="status" className="muted start-note">{message ?? ' '}</p>
  // each step has its own small picture, never the same one everywhere
  const art = (a: { src: string }) => <img className="start-art bloom-in" style={{ width: 'min(42vw, 170px)' }} src={a.src} alt="" aria-hidden="true" />
  const emailField = (
    <Field label={t('email.label')}>
      <input className="input" type="email" inputMode="email" value={email} maxLength={120} autoComplete="email" autoCapitalize="none" spellCheck={false}
        placeholder="name@gmail.com" onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))} />
    </Field>
  )

  // a new phone: first, a boy or a girl
  if (!learner && !mode) return <GenderPick onPick={(m) => setPrefs({ mode: m })} />

  if (step.at === 'code') {
    return (
      <div className="start">
        {art(ART.lotus)}
        <CodeStep key={step.email} email={step.email} onBack={() => { setStep({ at: 'start' }); setMessage(null) }}
          onResend={() => askCode(step.email, step.purpose)} onVerified={onVerified(step.email, step.purpose)} />
      </div>
    )
  }

  if (step.at === 'about') {
    const g = step.google
    return (
      <div className="start">
        {g ? null : art(ART.tulip)}
        <form className="glass google-card stack" onSubmit={onAbout}>
          {g ? (
            <div className="google-who">
              {g.photo ? <img src={g.photo} alt="" referrerPolicy="no-referrer" /> : <span className="google-g"><GoogleMark /></span>}
              <span style={{ minWidth: 0 }}>
                <b>{t('google.signed_in')}</b>
                {g.email ? <span className="row-sub">{g.email}</span> : null}
              </span>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <h1 className="h-page">{t('start.about_title')}</h1>
              <p className="muted" style={{ margin: '4px 0 0', fontSize: '0.9em' }}>{t('start.about_hint')}</p>
            </div>
          )}
          <Field label={t('start.name')} hint={name.trim().length >= 2 && !nameOk ? t('start.name_wrong') : undefined}>
            <input className="input" value={name} maxLength={80} autoComplete="given-name" autoFocus={!g} onChange={(e) => setName(e.target.value)} />
          </Field>
          <BirthdayField value={birthday} onChange={setBirthdayText} />
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !nameOk || !born} aria-busy={busy}>
            {t('start.create')} <GoIcon busy={busy} />
          </button>
          <button type="button" className="link-btn" onClick={() => { setStep({ at: 'start' }); setMessage(null); if (g) endGoogle(); else endAccount() }}>{t('pin.cancel')}</button>
          <Agree />
        </form>
      </div>
    )
  }

  if (needsBirthday && learner) {
    return (
      <div className="start">
        {art(ART.tulip)}
        <h1 className="h-page">{learner.name}</h1>
        <form className="stack" style={{ width: '100%', maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); if (born) setBirthday(born) }}>
          <BirthdayField value={birthday} onChange={setBirthdayText} />
          <button className="btn btn-block btn-lg" disabled={!born}>{t('start.create')} <GoIcon busy={false} /></button>
        </form>
      </div>
    )
  }

  if (needsAccount && learner) {
    return (
      <div className="start">
        {art(ART.book)}
        <div>
          <h1 className="h-page">{t('email.confirm_title')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{t('email.confirm_hint')}</p>
        </div>
        <form className="stack" style={{ width: '100%', maxWidth: 420 }} onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          await askCode(email, 'confirm')
          setBusy(false)
        }}>
          {emailField}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !isEmail(email)} aria-busy={busy}>{t('email.send_code')} <GoIcon busy={busy} /></button>
        </form>
      </div>
    )
  }

  return (
    <div className="start has-scene">
      <StartScene />
      <StartLanguage />
      <div className="start-title">
        <h1 className="brand-wrap"><span className="brand">{t('app.name')}</span></h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>{t('start.subtitle')}</p>
      </div>
      <div className="google-box">
        <button type="button" className="google-btn" onClick={onGoogle} disabled={gBusy} aria-busy={gBusy}>
          <span className="google-g"><GoogleMark /></span>
          <span>{gBusy ? <>{t('google.wait')}<Dots /></> : t('google.continue')}</span>
        </button>
        <span className="or-line">{t('google.or')}</span>
      </div>
      <form onSubmit={onEmail} className="stack" style={{ width: '100%', maxWidth: 420 }}>
        {emailField}
        {note}
        <button className="btn btn-block btn-lg" disabled={busy || !isEmail(email)} aria-busy={busy}>{t('start.create')} <GoIcon busy={busy} /></button>
      </form>
      <Agree />
    </div>
  )
}
