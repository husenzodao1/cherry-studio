'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { api } from '@/web/api'
import { useAuth } from '@/web/auth'
import { Help } from '@/web/components/Help'
import { Icon } from '@/web/components/Icon'
import { LOCALE_LABELS, type Locale } from '@/web/i18n'
import { usePrefs } from '@/web/prefs'

export default function Settings() {
  const prefs = usePrefs()
  const { t } = prefs
  const { session } = useAuth()
  const [notify, setNotify] = useState<boolean | null>(null)

  useEffect(() => {
    if (!session) return
    api<{ profile: { notifications_enabled: boolean } | null }>('/me').then((m) => setNotify(!!m.profile?.notifications_enabled)).catch(() => undefined)
  }, [session])

  const sync = (patch: Record<string, unknown>) => {
    if (session) api('/me', { method: 'PATCH', body: patch }).catch(() => undefined)
  }
  const exportData = async () => {
    const data = await api('/me/export')
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'dukhtari-khubam-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <header className="topbar">
        <Link href="/profile" className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
        <h1 className="h-page" style={{ fontSize: '1.6rem' }}>{t('settings.title')}</h1>
      </header>
      <div className="section">
        <div className="card card-pad stack">
          <span className="eyebrow">{t('settings.language')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
              <button key={l} role="radio" aria-checked={prefs.locale === l} aria-pressed={prefs.locale === l} lang={l}
                onClick={() => { prefs.set({ locale: l }); sync({ locale: l }) }}>{LOCALE_LABELS[l]}</button>
            ))}
          </div>
        </div>
        <div className="card card-pad stack">
          <span className="eyebrow">{t('settings.theme')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={prefs.theme === m} aria-pressed={prefs.theme === m}
                onClick={() => { prefs.set({ theme: m }); sync({ theme: m }) }}>{t(`theme.${m}`)}</button>
            ))}
          </div>
        </div>
        <div className="card card-pad stack">
          <span className="eyebrow">{t('settings.animation')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.animation')}>
            {(['full', 'reduce', 'system'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={prefs.motion === m} aria-pressed={prefs.motion === m}
                onClick={() => { prefs.set({ motion: m }); sync({ reduce_motion: m === 'reduce' }) }}>
                {m === 'system' ? t('theme.system') : t(`motion.${m}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="card card-pad stack">
          <span className="eyebrow">{t('settings.text_size')}</span>
          <input type="range" min={0.9} max={1.3} step={0.05} value={prefs.textScale}
            onChange={(e) => { const v = Number(e.target.value); prefs.set({ textScale: v }); sync({ text_scale: v }) }} />
        </label>
        {session && notify !== null ? (
          <div className="card card-pad">
            <div className="row">
              <span id="notify-l" style={{ flex: 1 }}>{t('settings.notifications')} <Help helpKey="settings.notifications" label={t('settings.notifications')} /></span>
              <button role="switch" aria-checked={notify} aria-labelledby="notify-l" className={`chip`} aria-pressed={notify}
                onClick={() => { setNotify(!notify); sync({ notifications_enabled: !notify }) }}>{notify ? '●' : '○'}</button>
            </div>
          </div>
        ) : null}
        {session ? <button className="card card-pad row" style={{ border: 0, cursor: 'pointer' }} onClick={exportData}><Icon name="down" /><span style={{ flex: 1, textAlign: 'start' }}>{t('settings.export')}</span></button> : null}
        <Link href="/p/privacy" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="lock" /><span style={{ flex: 1 }}>{t('settings.privacy')}</span><Icon name="forward" /></Link>
        <Link href="/p/about" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="info" /><span style={{ flex: 1 }}>{t('settings.about')}</span><Icon name="forward" /></Link>
      </div>
    </>
  )
}
