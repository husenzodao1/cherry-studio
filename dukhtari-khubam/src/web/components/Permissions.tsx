'use client'

import { Capacitor } from '@capacitor/core'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { allowLockScreen, lockScreenAllowed, openNotifySettings, useCall } from '../offline/call'
import { useLearner } from '../offline/learner'
import { allowNotifications, notificationsAllowed, readNotify, writeNotify } from '../offline/notify'
import { usePrefs } from '../prefs'
import { onBack } from './BackButton'
import { Icon } from './Icon'
import { showToast } from './Toast'

/**
 * On entering the phone app: everything the app needs leave for, asked at once on one screen — notifications
 * (reminders, Mahliyo's and support's messages) and Mahliyo's calls over the lock screen. Asked again on
 * every opening while something is still not allowed; "Баъдтар" puts it off until the next one.
 */

/** pages where nothing is asked (signing in, the first questions, the staff's panel, plain pages) */
const QUIET = /^\/(start|welcome|admin|page|support|share)(\/|$)/
/** asked once per opening of the app */
let askedThisOpening = false

type Need = 'notify' | 'call'
type Granted = Record<Need, boolean>

const check = async (): Promise<Granted> => ({
  notify: await notificationsAllowed().catch(() => true),
  call: await lockScreenAllowed().catch(() => true)
})

/** whether the PIN lock covers the app (html.locked) */
function useUnlocked(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const root = document.documentElement
    const look = () => setOpen(!root.classList.contains('locked') && !root.classList.contains('gated'))
    look()
    const mo = new MutationObserver(look)
    mo.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return open
}

export function Permissions() {
  const { t } = usePrefs()
  const { ready, learner, progress } = useLearner()
  const path = usePathname() ?? '/'
  const ringing = useCall()
  const unlocked = useUnlocked()
  const [granted, setGranted] = useState<Granted | null>(null)
  const [shown, setShown] = useState(false)

  const time = Capacitor.isNativePlatform() && ready && !!learner && !!progress.about && !QUIET.test(path) && unlocked && !ringing

  useEffect(() => {
    if (!time || askedThisOpening) return
    const wait = setTimeout(async () => {
      const g = await check()
      if (askedThisOpening) return
      askedThisOpening = true
      setGranted(g)
      if (!g.notify || !g.call) setShown(true)
    }, 1200)
    return () => clearTimeout(wait)
  }, [time])

  // back from the phone's settings: look again; all allowed — the screen goes by itself
  const recheck = useCallback(async () => {
    const g = await check()
    setGranted((was) => {
      if (g.notify && !was?.notify) writeNotify(readNotify()) // the reminders are planned now
      return g
    })
    if (g.notify && g.call) {
      setShown(false)
      showToast(t('perm.all_set'), 'check')
    }
  }, [t])
  useEffect(() => {
    if (!shown) return
    const back = () => { if (document.visibilityState === 'visible') void recheck() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [shown, recheck])

  // the phone's back button closes it, as "Баъдтар"
  useEffect(() => (shown ? onBack(() => setShown(false)) : undefined), [shown])

  if (!shown || !granted) return null

  const ask = async (need: Need) => {
    if (need === 'notify') {
      // the system's own question; once she said "no", Android asks no more: its settings open instead
      if (!(await allowNotifications().catch(() => false))) openNotifySettings()
    } else allowLockScreen()
    await recheck()
  }
  const next: Need | null = !granted.notify ? 'notify' : !granted.call ? 'call' : null
  const rows: { id: Need; icon: 'bell' | 'phone'; label: string }[] = [
    { id: 'notify', icon: 'bell', label: t('perm.notify') },
    { id: 'call', icon: 'phone', label: t('perm.call') }
  ]

  return (
    <div className="perm" role="dialog" aria-modal="true" aria-label={t('perm.title')}>
      <div className="perm-body">
        {/* a lock, no box: its shackle opens and closes again, endlessly */}
        <svg className="perm-lock" viewBox="0 0 48 48" width="64" height="64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path className="perm-lock-shackle" d="M16 22v-6a8 8 0 0 1 16 0v6" />
          <g className="perm-lock-body">
            <rect x="10" y="22" width="28" height="20" rx="6" fill="color-mix(in srgb, currentColor 14%, transparent)" />
            <path d="M24 30v4" />
          </g>
        </svg>
        <h2 className="perm-title">{t('perm.title')}</h2>
        <ul className="perm-list">
          {rows.map((r) => (
            <li key={r.id} className={`perm-row${granted[r.id] ? ' is-on' : ''}`}>
              <span className="perm-row-icon"><Icon name={r.icon} size={19} /></span>
              <b className="grow">{r.label}</b>
              {granted[r.id]
                ? <span className="perm-ok" aria-label={t('perm.allowed')}><Icon name="check" size={16} /></span>
                : <button type="button" className="perm-chip" onClick={() => void ask(r.id)}>{t('perm.allow')}</button>}
            </li>
          ))}
        </ul>
      </div>
      <footer className="perm-foot">
        <button type="button" className="btn btn-block" onClick={() => (next ? void ask(next) : setShown(false))}>
          {next ? t('perm.allow_all') : t('perm.done')}
        </button>
        <button type="button" className="perm-later" onClick={() => setShown(false)}>{t('perm.later')}</button>
      </footer>
    </div>
  )
}
