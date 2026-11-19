'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'

import { formatCode } from '@/lib/progress'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { CodeImageButton } from '@/web/components/Keepsakes'
import { LOCALE_LABELS, type Locale } from '@/web/i18n'
import { useLearner } from '@/web/offline/learner'
import { allowNotifications, canNotify, DEFAULT_NOTIFY, readNotify, writeNotify, type NotifyPrefs } from '@/web/offline/notify'
import { checkPassword, unlockWithPhone } from '@/web/offline/unlock'
import { usePrefs } from '@/web/prefs'

/**
 * The learner's code and login, at the end of the settings and small: hidden until the phone's own lock
 * (fingerprint, face or screen PIN) — or, on the website, the login password — confirms it is her.
 * It hides itself again after a minute.
 */
function CodeCard() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setOpen(false), 60_000)
    return () => clearTimeout(timer)
  }, [open])
  if (!learner) return null
  const reveal = async () => {
    setMessage(null)
    if (open) return setOpen(false)
    const r = await unlockWithPhone(t('settings.unlock_title'), t('settings.unlock_reason'))
    if (r === 'ok') setOpen(true)
    // no lock to ask for: check the login password; without a login there is nothing to check against
    else if (r === 'password') learner.username ? setAsking(true) : setOpen(true)
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const r = await checkPassword(learner.username!, password)
    setBusy(false)
    if (r === 'ok') {
      setOpen(true)
      setAsking(false)
      setPassword('')
    } else setMessage(t(r === 'invalid' ? 'start.invalid_login' : r === 'locked' ? 'start.locked' : 'start.need_online'))
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(learner.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* the code stays on screen to copy by hand */
    }
  }
  return (
    <div className="glass code-card">
      <div className="row" style={{ gap: 10 }}>
        <span className="code-card-icon" aria-hidden="true"><Icon name="lock" size={16} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <b>{t('profile.code')}</b>
          {learner.username ? <span className="row-sub">{t('start.username')}: {learner.username}</span> : null}
        </span>
        <button type="button" className="chip" onClick={reveal} aria-expanded={open}>
          <Icon name={open ? 'eyeOff' : 'eye'} size={16} /> {t(open ? 'profile.hide_code' : 'profile.show_code')}
        </button>
      </div>
      {asking && !open ? (
        <form className="row" style={{ gap: 8 }} onSubmit={submit}>
          <input className="input" type="password" autoComplete="current-password" placeholder={t('settings.unlock_password')}
            aria-label={t('settings.unlock_password')} value={password} onChange={(e) => setPassword(e.target.value)} style={{ minHeight: 44 }} />
          <button className="btn btn-soft" disabled={busy || !password} aria-label={t('profile.show_code')}><Icon name="arrow" size={18} /></button>
        </form>
      ) : null}
      {message ? <span className="muted" role="status" style={{ fontSize: '0.84em' }}>{message}</span> : null}
      {open ? (
        <>
          <div className="code-box code-box-sm" aria-live="polite">{formatCode(learner.code)}</div>
          <span className="muted" style={{ fontSize: '0.8em' }}>{t('settings.code_hint')}</span>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="chip" onClick={copy}><Icon name={copied ? 'check' : 'copy'} size={16} /> {t('start.copy')}</button>
            <CodeImageButton className="chip" />
          </div>
        </>
      ) : null}
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
        <CodeCard />
        <p className="muted" style={{ textAlign: 'center', fontSize: '0.8em', margin: 0 }}>{t('settings.version')} {process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? ''}</p>
      </div>
    </>
  )
}
