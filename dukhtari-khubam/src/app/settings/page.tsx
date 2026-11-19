'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { formatCode } from '@/lib/progress'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { CodeImageButton } from '@/web/components/Keepsakes'
import { LOCALE_LABELS, type Locale } from '@/web/i18n'
import { useLearner } from '@/web/offline/learner'
import { allowNotifications, canNotify, DEFAULT_NOTIFY, readNotify, writeNotify, type NotifyPrefs } from '@/web/offline/notify'
import { usePrefs } from '@/web/prefs'

/** The learner's code on this phone, shown on request and easy to copy. */
function CodeCard() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  if (!learner) return null
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(learner.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setShow(true)
    }
  }
  return (
    <div className="glass card-pad stack" style={{ gap: 10 }}>
      <div className="row">
        <Icon name="lock" style={{ color: 'var(--primary)' }} />
        <b style={{ flex: 1, fontWeight: 500 }}>{t('profile.code')}</b>
        <button type="button" className="icon-btn" style={{ width: 38, height: 38 }} aria-label={show ? t('profile.hide_code') : t('profile.show_code')} onClick={() => setShow(!show)}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
        </button>
        <button type="button" className="icon-btn" style={{ width: 38, height: 38 }} aria-label={t('start.copy')} onClick={copy}>
          <Icon name={copied ? 'check' : 'copy'} size={18} />
        </button>
      </div>
      <div className="code-box" aria-live="polite">{show ? formatCode(learner.code) : '••••• ••••• •••••'}</div>
      <span className="muted" style={{ fontSize: '0.84em' }}>{t('settings.code_hint')}</span>
      {learner.username ? <span style={{ fontSize: '0.9em' }}>{t('start.username')}: <b>{learner.username}</b></span> : null}
      <CodeImageButton />
    </div>
  )
}

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
        <input type="time" className="input" style={{ width: 104, minHeight: 38, padding: '0 10px', textAlign: 'center' }} aria-label={t('notify.time')}
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
      <div className="section stagger">
        <CodeCard />
        {native ? <Notifications /> : null}
        <div className="glass card-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">{t('settings.language')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.language')}>
            {(Object.keys(LOCALE_LABELS) as Locale[]).map((l) => (
              <button key={l} role="radio" aria-checked={prefs.locale === l} aria-pressed={prefs.locale === l} lang={l}
                onClick={() => prefs.set({ locale: l })}>{LOCALE_LABELS[l]}</button>
            ))}
          </div>
        </div>
        <div className="glass card-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">{t('settings.theme')}</span>
          <div className="segmented" role="radiogroup" aria-label={t('settings.theme')}>
            {(['light', 'dark', 'system'] as const).map((m) => (
              <button key={m} role="radio" aria-checked={prefs.theme === m} aria-pressed={prefs.theme === m}
                onClick={() => prefs.set({ theme: m })}>{t(`theme.${m}`)}</button>
            ))}
          </div>
        </div>
        <label className="glass card-pad stack" style={{ gap: 10 }}>
          <span className="eyebrow">{t('settings.text_size')}</span>
          <input type="range" min={0.9} max={1.3} step={0.05} value={prefs.textScale}
            onChange={(e) => prefs.set({ textScale: Number(e.target.value) })} />
        </label>
        <div className="glass menu">
          <Link href="/support" className="menu-row"><Icon name="bell" /><span className="grow">{t('support.title')}</span><Icon name="forward" size={18} /></Link>
          <Link href="/page?slug=privacy" className="menu-row"><Icon name="lock" /><span className="grow">{t('settings.privacy')}</span><Icon name="forward" size={18} /></Link>
          <Link href="/page?slug=about" className="menu-row"><Icon name="info" /><span className="grow">{t('settings.about')}</span><Icon name="forward" size={18} /></Link>
          {learner ? <button type="button" className="menu-row danger" onClick={leave}><Icon name="logout" /><span className="grow">{t('profile.signout')}</span></button> : null}
        </div>
        <p className="muted" style={{ textAlign: 'center', fontSize: '0.8em', margin: 0 }}>{t('settings.version')} {process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? ''}</p>
      </div>
    </>
  )
}
