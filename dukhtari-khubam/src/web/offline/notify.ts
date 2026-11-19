'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Local notifications in the Android app, scheduled on the phone (no server, no account) and rescheduled
 * whenever the content or the learner's progress changes:
 * - the lesson reminder: a different, personal line each day (variants edited in the panel, with {name},
 *   {lesson} and {streak}), planned a week ahead;
 * - the inspiration of the day;
 * - "last chance" for the day streak: when today is still empty, a red clock counts down to midnight
 *   (native, StreakAlarm.java).
 */

export interface Reminder { on: boolean; time: string }
export interface NotifyPrefs { lesson: Reminder; inspiration: Reminder; streak: Reminder }

const KEY = 'dk.notify'
const IDS = { lesson: 101, inspiration: 102 } as const
/** the lesson reminder of each of the next seven days has its own id (and its own words) */
const LESSON_DAYS = Array.from({ length: 7 }, (_, i) => 110 + i)
/** the morning greeting of each of the next seven days */
const MORNING_DAYS = Array.from({ length: 7 }, (_, i) => 120 + i)
const MORNING = { hour: 7, minute: 30 }
/** the streak reminders of an evening, in minutes after midnight: 18:00, 21:00, 23:00 */
const STREAK_TIMES = [18 * 60, 21 * 60, 23 * 60]
export const DEFAULT_NOTIFY: NotifyPrefs = {
  lesson: { on: false, time: '19:00' }, inspiration: { on: false, time: '08:00' }, streak: { on: true, time: '18:00' }
}

interface StreakApi {
  configure(o: { on: boolean; times: number[]; lastDay: string; streak: number; name: string; leftLabel: string; channel: string; titles: string[]; bodies: string[] }): Promise<void>
}
const StreakAlarm = registerPlugin<StreakApi>('StreakAlarm')

export const canNotify = () => Capacitor.isNativePlatform()

export function readNotify(): NotifyPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<NotifyPrefs> | null
    return {
      lesson: { ...DEFAULT_NOTIFY.lesson, ...v?.lesson },
      inspiration: { ...DEFAULT_NOTIFY.inspiration, ...v?.inspiration },
      streak: { ...DEFAULT_NOTIFY.streak, ...v?.streak }
    }
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
  /** one line per variant; {name}, {lesson} and {streak} are filled in */
  lessonTitles: string[]
  lessonBodies: string[]
  lessonHref: string
  inspiration: { title: string; body: string }
  streak: { titles: string[]; bodies: string[]; leftLabel: string; channel: string }
  /** short greetings for the morning, one a day */
  morning: string[]
  /** filled into the variants */
  vars: { name: string; lesson: string; streak: number }
  /** the last day she studied (YYYY-MM-DD) */
  lastDay: string
}

const at = (time: string) => {
  const [h, m] = time.split(':').map((x) => Number.parseInt(x, 10))
  return { hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 19, minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0 }
}

/** Lines of a panel text (one variant per line). */
export const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)

/** A variant for the given day, with its placeholders filled. */
export function variant(list: string[], dayIndex: number, vars: NotifyTexts['vars']): string {
  if (!list.length) return ''
  const v = list[((dayIndex % list.length) + list.length) % list.length]
  return v.replace(/\{name\}/g, vars.name).replace(/\{lesson\}/g, vars.lesson).replace(/\{streak\}/g, String(vars.streak))
    .replace(/\s+([,.!?…])/g, '$1').replace(/,\s*([!.?])/g, '$1').trim()
}

const dayNumber = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86_400_000)

/** Replaces the planned notifications with the current texts (or removes the ones turned off). */
export async function scheduleDaily(prefs: NotifyPrefs, texts: NotifyTexts, now = new Date()): Promise<void> {
  if (!canNotify()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: IDS.lesson }, { id: IDS.inspiration }, ...LESSON_DAYS.map((id) => ({ id })), ...MORNING_DAYS.map((id) => ({ id }))] }).catch(() => undefined)
  const perm = await LocalNotifications.checkPermissions()
  const allowed = perm.display === 'granted'
  // the streak reminders are not a setting: they come by themselves whenever notifications are allowed
  await StreakAlarm.configure({
    on: allowed, times: STREAK_TIMES, lastDay: texts.lastDay, streak: texts.vars.streak, name: texts.vars.name,
    leftLabel: texts.streak.leftLabel, channel: texts.streak.channel, titles: texts.streak.titles, bodies: texts.streak.bodies
  }).catch(() => undefined)
  if (!allowed) return
  const list = []
  if (prefs.lesson.on) {
    const t = at(prefs.lesson.time)
    for (let i = 0; i < LESSON_DAYS.length; i++) {
      const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, t.hour, t.minute)
      if (when.getTime() <= now.getTime() + 30_000) continue
      const n = dayNumber(when)
      const body = variant(texts.lessonBodies, n, texts.vars)
      list.push({ id: LESSON_DAYS[i], title: variant(texts.lessonTitles, n, texts.vars), body, largeBody: body, schedule: { at: when, allowWhileIdle: true }, extra: { href: texts.lessonHref } })
    }
  }
  // a short greeting each morning (by itself, like the streak reminders)
  for (let i = 0; i < MORNING_DAYS.length && texts.morning.length; i++) {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, MORNING.hour, MORNING.minute)
    if (when.getTime() <= now.getTime() + 30_000) continue
    const line = variant(texts.morning, dayNumber(when), texts.vars)
    const [title, ...rest] = line.split(/(?<=[!.?])\s+/)
    list.push({ id: MORNING_DAYS[i], title, body: rest.join(' ') || ' ', schedule: { at: when, allowWhileIdle: true }, extra: { href: '/' } })
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
