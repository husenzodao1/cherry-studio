'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type FormEvent } from 'react'

import { useAuth } from '@/web/auth'
import { ErrorState } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { browserSupabase } from '@/web/supabase-browser'

/**
 * Sign-up and sign-in confirmed by a one-time code sent to the e-mail address.
 * Sign-up: name + e-mail + password → code → account confirmed and signed in.
 * Sign-in: password, or a code by e-mail (no password needed).
 */
type Step = { kind: 'form' } | { kind: 'code'; purpose: 'signup' | 'email' }

const RESEND_SECONDS = 60

function LoginForm() {
  const { t } = usePrefs()
  const { configured } = useAuth()
  const router = useRouter()
  const next = useSearchParams()?.get('next') ?? '/profile'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/profile'
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  if (!configured) return <ErrorState error={{ code: 'not_configured' }} />
  const sb = browserSupabase()!

  const toCode = (purpose: 'signup' | 'email') => {
    setStep({ kind: 'code', purpose })
    setCode('')
    setWait(RESEND_SECONDS)
    setMessage(t('auth.sent'))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    if (mode === 'signin') {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (error) setMessage(error.message)
      else router.push(safeNext)
      return
    }
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name || undefined } } })
    setBusy(false)
    if (error) setMessage(error.message)
    else if (data.session) router.push(safeNext) // e-mail confirmation switched off in the project
    else toCode('signup')
  }

  const sendEmailCode = async () => {
    if (!email) return
    setBusy(true)
    setMessage(null)
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setBusy(false)
    if (error) setMessage(error.message)
    else toCode('email')
  }

  const resend = async () => {
    if (step.kind !== 'code' || wait > 0) return
    setBusy(true)
    const { error } = step.purpose === 'signup'
      ? await sb.auth.resend({ type: 'signup', email })
      : await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    setBusy(false)
    if (error) setMessage(error.message)
    else toCode(step.purpose)
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (step.kind !== 'code') return
    setBusy(true)
    setMessage(null)
    const { error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: step.purpose })
    setBusy(false)
    if (error) setMessage(t('auth.code_wrong'))
    else router.push(safeNext)
  }

  if (step.kind === 'code') {
    return (
      <form onSubmit={verify} className="card card-pad stack" style={{ maxWidth: 440, margin: '40px auto 0' }}>
        <h1 className="h-page">{t('auth.code')}</h1>
        <p className="muted" style={{ margin: 0 }}>{email}</p>
        <label className="stack" style={{ gap: 6 }}>
          <span className="eyebrow">{t('auth.code')}</span>
          <input className="input" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}" maxLength={10}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus
            style={{ fontSize: '1.5em', letterSpacing: '0.35em', textAlign: 'center' }} />
        </label>
        {message ? <p role="status" className="muted" style={{ margin: 0 }}>{message}</p> : null}
        <button className="btn btn-block" disabled={busy || code.length < 6}>{t('auth.verify')}</button>
        <button type="button" className="btn btn-soft btn-block" onClick={resend} disabled={busy || wait > 0}>
          {wait > 0 ? `${t('auth.resend_in')} ${wait}` : t('auth.resend')}
        </button>
        <button type="button" className="chip" style={{ alignSelf: 'center' }} onClick={() => { setStep({ kind: 'form' }); setMessage(null) }}>
          {t('auth.change_email')}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={submit} className="card card-pad stack" style={{ maxWidth: 440, margin: '40px auto 0' }}>
      <h1 className="h-page">{mode === 'signin' ? t('action.signin') : t('action.signup')}</h1>
      {mode === 'signup' ? (
        <label className="stack" style={{ gap: 6 }}><span className="eyebrow">{t('auth.name')}</span>
          <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="nickname" /></label>
      ) : null}
      <label className="stack" style={{ gap: 6 }}><span className="eyebrow">{t('auth.email')}</span>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
      <label className="stack" style={{ gap: 6 }}><span className="eyebrow">{t('auth.password')}</span>
        <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></label>
      {message ? <p role="status" className="muted" style={{ margin: 0 }}>{message}</p> : null}
      <button className="btn btn-block" disabled={busy}>{mode === 'signin' ? t('action.signin') : t('action.signup')}</button>
      {mode === 'signin' ? <button type="button" className="btn btn-soft btn-block" onClick={sendEmailCode} disabled={busy || !email}>{t('auth.magic')}</button> : null}
      <button type="button" className="chip" style={{ alignSelf: 'center' }} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(null) }}>
        {mode === 'signin' ? `${t('auth.no_account')} ${t('action.signup')}` : `${t('auth.have_account')} ${t('action.signin')}`}
      </button>
    </form>
  )
}

export default function Login() {
  return <Suspense fallback={null}><LoginForm /></Suspense>
}
