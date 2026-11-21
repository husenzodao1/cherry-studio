import type { AiBlock } from '@/lib/aiCatalog'
import { ageOf, streak, type ProgressData } from '@/lib/progress'

import { apiUrl } from './base'
import type { Bundle } from './content'
import { journeyOf } from './journey'
import { hasPin } from './pin'
import { reviewStats } from './review'
import { supportToken } from './support'

/**
 * Mahliyo AI client: whether she can answer (the server has the AI set up), the conversation kept on
 * this phone, what the phone tells her about the learner (her lessons, results, weak points), a question
 * to her, and the reminders she sets (local notifications in the Android app).
 */

export interface AiTurn { role: 'user' | 'assistant'; content: string; at: string; tajik?: boolean; blocks?: AiBlock[] }
export interface AiAnswer { tajik: boolean; reply: string; blocks: AiBlock[] }

const KEY = 'dk.ai'
/** how much of the conversation the phone keeps, and how much goes with a question */
const KEEP = 40
const CONTEXT = 12
/** the most the summary of the learner may be (the server's limit) */
const ME_CAP = 4000

export function loadChat(): AiTurn[] {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '[]') as AiTurn[]
    return Array.isArray(t) ? t : []
  } catch {
    return []
  }
}
export function saveChat(turns: AiTurn[]) {
  try { localStorage.setItem(KEY, JSON.stringify(turns.slice(-KEEP))) } catch { /* storage blocked: the chat is not kept */ }
}

let ready: Promise<boolean> | null = null
/** Whether she can answer — asked once per opening of the app. */
export function aiReady(): Promise<boolean> {
  ready ??= fetch(apiUrl('/mahliyo/status'))
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .then((r: { ready?: boolean }) => !!r.ready)
    .catch(() => {
      ready = null
      return false
    })
  return ready
}

export class AiError extends Error {
  constructor(readonly status: number) { super(`mahliyo ${status}`) }
}

/** The phone's local time as ISO 8601 with its UTC offset (her "now", for reminders). */
export function localIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const off = -d.getTimezoneOffset()
  const a = Math.abs(off)
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${off >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`
}

/**
 * What Mahliyo is told about the learner with each question: who she is, how she studies, every course
 * she has begun with its lessons' results, her weak and unfinished lessons, the day's review. Only facts
 * kept on this phone; no codes, e-mail or PIN.
 */
export function aboutMe(name: string | undefined, progress: ProgressData, bundle: Bundle | null, now = new Date()): string {
  const out: string[] = []
  const age = ageOf(progress, now)
  out.push(`Name: ${name || '—'}${age !== null ? `; age ${age}` : ''}${progress.birthday ? `; birthday ${progress.birthday.slice(5)}` : ''}`)
  const days = progress.days.length
  out.push(`Study days: ${days}; streak now: ${streak(progress.days, now)} day(s)${days ? `; last studied ${progress.days[days - 1]}` : ''}`)
  out.push(`PIN lock: ${hasPin() ? 'on' : 'off'}`)
  const about = progress.about
  if (about) {
    const schools = (about.schools ?? []).map((s) => bundle?.schools.find((x) => x.slug === s)?.title ?? s)
    out.push(`Welcome answers: time a day ${about.time || '—'}; chosen schools ${schools.join(', ') || '—'}; heard of the app from ${about.source || '—'}`)
  }
  const lessons = Object.entries(progress.lessons)
  const quizzes = Object.values(progress.quizzes)
  const avg = quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.best, 0) / quizzes.length) : null
  out.push(`Lessons finished: ${lessons.filter(([, l]) => l.done).length}; begun not finished: ${lessons.filter(([, l]) => !l.done).length}; tests taken: ${quizzes.length}${avg !== null ? ` (average best ${avg}%, passed ${quizzes.filter((q) => q.passed).length})` : ''}`)
  out.push(`Saved lessons: ${Object.values(progress.bookmarks).filter((b) => b.on).length}; awards: ${Object.keys(progress.achievements).length}`)
  if (bundle) {
    try {
      courses(out, bundle, progress)
    } catch {
      /* a catalogue the phone could not read through: she is told the rest */
    }
  }
  return out.join('\n').slice(0, ME_CAP)
}

/** Every course she has begun, with the next lesson, and her weak, fair and unfinished lessons. */
function courses(out: string[], bundle: Bundle, progress: ProgressData) {
  const { legs, counts } = journeyOf(bundle, progress)
  out.push(`Progress map: green (80%+) ${counts.good}, yellow (50–79%) ${counts.fair}, red (below 50%) ${counts.weak}`)
  const r = reviewStats(bundle, progress)
  out.push(`Day's review (/review): ${r.today} question(s) due today, ${r.total} in her review`)
  const weak: string[] = []
  const fair: string[] = []
  const open: string[] = []
  for (const leg of legs) {
    const school = bundle.schools.find((s) => s.slug === leg.school)?.title ?? leg.school
    const next = leg.stops.find((s) => s.next)
    out.push(`Course "${leg.title}" (${school}): ${leg.done}/${leg.stops.length} lessons${next ? `; next: "${next.title}" (/lesson?id=${next.id})` : '; finished'}`)
    for (const s of leg.stops) {
      const tag = `"${s.title}" (/lesson?id=${s.id})`
      if (s.grade === 'weak') weak.push(`${tag} ${s.score}%`)
      else if (s.grade === 'fair') fair.push(`${tag} ${s.score}%`)
      else if (!s.grade && progress.lessons[s.id] && !progress.lessons[s.id].done) open.push(`${tag} read ${Math.round(progress.lessons[s.id].p)}%`)
    }
  }
  if (weak.length) out.push(`Weak (red, repeat these): ${weak.join('; ')}`)
  if (fair.length) out.push(`Fair (yellow): ${fair.join('; ')}`)
  if (open.length) out.push(`Unfinished: ${open.join('; ')}`)
  const last = progress.last && bundle.lessons[progress.last.lesson]
  if (last) out.push(`Last opened: "${last.title}" (/lesson?id=${progress.last!.lesson}) on ${progress.last!.at.slice(0, 10)}`)
}

/** Her answer to the conversation, whose last turn is the learner's question. */
export async function askMahliyo(turns: AiTurn[], who: { code?: string; name?: string; me?: string }): Promise<AiAnswer> {
  // the conversation sent starts with a question of hers (the server's rule)
  let recent = turns.slice(-CONTEXT)
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1)
  let tz: string | undefined
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* unknown zone */ }
  const res = await fetch(apiUrl('/mahliyo/ask'), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: supportToken(), ...who, now: localIso(), tz: tz?.slice(0, 64),
      turns: recent.map((t) => ({ role: t.role, content: t.content.slice(0, t.role === 'user' ? 1000 : 6000) }))
    })
  })
  if (!res.ok) throw new AiError(res.status)
  const a = (await res.json()) as Partial<AiAnswer>
  return { tajik: a.tajik !== false, reply: a.reply ?? '', blocks: a.blocks?.length ? a.blocks : [{ type: 'text', text: a.reply ?? '' }] }
}

/** A notification id for a reminder at `at` (the same time gives the same id: set twice, rings once). */
export const reminderId = (at: string) => 300_000 + (Math.floor(Date.parse(at) / 60_000) % 1_000_000)

/** Sets a reminder she was asked for: a notification at that time that opens Mahliyo's chat. */
export async function setReminder(b: Extract<AiBlock, { type: 'reminder' }>): Promise<'set' | 'denied' | 'past' | 'web'> {
  const when = new Date(b.at)
  if (!(when.getTime() > Date.now() + 30_000)) return 'past'
  const { allowNotifications, canNotify } = await import('./notify')
  if (!canNotify()) return 'web'
  if (!(await allowNotifications())) return 'denied'
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.schedule({
    notifications: [{ id: reminderId(b.at), title: b.title, body: b.text || b.title, largeBody: b.text || b.title, schedule: { at: when, allowWhileIdle: true }, extra: { href: '/mahliyo' } }]
  })
  return 'set'
}

/** Removes a reminder she set. */
export async function cancelReminder(at: string): Promise<void> {
  const { canNotify } = await import('./notify')
  if (!canNotify()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: reminderId(at) }] }).catch(() => undefined)
}
