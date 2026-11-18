'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'

import { useAuth } from '@/web/auth'
import { ErrorState } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { browserSupabase } from '@/web/supabase-browser'

function LoginForm() {
  const { t } = usePrefs()
  const { configured } = useAuth()
  const router = useRouter()
  const next = useSearchParams()?.get('next') ?? '/profile'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/profile'
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!configured) return <ErrorState error={{ code: 'not_configured' }} />
  const sb = browserSupabase()!

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const res = mode === 'signin'
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password, options: { data: { display_name: name || undefined }, emailRedirectTo: `${location.origin}${safeNext}` } })
    setBusy(false)
    if (res.error) setMessage(res.error.message)
    else if (res.data.session) router.push(safeNext)
    else setMessage(t('auth.sent'))
  }
  const magic = async () => {
    if (!email) return
    setBusy(true)
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}${safeNext}` } })
    setBusy(false)
    setMessage(error ? error.message : t('auth.sent'))
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
      {mode === 'signin' ? <button type="button" className="btn btn-soft btn-block" onClick={magic} disabled={busy || !email}>{t('auth.magic')}</button> : null}
      <button type="button" className="chip" style={{ alignSelf: 'center' }} onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        {mode === 'signin' ? `${t('auth.no_account')} ${t('action.signup')}` : `${t('auth.have_account')} ${t('action.signin')}`}
      </button>
    </form>
  )
}

export default function Login() {
  return <Suspense fallback={null}><LoginForm /></Suspense>
}
