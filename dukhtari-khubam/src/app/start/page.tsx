'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { formatCode } from '@/lib/progress'
import { Icon } from '@/web/components/Icon'
import { useLearner, type Learner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'

/**
 * First launch. Register: name → personal 15-digit code → ✓ (works offline, the code is made on the
 * phone). Sign in: code → ✓ (needs the internet once, to bring the backed-up progress back).
 */
export default function StartPage() {
  const { t } = usePrefs()
  const router = useRouter()
  const { learner, register, restore } = useLearner()
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [created, setCreated] = useState<Learner | null>(null)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // already set up on this phone
  useEffect(() => {
    if (learner && !created) router.replace('/')
  }, [learner, created, router])

  const onRegister = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreated(register(name))
  }
  const onLogin = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const r = await restore(code)
    setBusy(false)
    if (r === 'ok') router.replace('/')
    else setMessage(r === 'offline' ? t('start.need_online') : t('start.not_found'))
  }
  const copy = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  if (created) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 440, margin: '48px auto 0', textAlign: 'center', alignItems: 'center' }}>
        <div className="eyebrow">{created.name}</div>
        <h1 className="h-page">{t('start.your_code')}</h1>
        <div className="card card-pad card-lilac" style={{ width: '100%' }}>
          <div style={{ fontSize: 'clamp(1.15em, 6vw, 1.6em)', letterSpacing: '0.06em', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600, userSelect: 'all' }}
            aria-label={created.code.split('').join(' ')}>{formatCode(created.code)}</div>
        </div>
        <p className="muted" style={{ margin: 0 }}>{t('start.keep_code')}</p>
        <button type="button" className="btn btn-soft btn-block" onClick={copy}>{copied ? t('start.copied') : t('start.copy')}</button>
        <button type="button" className="btn btn-block" onClick={() => router.replace('/')}><Icon name="check" size={18} /> {t('start.saved_it')}</button>
      </div>
    )
  }

  return (
    <div className="stack" style={{ maxWidth: 440, margin: '48px auto 0' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 className="h-hero">{t('app.name')}</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>{t('start.tagline')}</p>
      </div>
      <div className="segmented" role="tablist" style={{ alignSelf: 'center' }}>
        <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => { setMode('register'); setMessage(null) }}>{t('start.register')}</button>
        <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => { setMode('login'); setMessage(null) }}>{t('start.login')}</button>
      </div>
      {mode === 'register' ? (
        <form onSubmit={onRegister} className="card card-pad stack">
          <label className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">{t('start.name')}</span>
            <input className="input" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <button className="btn btn-block" disabled={!name.trim()}>{t('start.create')} <Icon name="arrow" size={16} /></button>
        </form>
      ) : (
        <form onSubmit={onLogin} className="card card-pad stack">
          <label className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">{t('start.enter_code')}</span>
            <input className="input" inputMode="numeric" autoComplete="off" value={formatCode(code)} maxLength={17}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 15))}
              style={{ fontSize: '1.3em', letterSpacing: '0.08em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} autoFocus />
          </label>
          {message ? <p role="status" className="muted" style={{ margin: 0 }}>{message}</p> : null}
          <button className="btn btn-block" disabled={busy || code.length !== 15}>{t('start.restore')} <Icon name="check" size={16} /></button>
        </form>
      )}
    </div>
  )
}
