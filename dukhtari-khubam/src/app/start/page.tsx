'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { formatCode } from '@/lib/progress'
import { ART } from '@/web/art'
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
      <div className="start">
        <img className="start-art bloom-in" style={{ width: 'min(52vw, 210px)' }} src={ART.flower.src} alt="" aria-hidden="true" />
        <div className="glass card-pad stack" style={{ width: '100%', maxWidth: 420, alignItems: 'center' }}>
          <span className="greet" style={{ margin: 0 }}>{created.name}</span>
          <h1 className="h-page">{t('start.your_code')}</h1>
          <div className="glass card-pad" style={{ width: '100%', background: 'var(--glass-flat)' }}>
            <div className="code-box" aria-label={created.code.split('').join(' ')}>{formatCode(created.code)}</div>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.9em' }}>{t('start.keep_code')}</p>
          <button type="button" className="btn btn-soft btn-block" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={18} /> {copied ? t('start.copied') : t('start.copy')}</button>
          <button type="button" className="btn btn-block btn-lg" onClick={() => router.replace('/')}>{t('start.saved_it')} <Icon name="arrow" size={18} /></button>
        </div>
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
          <label className="stack" style={{ gap: 8, textAlign: 'start' }}>
            <span className="eyebrow" style={{ paddingInline: 8 }}>{t('start.name')}</span>
            <input className="input" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn btn-block btn-lg" disabled={!name.trim()}>{t('start.create')} <Icon name="arrow" size={18} /></button>
        </form>
      ) : (
        <form onSubmit={onLogin} className="stack" style={{ width: '100%', maxWidth: 420 }} key="l">
          <label className="stack" style={{ gap: 8, textAlign: 'start' }}>
            <span className="eyebrow" style={{ paddingInline: 8 }}>{t('start.enter_code')}</span>
            <input className="input" inputMode="numeric" autoComplete="off" value={formatCode(code)} maxLength={17}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 15))}
              style={{ fontSize: '1.25em', letterSpacing: '0.08em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
          </label>
          {message ? <p role="status" className="muted" style={{ margin: 0 }}>{message}</p> : null}
          <button className="btn btn-block btn-lg" disabled={busy || code.length !== 15}>{t('start.restore')} <Icon name="check" size={18} /></button>
        </form>
      )}
    </div>
  )
}
