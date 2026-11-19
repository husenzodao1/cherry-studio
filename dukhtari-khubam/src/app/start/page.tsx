'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { formatCode } from '@/lib/progress'
import { ART } from '@/web/art'
import { Icon } from '@/web/components/Icon'
import { OtpField } from '@/web/components/OtpField'
import { CodeImageButton, saveCodeToGallery } from '@/web/components/Keepsakes'
import { isPassword, isUsername } from '@/web/offline/account'
import { endAccount, linkAccount } from '@/web/offline/accountAuth'
import { isEmail, normalizeEmail, sendEmailCode, verifyEmailCode } from '@/web/offline/email'
import { endGoogle, googlePhotoFile, linkGoogle, signInWithGoogle, type GoogleAccount } from '@/web/offline/google'
import { savePhoto } from '@/web/offline/photo'
import { useLearner, type Learner, type LoginResult } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import type { UiKey } from '@/web/i18n'

/**
 * First launch and sign-in.
 * Register: name, age and e-mail, confirmed with a 6-digit code sent to it → personal 15-digit code
 * (made on the phone); the picture of the code is saved to the gallery by itself. Without a connection
 * the profile is made at once and the e-mail is confirmed once online. Or with Google: the phone's account sheet, name and age filled
 * in from the account (both can be changed), and the Google account keeps the code.
 * Sign in: e-mail and its 6-digit code, Google, or the 15-digit code; older profiles also with login and
 * password; if all are lost, the support chat.
 * Learners registered earlier are asked once for what is missing (age, login), and a learner signed in
 * with a temporary password from support chooses her own.
 */

const RESULT: Partial<Record<LoginResult, UiKey>> = {
  invalid: 'start.invalid_login', locked: 'start.locked', taken: 'start.taken', offline: 'start.need_online', error: 'state.error'
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="stack" style={{ gap: 6, textAlign: 'start' }}>
      <span className="eyebrow" style={{ paddingInline: 8 }}>{label}</span>
      {children}
      {hint ? <span className="muted" style={{ paddingInline: 8, fontSize: '0.78em' }}>{hint}</span> : null}
    </label>
  )
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const { t } = usePrefs()
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input className="input" type={show ? 'text' : 'password'} value={value} maxLength={72} autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)} style={{ paddingInlineEnd: 52 }} />
      <button type="button" className="icon-btn" aria-label={t('start.show_password')} aria-pressed={show} onClick={() => setShow(!show)}
        style={{ position: 'absolute', insetInlineEnd: 4, top: 4, width: 44, height: 44, boxShadow: 'none', background: 'transparent', border: 0 }}>
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
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

function GoogleButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  const { t } = usePrefs()
  return (
    <button type="button" className="google-btn" onClick={onClick} disabled={busy}>
      <span className="google-g"><GoogleMark /></span>
      <span>{t(busy ? 'google.wait' : 'google.continue')}</span>
    </button>
  )
}

export default function StartPage() {
  const { t } = usePrefs()
  const router = useRouter()
  const { learner, progress, register, restore, backupNow, confirmEmail, setAge, setLogin, loginWithPassword, pendingLogin, loginProblem } = useLearner()
  const [email, setEmail] = useState('')
  // the 6-digit code step: what it is for, and when another code may be asked
  const [verify, setVerify] = useState<{ email: string; purpose: 'register' | 'login' | 'confirm' } | null>(null)
  const [otp, setOtp] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [google, setGoogle] = useState<GoogleAccount | null>(null)
  const [gBusy, setGBusy] = useState(false)
  const [gallery, setGallery] = useState<'saving' | 'saved' | 'failed' | null>(null)
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [by, setBy] = useState<'email' | 'code' | 'password'>('email')
  const [name, setName] = useState('')
  const [age, setAgeText] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [created, setCreated] = useState<Learner | null>(null)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ageNum = Number.parseInt(age, 10)
  const ageOk = Number.isInteger(ageNum) && ageNum >= 5 && ageNum <= 99
  const accountOk = isUsername(username) && isPassword(password)

  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  const needsAge = !!learner && progress.born === undefined
  const mustChange = !!learner?.mustChange
  // an e-mail given offline waits for its code; a learner with no way back in (no login, Google or
  // e-mail) is asked for her e-mail once online
  const needsAccount = !!learner && online && (!!learner.emailPending || (!learner.username && !learner.google && !learner.email && !pendingLogin))
  // already set up on this phone
  useEffect(() => {
    if (learner && !needsAge && !mustChange && !needsAccount && !created) router.replace('/')
  }, [learner, needsAge, mustChange, needsAccount, created, router])
  useEffect(() => {
    if (learner?.username) setUsername(learner.username)
  }, [learner?.username])
  useEffect(() => {
    if (learner?.emailPending) setEmail(learner.emailPending)
  }, [learner?.emailPending])
  useEffect(() => {
    if (!verify) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [verify])

  const say = (r: LoginResult) => setMessage(RESULT[r] ? t(RESULT[r]!) : null)

  // the popup of Google's account chooser (website) comes back to this page: the sign-in library
  // finishes it as soon as it is loaded
  useEffect(() => {
    if (/[#&](id_token|access_token|error)=/.test(window.location.hash) || window.opener) import('@capgo/capacitor-social-login').catch(() => undefined)
  }, [])

  // registered without Google: the picture of the code goes to the gallery by itself
  useEffect(() => {
    if (!created || created.google || gallery) return
    setGallery('saving')
    saveCodeToGallery(created, t).then((ok) => setGallery(ok ? 'saved' : 'failed'))
  }, [created, gallery, t])

  const onGoogle = async () => {
    setMessage(null)
    setGBusy(true)
    const r = await signInWithGoogle()
    if (typeof r === 'string') {
      setGBusy(false)
      if (r !== 'cancelled') setMessage(t(r === 'offline' ? 'start.need_online' : r === 'not_configured' ? 'google.not_configured' : 'google.failed'))
      return
    }
    if (r.profile) {
      // this Google account already keeps a profile: bring it back
      const ok = await restore(r.profile.code, { google: r.email ?? 'google' })
      await endGoogle()
      setGBusy(false)
      if (ok === 'ok') router.replace('/')
      else setMessage(t(ok === 'offline' ? 'start.need_online' : 'google.failed'))
      return
    }
    setGBusy(false)
    setGoogle(r)
    setName(r.name)
    setAgeText(r.age ? String(r.age) : '')
  }
  const onGoogleFinish = async (e: FormEvent) => {
    e.preventDefault()
    if (!google || !name.trim() || !ageOk) return
    setBusy(true)
    setMessage(null)
    const l = register(name, ageNum, { google: google.email ?? 'google' })
    await backupNow()
    const linked = await linkGoogle(l.code)
    const photo = await googlePhotoFile(google.photo)
    if (photo) await savePhoto(photo)
    setBusy(false)
    if (!linked) {
      setMessage(t('google.link_later'))
      setCreated(l)
      return
    }
    router.replace('/')
  }

  /** Sends the 6-digit code and opens the code step. */
  const askCode = async (address: string, purpose: 'register' | 'login' | 'confirm'): Promise<boolean> => {
    const r = await sendEmailCode(address)
    if (r === 'sent') {
      setVerify({ email: normalizeEmail(address), purpose })
      setOtp('')
      setResendAt(Date.now() + 60_000)
      setNow(Date.now())
      setMessage(null)
      return true
    }
    setMessage(t(r === 'wait' ? 'email.wait' : r === 'invalid' ? 'email.invalid' : r === 'offline' ? 'start.need_online' : 'email.send_failed'))
    return false
  }
  const onRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !ageOk || !isEmail(email)) return
    setBusy(true)
    setMessage(null)
    if (!online) {
      // no connection: the profile is made now, the e-mail is confirmed with its code once online
      const l = register(name, ageNum, { emailPending: normalizeEmail(email) })
      setCreated(l)
      setMessage(t('email.later_offline'))
    } else await askCode(email, 'register')
    setBusy(false)
  }
  const onVerify = async (e: FormEvent) => {
    e.preventDefault()
    if (!verify || otp.length !== 6) return
    setBusy(true)
    setMessage(null)
    const r = await verifyEmailCode(verify.email, otp)
    if (typeof r === 'string') {
      setBusy(false)
      setMessage(t(r === 'wrong' ? 'email.wrong_code' : r === 'offline' ? 'start.need_online' : 'state.error'))
      return
    }
    const account = { email: verify.email }
    if (verify.purpose === 'confirm' && learner) {
      if (r.profile && r.profile.code !== learner.code) {
        await endAccount()
        setBusy(false)
        setMessage(t('email.taken'))
        return
      }
      await backupNow()
      const linked = await linkAccount(learner.code)
      setBusy(false)
      if (!linked) return setMessage(t('state.error'))
      confirmEmail(verify.email)
      router.replace('/')
      return
    }
    if (r.profile) {
      // this address already keeps a profile: bring it back
      const ok = await restore(r.profile.code, account)
      await endAccount()
      setBusy(false)
      if (ok === 'ok') router.replace('/')
      else setMessage(t(ok === 'offline' ? 'start.need_online' : 'state.error'))
      return
    }
    if (verify.purpose === 'login') {
      await endAccount()
      setBusy(false)
      setMessage(t('email.no_profile'))
      return
    }
    const l = register(name, ageNum, account)
    await backupNow()
    const linked = await linkAccount(l.code)
    setBusy(false)
    setVerify(null)
    setCreated(l)
    if (!linked) setMessage(t('google.link_later'))
  }
  const onCode = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const r = await restore(code)
    setBusy(false)
    if (r === 'ok') router.replace('/')
    else setMessage(r === 'offline' ? t('start.need_online') : t('start.not_found'))
  }
  const onPassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const r = await loginWithPassword(username, password)
    setBusy(false)
    if (r === 'ok') setPassword('')
    else say(r)
  }
  const onAccount = async (e: FormEvent) => {
    e.preventDefault()
    if (!accountOk) return
    setBusy(true)
    setMessage(null)
    const r = await setLogin(username, password)
    setBusy(false)
    if (r === 'ok') router.replace('/')
    else say(r)
  }
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const note = message ? <p role="status" className="muted" style={{ margin: 0, textAlign: 'center' }}>{message}</p> : null
  const flower = <img className="start-art bloom-in" style={{ width: 'min(52vw, 210px)' }} src={ART.flower.src} alt="" aria-hidden="true" />
  const ageField = (
    <Field label={t('start.age')}>
      <input className="input" inputMode="numeric" autoComplete="off" value={age} maxLength={2}
        onChange={(e) => setAgeText(e.target.value.replace(/\D/g, '').slice(0, 2))} style={{ fontVariantNumeric: 'tabular-nums' }} />
    </Field>
  )
  const accountFields = (newPassword = false) => (
    <>
      <Field label={t('start.username')} hint={t('start.username_hint')}>
        <input className="input" value={username} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false}
          readOnly={newPassword} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} />
      </Field>
      <Field label={t(newPassword ? 'start.new_password' : 'start.password')} hint={t('start.password_hint')}>
        <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
    </>
  )
  const codeCard = (value: string, title: UiKey) => (
    <div className="glass card-pad stack" style={{ width: '100%', maxWidth: 420, alignItems: 'center' }}>
      <h1 className="h-page">{t(title)}</h1>
      <div className="glass card-pad" style={{ width: '100%', background: 'var(--glass-flat)' }}>
        <div className="code-box" aria-label={value.split('').join(' ')}>{formatCode(value)}</div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: '0.9em' }}>{t('start.keep_code')}</p>
      <CodeImageButton />
      <button type="button" className="btn btn-soft btn-block" onClick={() => copy(value)}><Icon name={copied ? 'check' : 'copy'} size={18} /> {t('start.copy')}</button>
    </div>
  )

  const emailField = (
    <Field label={t('email.label')}>
      <input className="input" type="email" inputMode="email" value={email} maxLength={120} autoComplete="email" autoCapitalize="none" spellCheck={false}
        onChange={(e) => setEmail(e.target.value.replace(/\s/g, ''))} />
    </Field>
  )

  if (verify) {
    const left = Math.max(0, Math.ceil((resendAt - now) / 1000))
    return (
      <div className="start">
        {flower}
        <form className="glass google-card stack otp-card" onSubmit={onVerify}>
          <div style={{ textAlign: 'center' }}>
            <h1 className="h-page">{t('email.code_title')}</h1>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.9em' }}>{t('email.code_sent').replace('{email}', verify.email)}</p>
          </div>
          <OtpField value={otp} onChange={setOtp} label={t('email.code_title')} />
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || otp.length !== 6}>{t('email.confirm')} <Icon name="check" size={18} /></button>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="link-btn" onClick={() => { setVerify(null); setMessage(null) }}>{t('action.back')}</button>
            <button type="button" className="link-btn" disabled={left > 0 || busy} onClick={() => askCode(verify.email, verify.purpose)}>
              {left > 0 ? t('email.resend_in').replace('{n}', String(left)) : t('email.resend')}
            </button>
          </div>
        </form>
      </div>
    )
  }

  if (created) {
    return (
      <div className="start">
        {flower}
        <span className="greet" style={{ margin: 0 }}>{created.name}</span>
        {codeCard(created.code, 'start.your_code')}
        {gallery === 'saved' || gallery === 'saving' ? (
          <p className="gallery-note" role="status"><Icon name={gallery === 'saved' ? 'check' : 'down'} size={16} /> {t(gallery === 'saved' ? 'code.saved_gallery' : 'cert.saving')}</p>
        ) : null}
        {note}
        <button type="button" className="btn btn-block btn-lg" style={{ maxWidth: 420 }} onClick={() => router.replace('/')}>{t('start.saved_it')} <Icon name="arrow" size={18} /></button>
      </div>
    )
  }

  if (needsAge) {
    return (
      <div className="start">
        {flower}
        <h1 className="h-page">{learner?.name}</h1>
        <form className="stack" style={{ width: '100%', maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); if (ageOk) setAge(ageNum) }}>
          {ageField}
          <button className="btn btn-block btn-lg" disabled={!ageOk}>{t('start.create')} <Icon name="arrow" size={18} /></button>
        </form>
      </div>
    )
  }

  if (mustChange && learner) {
    // signed in with a temporary password from support: the code may be new, and a new password is due
    return (
      <div className="start">
        {codeCard(learner.code, 'start.new_code')}
        <form className="stack" style={{ width: '100%', maxWidth: 420 }} onSubmit={onAccount}>
          {accountFields(true)}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !accountOk}>{t('start.save')} <Icon name="check" size={18} /></button>
        </form>
      </div>
    )
  }

  if (needsAccount && learner) {
    return (
      <div className="start">
        {flower}
        <div>
          <h1 className="h-page">{t('email.confirm_title')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{loginProblem && RESULT[loginProblem] ? t(RESULT[loginProblem]!) : t('email.confirm_hint')}</p>
        </div>
        <form className="stack" style={{ width: '100%', maxWidth: 420 }} onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          await askCode(email, 'confirm')
          setBusy(false)
        }}>
          {emailField}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !isEmail(email)}>{t('email.send_code')} <Icon name="arrow" size={18} /></button>
        </form>
      </div>
    )
  }

  if (google) {
    return (
      <div className="start">
        <form className="glass google-card stack" onSubmit={onGoogleFinish}>
          <div className="google-who">
            {google.photo ? <img src={google.photo} alt="" referrerPolicy="no-referrer" /> : <span className="google-g"><GoogleMark /></span>}
            <span style={{ minWidth: 0 }}>
              <b>{t('google.signed_in')}</b>
              {google.email ? <span className="row-sub">{google.email}</span> : null}
            </span>
          </div>
          <Field label={t('start.name')}>
            <input className="input" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </Field>
          {ageField}
          {google.age ? null : <span className="muted" style={{ fontSize: '0.8em', paddingInline: 8, textAlign: 'start' }}>{t('google.age_hint')}</span>}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !name.trim() || !ageOk}>{t('google.finish')} <Icon name="check" size={18} /></button>
          <button type="button" className="link-btn" onClick={() => { setGoogle(null); endGoogle() }}>{t('pin.cancel')}</button>
          <Agree />
        </form>
      </div>
    )
  }

  return (
    <div className="start">
      <img className="start-art bloom-in" src={ART.flower.src} alt="" aria-hidden="true" />
      <div>
        <h1 className="brand-wrap"><span className="brand">{t('app.name')}</span></h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>{t('start.subtitle')}</p>
      </div>
      <div className="segmented" role="tablist" style={{ width: '100%', maxWidth: 420 }}>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMessage(null) }}>{t('start.register')}</button>
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMessage(null) }}>{t('start.login')}</button>
      </div>
      <div className="google-box">
        <GoogleButton onClick={onGoogle} busy={gBusy} />
        <span className="or-line">{t('google.or')}</span>
      </div>
      {mode === 'register' ? (
        <form onSubmit={onRegister} className="stack" style={{ width: '100%', maxWidth: 420 }} key="r">
          <Field label={t('start.name')}>
            <input className="input" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </Field>
          {ageField}
          {emailField}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !name.trim() || !ageOk || !isEmail(email)}>{t('start.create')} <Icon name="arrow" size={18} /></button>
        </form>
      ) : by === 'email' ? (
        <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); await askCode(email, 'login'); setBusy(false) }}
          className="stack" style={{ width: '100%', maxWidth: 420 }} key="e">
          {emailField}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !isEmail(email)}>{t('email.send_code')} <Icon name="arrow" size={18} /></button>
          <button type="button" className="link-btn" onClick={() => { setBy('code'); setMessage(null) }}>{t('email.by_code')}</button>
        </form>
      ) : by === 'code' ? (
        <form onSubmit={onCode} className="stack" style={{ width: '100%', maxWidth: 420 }} key="c">
          <Field label={t('start.enter_code')}>
            <input className="input" inputMode="numeric" autoComplete="off" value={formatCode(code)} maxLength={17}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 15))}
              style={{ fontSize: '1.25em', letterSpacing: '0.08em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
          </Field>
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || code.length !== 15}>{t('start.restore')} <Icon name="check" size={18} /></button>
          <button type="button" className="link-btn" onClick={() => { setBy('email'); setMessage(null) }}>{t('email.by_email')}</button>
          <button type="button" className="link-btn" onClick={() => { setBy('password'); setMessage(null) }}>{t('start.forgot_code')}</button>
        </form>
      ) : (
        <form onSubmit={onPassword} className="stack" style={{ width: '100%', maxWidth: 420 }} key="p">
          <Field label={t('start.username')}>
            <input className="input" value={username} maxLength={32} autoComplete="username" autoCapitalize="none" spellCheck={false}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} />
          </Field>
          <Field label={t('start.password')}>
            <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
          </Field>
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !username || !password}>{t('start.restore')} <Icon name="check" size={18} /></button>
          <button type="button" className="link-btn" onClick={() => { setBy('code'); setMessage(null) }}>{t('start.by_code')}</button>
          <Link href="/support" className="link-btn">{t('start.forgot_all')}</Link>
        </form>
      )}
      <Agree />
    </div>
  )
}
