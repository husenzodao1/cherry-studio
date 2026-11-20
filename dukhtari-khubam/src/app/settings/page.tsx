'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { checkForUpdate } from '@/web/components/AppUpdate'
import { PinSettings } from '@/web/components/PinSettings'
import { RateShare } from '@/web/components/RateShare'
import { showToast } from '@/web/components/Toast'
import { LOCALE_LABELS, LOCALES } from '@/web/i18n'
import { useLearner } from '@/web/offline/learner'
import { allowNotifications, canNotify, DEFAULT_NOTIFY, readNotify, writeNotify, type NotifyPrefs } from '@/web/offline/notify'
import { TEXT_SIZES, THEMES, usePrefs } from '@/web/prefs'

function Notifications() {
  const { t } = usePrefs()
  const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_NOTIFY)
  const [denied, setDenied] = useState(false)
  useEffect(() => setPrefs(readNotify()), [])
  const change = async (key: keyof NotifyPrefs, patch: Partial<NotifyPrefs[keyof NotifyPrefs]>) => {
    if (patch.on && !(await allowNotifications())) {
      setDenied(true)
      return
    }
    setDenied(false)
    const next = { ...prefs, [key]: { ...prefs[key], ...patch } }
    setPrefs(next)
    writeNotify(next)
  }
  const row = (key: keyof NotifyPrefs, label: string) => (
    <div className="menu-row" key={key}>
      <Icon name={key === 'lesson' ? 'book' : 'sparkle'} />
      <span className="grow">{label}</span>
      {prefs[key].on ? (
        <input type="time" className="time-plain" aria-label={t('notify.time')}
          value={prefs[key].time} onChange={(e) => e.target.value && change(key, { time: e.target.value })} />
      ) : null}
      <button type="button" role="switch" className="switch" aria-checked={prefs[key].on} aria-label={label} onClick={() => change(key, { on: !prefs[key].on })} />
    </div>
  )
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="eyebrow" style={{ paddingInline: 6 }}>{t('settings.notifications')}</span>
      <div className="glass menu">
        {row('lesson', t('notify.lesson_title').replace(' 💜', ''))}
        {row('inspiration', t('notify.inspiration_title'))}
      </div>
      {denied ? <span className="muted" role="status" style={{ fontSize: '0.84em', paddingInline: 6 }}>{t('notify.denied')}</span> : null}
    </div>
  )
}

/** The theme: one row with the current one; a tap opens the choices below it. */
function ThemePicker() {
  const prefs = usePrefs()
  const { t } = prefs
  const [open, setOpen] = useState(false)
  return (
    <div className={`glass theme-box${open ? ' is-open' : ''}`}>
      <button type="button" className="theme-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={`theme-swatch theme-swatch-sm swatch-${prefs.theme}`} aria-hidden="true" />
        <span className="grow"><span className="eyebrow" style={{ display: 'block' }}>{t('settings.theme')}</span>{t(`theme.${prefs.theme}`)}</span>
        <Icon name="down" size={18} className="theme-chevron" />
      </button>
      <div className="theme-drawer">
        <div className="themes" role="radiogroup" aria-label={t('settings.theme')}>
          {THEMES.map((m, i) => (
            <button key={m} type="button" role="radio" aria-checked={prefs.theme === m} className="theme-pick" style={{ ['--i' as string]: i }}
              onClick={() => { prefs.set({ theme: m }); setTimeout(() => setOpen(false), 260) }}>
              <span className={`theme-swatch swatch-${m}`} aria-hidden="true" />
              <span>{t(`theme.${m}`)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The language: one row with the current one; a tap opens the short list below it. */
function LanguagePicker() {
  const prefs = usePrefs()
  const { t } = prefs
  const [open, setOpen] = useState(false)
  return (
    <div className={`glass theme-box${open ? ' is-open' : ''}`}>
      <button type="button" className="theme-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="lang-badge" aria-hidden="true"><Icon name="globe" size={18} /></span>
        <span className="grow"><span className="eyebrow" style={{ display: 'block' }}>{t('settings.language')}</span><span lang={prefs.locale}>{LOCALE_LABELS[prefs.locale]}</span></span>
        <Icon name="down" size={18} className="theme-chevron" />
      </button>
      <div className="theme-drawer">
        <div className="lang-list" role="radiogroup" aria-label={t('settings.language')}>
          {LOCALES.map((l, i) => (
            <button key={l} type="button" role="radio" aria-checked={prefs.locale === l} lang={l} className="lang-pick" style={{ ['--i' as string]: i }}
              onClick={() => { prefs.set({ locale: l }); setTimeout(() => setOpen(false), 260) }}>
              {LOCALE_LABELS[l]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const prefs = usePrefs()
  const { t } = prefs
  const router = useRouter()
  const { learner, signOut } = useLearner()
  const [native, setNative] = useState(false)
  useEffect(() => setNative(canNotify()), [])
  const leave = () => {
    if (!confirm(t('profile.signout_confirm'))) return
    signOut()
    router.replace('/start')
  }
  return (
    <>
      <Header back="/profile" title={t('settings.title')} />
      <div className="section stagger solid-glass">
        {native ? <Notifications /> : null}
        <LanguagePicker />
        <ThemePicker />
        <div className="glass card-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">{t('settings.text_size')}</span>
          <div className="segmented text-sizes" role="radiogroup" aria-label={t('settings.text_size')}>
            {TEXT_SIZES.map((s) => (
              <button key={s.key} type="button" role="radio" aria-checked={prefs.textScale === s.scale} aria-pressed={prefs.textScale === s.scale}
                aria-label={`${t('settings.text_size')} ${s.scale === 1 ? '2' : '1'}`} onClick={() => prefs.set({ textScale: s.scale })}>
                {/* only "Aa", in the size it gives */}
                <span className={`text-aa text-aa-${s.key}`} aria-hidden="true">Aa</span>
              </button>
            ))}
          </div>
        </div>
        <div className="glass menu">
          <Link href="/support" className="menu-row"><Icon name="bell" /><span className="grow">{t('support.title')}</span><Icon name="forward" size={18} /></Link>
          <Link href="/page?slug=privacy" className="menu-row"><Icon name="lock" /><span className="grow">{t('settings.privacy')}</span><Icon name="forward" size={18} /></Link>
          <Link href="/page?slug=about" className="menu-row"><Icon name="info" /><span className="grow">{t('settings.about')}</span><Icon name="forward" size={18} /></Link>
          {/* the other apps of the studio: the list comes later */}
          <button type="button" className="menu-row" onClick={() => showToast(t('settings.other_apps_soon'), 'sparkle')}>
            <Icon name="grid" /><span className="grow">{t('settings.other_apps')}</span><span className="chip chip-soon">{t('settings.other_apps_soon')}</span>
          </button>
          {/* the app's version (tap: look for a newer one) — only in the app; the website is always the newest */}
          {native ? (
            <button type="button" className="menu-row" onClick={() => checkForUpdate(t)}>
              <Icon name="install" /><span className="grow">{t('settings.version')}</span><span className="muted version-num">{process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? ''}</span>
            </button>
          ) : null}
          {learner ? <button type="button" className="menu-row danger" onClick={leave}><Icon name="logout" /><span className="grow">{t('profile.signout')}</span></button> : null}
        </div>
        <RateShare />
        {/* the PIN lock guards the phone app; the website has none */}
        {native ? <PinSettings /> : null}
      </div>
    </>
  )
}
