'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { api, ApiFailure } from '@/web/api'
import { useAuth } from '@/web/auth'
import { CrownSpin } from '@/web/components/CrownSpin'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { showToast } from '@/web/components/Toast'
import { usePlan } from '@/web/plans'
import { usePrefs } from '@/web/prefs'

/**
 * Mahliyo in Telegram (Premium): her Telegram linked by a one-time link to the bot (her account's e-mail is
 * confirmed already); then the bot answers her there, and in the groups she turns it on in.
 */

interface Status { linked: boolean; name?: string | null; allowed: boolean; bot: string | null; ready: boolean }

export default function TelegramPage() {
  const { t } = usePrefs()
  const { session } = useAuth()
  const { open } = usePlan()
  const [st, setSt] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    try { setSt(await api<Status>('/me/telegram')) } catch { setSt(null) }
  }, [session])
  useEffect(() => { void load() }, [load])
  // back from Telegram: linked now?
  useEffect(() => {
    const back = () => { if (document.visibilityState === 'visible') void load() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [load])

  const connect = async () => {
    setBusy(true)
    try {
      const { link } = await api<{ link: string }>('/me/telegram/code', { method: 'POST' })
      window.open(link, '_blank')
    } catch (e) {
      const code = e instanceof ApiFailure ? e.code : ''
      if (code === 'plan_limit') open('telegram')
      else showToast(code === 'not_configured' ? t('tg.not_ready') : t('state.error'), 'info')
    } finally {
      setBusy(false)
    }
  }
  const unlink = async () => {
    if (!confirm(t('tg.unlink_q'))) return
    try { await api('/me/telegram/unlink', { method: 'POST' }); void load() } catch { showToast(t('state.error'), 'info') }
  }

  return (
    <>
      <Header back="/settings" title={t('tg.title')} />
      <div className="section stack" style={{ gap: 14 }}>
        <div className="glass card-pad ws-hero">
          <span className="ws-hero-ico is-tg" aria-hidden="true"><Icon name="share" size={28} /></span>
          <div className="stack" style={{ gap: 4 }}>
            <b>{t('tg.title')}</b>
            <span className="muted">{t('tg.lead')}</span>
          </div>
        </div>
        {!session ? (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <span>{t('tg.sign_in')}</span>
            <Link className="btn btn-block" href="/start">{t('start.login')}</Link>
          </div>
        ) : !st ? (
          <div className="skeleton" style={{ height: 140, borderRadius: 24 }} />
        ) : !st.allowed ? (
          <div className="glass card-pad ws-locked">
            <CrownSpin plan="premium" size={92} />
            <b>{t('tg.locked')}</b>
            <span className="muted">{t('tg.locked_sub')}</span>
            <button type="button" className="btn btn-block btn-lg" onClick={() => open('telegram')}>{t('pw.settings_cta')}</button>
          </div>
        ) : st.linked ? (
          <div className="glass card-pad stack tg-linked" style={{ gap: 10 }}>
            <span className="tg-ok"><Icon name="check" size={20} /> {t('tg.connected').replace('{name}', st.name ? `@${st.name}` : 'Telegram')}</span>
            {st.bot ? <a className="btn btn-block btn-lg tg-open" href={`https://t.me/${st.bot}`} target="_blank" rel="noreferrer"><Icon name="share" size={18} /> {t('tg.open')}</a> : null}
            <button type="button" className="btn btn-soft btn-block" onClick={() => void unlink()}>{t('tg.unlink')}</button>
          </div>
        ) : (
          <div className="glass card-pad stack" style={{ gap: 10 }}>
            <button type="button" className="btn btn-block btn-lg tg-open" disabled={busy || !st.ready || !st.bot} aria-busy={busy} onClick={() => void connect()}>
              <Icon name="share" size={18} /> {t('tg.connect')}
            </button>
            {!st.ready || !st.bot ? <span className="muted" role="status">{t('tg.not_ready')}</span> : null}
          </div>
        )}
        <div className="glass card-pad stack" style={{ gap: 8 }}>
          <span className="eyebrow">{t('tg.how')}</span>
          <ol className="tg-steps">
            <li>{t('tg.step_1')}</li>
            <li>{t('tg.step_2')}</li>
            <li>{t('tg.step_3')}</li>
          </ol>
        </div>
      </div>
    </>
  )
}
