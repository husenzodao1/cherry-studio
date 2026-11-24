'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { useAuth } from '../auth'
import { mfaState, verifyCode, type MfaState } from '../mfa'
import { usePlan } from '../plans'
import { usePrefs } from '../prefs'
import { browserSupabase } from '../supabase-browser'
import { OtpField } from './OtpField'
import { Icon } from './Icon'

/** asked once each time the app opens */
let offered = false

/**
 * Her account's second step. Signed in on a phone without it while it is on: the code from her authenticator
 * is asked before her account is used (or she signs out). With a paid plan and no second step yet: she is asked,
 * once each time the app opens, to turn it on.
 */
export function MfaGate() {
  const { t } = usePrefs()
  const { session } = useAuth()
  const { plan, me, reload } = usePlan()
  const path = usePathname() ?? '/'
  const [st, setSt] = useState<MfaState | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const [offer, setOffer] = useState(false)

  const look = useCallback(async () => {
    if (!session) { setSt(null); return }
    try { setSt(await mfaState()) } catch { setSt(null) }
  }, [session])
  useEffect(() => { void look() }, [look])

  // a paid plan without the second step: offered on the home screen, a moment after it shows
  useEffect(() => {
    if (offered || !st || st.enabled || plan === 'free' || me?.staff || path !== '/') return
    const timer = setTimeout(() => {
      if (document.querySelector('.pw-over, .perm, .night, .call, .lock-screen')) return
      offered = true
      setOffer(true)
    }, 2500)
    return () => clearTimeout(timer)
  }, [st, plan, me, path])

  const check = async () => {
    if (!st?.factor || code.length !== 6) return
    setBusy(true)
    setWrong(false)
    try {
      await verifyCode(st.factor, code)
      setCode('')
      await look()
      await reload()
    } catch {
      setWrong(true)
    } finally {
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null
  if (st?.needed) {
    return createPortal(
      <div className="mfa-screen" role="dialog" aria-modal="true" aria-label={t('mfa.ask_title')}>
        <span className="mfa-shield" aria-hidden="true"><Icon name="shield" size={34} /></span>
        <h2>{t('mfa.ask_title')}</h2>
        <p className="muted">{t('mfa.ask_sub')}</p>
        <OtpField value={code} label={t('mfa.ask_title')} state={wrong ? 'bad' : 'idle'} onChange={(v) => { setCode(v); setWrong(false) }} />
        {wrong ? <span className="mfa-wrong" role="alert">{t('mfa.wrong')}</span> : null}
        <button type="button" className="btn btn-block btn-lg" disabled={busy || code.length !== 6} onClick={() => void check()}>{t('mfa.confirm')}</button>
        <button type="button" className="link-btn" onClick={() => void browserSupabase()?.auth.signOut()}>{t('mfa.sign_out')}</button>
      </div>,
      document.body
    )
  }
  if (offer) {
    return createPortal(
      <div className="attach-veil" onClick={() => setOffer(false)}>
        <section className="mfa-offer" role="dialog" aria-modal="true" aria-label={t('mfa.offer_title')} onClick={(e) => e.stopPropagation()}>
          <span className="mfa-shield" aria-hidden="true"><Icon name="shield" size={30} /></span>
          <b>{t('mfa.offer_title').replace('{plan}', plan === 'premium' ? 'Premium' : 'Standard')}</b>
          <span className="muted">{t('mfa.offer_sub')}</span>
          <Link href="/security" className="btn btn-block btn-lg" onClick={() => setOffer(false)}><Icon name="shield" size={18} /> {t('mfa.turn_on')}</Link>
          <button type="button" className="link-btn" onClick={() => setOffer(false)}>{t('mfa.later')}</button>
        </section>
      </div>,
      document.body
    )
  }
  return null
}
