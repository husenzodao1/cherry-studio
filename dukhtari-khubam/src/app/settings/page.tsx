'use client'

import Link from 'next/link'

import { Icon } from '@/web/components/Icon'
import { LOCALE_LABELS, type Locale } from '@/web/i18n'
import { usePrefs } from '@/web/prefs'

export default function Settings() {
  const prefs = usePrefs()
  const { t } = prefs
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
                onClick={() => { prefs.set({ locale: l }) }}>{LOCALE_LABELS[l]}</button>
            ))}
          </div>
        </div>
        <div className="card card-pad stack">
          <span className="eyebrow">{t('settings.theme')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={prefs.theme === m} aria-pressed={prefs.theme === m}
                onClick={() => { prefs.set({ theme: m }) }}>{t(`theme.${m}`)}</button>
            ))}
          </div>
        </div>
        <div className="card card-pad stack">
          <span className="eyebrow">{t('settings.animation')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.animation')}>
            {(['full', 'reduce', 'system'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={prefs.motion === m} aria-pressed={prefs.motion === m}
                onClick={() => { prefs.set({ motion: m }) }}>
                {m === 'system' ? t('theme.system') : t(`motion.${m}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="card card-pad stack">
          <span className="eyebrow">{t('settings.text_size')}</span>
          <input type="range" min={0.9} max={1.3} step={0.05} value={prefs.textScale}
            onChange={(e) => { const v = Number(e.target.value); prefs.set({ textScale: v }) }} />
        </label>
        <Link href="/page?slug=privacy" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="lock" /><span style={{ flex: 1 }}>{t('settings.privacy')}</span><Icon name="forward" /></Link>
        <Link href="/page?slug=about" className="card card-pad row" style={{ textDecoration: 'none' }}><Icon name="info" /><span style={{ flex: 1 }}>{t('settings.about')}</span><Icon name="forward" /></Link>
      </div>
    </>
  )
}
