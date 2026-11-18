'use client'

import { Capacitor } from '@capacitor/core'

/**
 * Daily local notifications in the Android app: a lesson reminder and the inspiration of the day.
 * They are scheduled on the phone (no server, no account) and rescheduled whenever the content or
 * the learner's progress changes, so the texts stay current.
 */

export interface Reminder { on: boolean; time: string }
export interface NotifyPrefs { lesson: Reminder; inspiration: Reminder }

const KEY = 'dk.notify'
const IDS = { lesson: 101, inspiration: 102 } as const
export const DEFAULT_NOTIFY: NotifyPrefs = { lesson: { on: false, time: '19:00' }, inspiration: { on: false, time: '08:00' } }

export const canNotify = () => Capacitor.isNativePlatform()

export function readNotify(): NotifyPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NotifyPrefs> | null
    return { lesson: { ...DEFAULT_NOTIFY.lesson, ...v?.lesson }, inspiration: { ...DEFAULT_NOTIFY.inspiration, ...v?.inspiration } }
  } catch {
    return DEFAULT_NOTIFY
  }
}

export function writeNotify(p: NotifyPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event('dk-notify'))
}

/** Asks Android for permission to show notifications (Android 13+ shows a system dialog once). */
export async function allowNotifications(): Promise<boolean> {
  if (!canNotify()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  let perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
  return perm.display === 'granted'
}

export interface NotifyTexts {
  lesson: { title: string; body: string; href: string }
  inspiration: { title: string; body: string }
}

const at = (time: string) => {
  const [h, m] = time.split(':').map((x) => Number.parseInt(x, 10))
  return { hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 19, minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0 }
}

/** Replaces both daily notifications with the current texts (or removes the ones turned off). */
export async function scheduleDaily(prefs: NotifyPrefs, texts: NotifyTexts): Promise<void> {
  if (!canNotify()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: IDS.lesson }, { id: IDS.inspiration }] }).catch(() => undefined)
  const perm = await LocalNotifications.checkPermissions()
  if (perm.display !== 'granted') return
  const list = []
  if (prefs.lesson.on) {
    list.push({ id: IDS.lesson, title: texts.lesson.title, body: texts.lesson.body, schedule: { on: at(prefs.lesson.time), allowWhileIdle: true }, extra: { href: texts.lesson.href } })
  }
  if (prefs.inspiration.on) {
    list.push({ id: IDS.inspiration, title: texts.inspiration.title, body: texts.inspiration.body, largeBody: texts.inspiration.body, schedule: { on: at(prefs.inspiration.time), allowWhileIdle: true }, extra: { href: '/' } })
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list })
}

/** Opens the screen a tapped notification points to. */
export async function onNotificationTap(go: (href: string) => void): Promise<() => void> {
  if (!canNotify()) return () => undefined
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const href = (e.notification.extra as { href?: string } | undefined)?.href
    if (typeof href === 'string' && href.startsWith('/')) go(href)
  })
  return () => handle.remove()
}
