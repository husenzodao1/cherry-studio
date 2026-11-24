'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/web/auth'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { OtpField } from '@/web/components/OtpField'
import { showToast } from '@/web/components/Toast'
import { enrollTotp, mfaState, removeTotp, verifyCode, type MfaState } from '@/web/mfa'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

/**
 * Her account's protection: the two-step sign-in. Turned on with an authenticator app — its QR code scanned
 * (or the secret typed), then one of its codes — and from then on her paid plan opens only after that code on a
 * new phone. Turned off only from a session that passed it.
 */
export default function SecurityPage() {
  const { t } = usePrefs()
  const { session } = useAuth()
  const { reload } = usePlan()
  const [st, setSt] = useState<MfaState | null>(null)
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)

  const look = useCallback(async () => { if (session) setSt(await mfaState().catch(() => null)) }, [session])
  useEffect(() => { void look() }, [look])

  const begin = async () => {
    setBusy(true)
    try { setSetup(await enrollTotp()) } catch { showToast(t('state.error'), 'alert') } finally { setBusy(false) }
  }
  const finish = async () => {
    if (!setup || code.length !== 6) return
    setBusy(true)
    setWrong(false)
    try {
      await verifyCode(setup.id, code)
      setSetup(null)
      setCode('')
      showToast(t('mfa.on_done'), 'check')
      await look()
      await reload()
    } catch {
      setWrong(true)
    } finally {
      setBusy(false)
    }
  }
  const off = async () => {
    if (!st?.factor || !confirm(t('mfa.off_confirm'))) return
    try { await removeTotp(st.factor); await look(); showToast(t('mfa.off_done'), 'info') } catch { showToast(t('mfa.off_failed'), 'alert') }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(setup?.secret ?? ''); showToast(t('ai.copied'), 'check') } catch { /* not allowed */ } }

  return (
    <>
      <Header back="/settings" title={t('mfa.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        <div className="glass card-pad ws-hero">
          <span className="ws-hero-ico is-mfa" aria-hidden="true"><Icon name="shield" size={28} /></span>
          <div className="stack" style={{ gap: 4 }}>
            <b>{t('mfa.title')}</b>
            <span className="muted">{t('mfa.lead')}</span>
          </div>
        </div>
        {!session ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <span className="muted">{t('mfa.need_account')}</span>
            <Link className="btn btn-block" href="/start">{t('start.login')}</Link>
          </div>
        ) : !st ? <div className="skeleton" style={{ height: 140, borderRadius: 24 }} /> : st.enabled ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <span className="mfa-on"><Icon name="check" size={18} /> {t('mfa.is_on')}</span>
            <span className="muted">{t('mfa.is_on_sub')}</span>
            <button type="button" className="link-btn" onClick={() => void off()}>{t('mfa.turn_off')}</button>
          </div>
        ) : !setup ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <ol className="tg-steps">
              <li>{t('mfa.step_app')}</li>
              <li>{t('mfa.step_scan')}</li>
              <li>{t('mfa.step_code')}</li>
            </ol>
            <button type="button" className="btn btn-block btn-lg" disabled={busy} onClick={() => void begin()}><Icon name="shield" size={18} /> {t('mfa.turn_on')}</button>
          </div>
        ) : (
          <div className="glass card-pad stack mfa-setup" style={{ gap: 12, alignItems: 'center' }}>
            <b>{t('mfa.scan')}</b>
            <img className="mfa-qr" src={setup.qr} alt={t('mfa.scan')} width={200} height={200} />
            <button type="button" className="mfa-secret" onClick={() => void copy()}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()} <Icon name="copy" size={14} /></button>
            <span className="muted" style={{ textAlign: 'center' }}>{t('mfa.enter_code')}</span>
            <OtpField value={code} label={t('mfa.enter_code')} state={wrong ? 'bad' : 'idle'} onChange={(v) => { setCode(v); setWrong(false) }} />
            {wrong ? <span className="mfa-wrong" role="alert">{t('mfa.wrong')}</span> : null}
            <button type="button" className="btn btn-block btn-lg" disabled={busy || code.length !== 6} onClick={() => void finish()}>{t('mfa.confirm')}</button>
          </div>
        )}
      </div>
    </>
  )
}
