'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { formatCode } from '@/lib/progress'
import { ART } from '@/web/art'
import { Icon } from '@/web/components/Icon'
import { CodeImageButton } from '@/web/components/Keepsakes'
import { isPassword, isUsername } from '@/web/offline/account'
import { useLearner, type Learner, type LoginResult } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import type { UiKey } from '@/web/i18n'

/**
 * First launch and sign-in.
 * Register: name, age, login, password → personal 15-digit code (made on the phone).
 * Sign in: the code; if it is lost, login and password; if both are lost, the support chat.
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

export default function StartPage() {
  const { t } = usePrefs()
  const router = useRouter()
  const { learner, progress, register, restore, setAge, setLogin, loginWithPassword, checkUsername, queueLogin, pendingLogin, loginProblem } = useLearner()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [by, setBy] = useState<'code' | 'password'>('code')
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
  const needsAccount = !!learner && !learner.username && online && !pendingLogin
  // already set up on this phone
  useEffect(() => {
    if (learner && !needsAge && !mustChange && !needsAccount && !created) router.replace('/')
  }, [learner, needsAge, mustChange, needsAccount, created, router])
  useEffect(() => {
    if (learner?.username) setUsername(learner.username)
  }, [learner?.username])

  const say = (r: LoginResult) => setMessage(RESULT[r] ? t(RESULT[r]!) : null)

  const onRegister = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !ageOk || !accountOk) return
    setBusy(true)
    setMessage(null)
    // the login must be free; without a connection it is set later, the code works offline
    const free = await checkUsername(username)
    if (free === 'taken' || free === 'invalid') {
      setBusy(false)
      setMessage(t(free === 'taken' ? 'start.taken' : 'start.username_hint'))
      return
    }
    const l = register(name, ageNum)
    setCreated(l)
    if (free === 'free') {
      const r = await setLogin(username, password)
      if (r === 'offline' || r === 'error') queueLogin(username, password)
      else if (r !== 'ok') say(r)
    } else {
      // no connection: the login waits on the phone and is saved on its own once online
      queueLogin(username, password)
      setMessage(t('start.later_offline'))
    }
    setBusy(false)
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

  if (created) {
    return (
      <div className="start">
        {flower}
        <span className="greet" style={{ margin: 0 }}>{created.name}</span>
        {codeCard(created.code, 'start.your_code')}
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
          <h1 className="h-page">{t('start.account_title')}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>{loginProblem && RESULT[loginProblem] ? t(RESULT[loginProblem]!) : t('start.account_hint')}</p>
        </div>
        <form className="stack" style={{ width: '100%', maxWidth: 420 }} onSubmit={onAccount}>
          {accountFields()}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !accountOk}>{t('start.save')} <Icon name="check" size={18} /></button>
        </form>
      </div>
    )
  }

  return (
    <div className="start">
      <img className="start-art bloom-in" src={ART.flower.src} alt="" aria-hidden="true" />
      <div>
        <h1 className="brand">{t('app.name')}</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>{t('start.subtitle')}</p>
      </div>
      <div className="segmented" role="tablist" style={{ width: '100%', maxWidth: 420 }}>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMessage(null) }}>{t('start.register')}</button>
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMessage(null) }}>{t('start.login')}</button>
      </div>
      {mode === 'register' ? (
        <form onSubmit={onRegister} className="stack" style={{ width: '100%', maxWidth: 420 }} key="r">
          <Field label={t('start.name')}>
            <input className="input" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </Field>
          {ageField}
          {accountFields()}
          {note}
          <button className="btn btn-block btn-lg" disabled={busy || !name.trim() || !ageOk || !accountOk}>{t('start.create')} <Icon name="arrow" size={18} /></button>
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
    </div>
  )
}
