import { useSyncExternalStore } from 'react'

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
 * The conversation is kept by the app, not by her screen: a question asked goes on in the background —
 * the learner may leave the chat, or close the app and open it again, and her answer is waiting (the
 * tab bar shows she is thinking, then that she answered). A question can be stopped, edited and asked
 * again; without internet the chat says so and waits.
 */

export interface AiTurn { role: 'user' | 'assistant'; content: string; at: string; tajik?: boolean; blocks?: AiBlock[]; files?: AiFileView[] }
/** A picture or a file sent with a question, as the chat keeps it (a small picture, no data). */
export interface AiFileView { mime: string; name: string; thumb?: string }
/** …and as it goes to her (base64). */
export interface AiUpload extends AiFileView { data: string }

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

/* ---------------------------------------------------------------- the conversation, kept by the app */

/** Why there is no answer to the last question: no internet, too many questions, she could not, or stopped. */
export type AiProblem = 'offline' | 'limit' | 'unavailable' | 'stopped'
export interface AiState {
  turns: AiTurn[]
  /** a question she is answering: its id once the server has it, and since when */
  pending: { id: string | null; since: number } | null
  problem: AiProblem | null
  /** the index of an answer that has just come (drawn word by word, its reminder set) */
  fresh: number
  /** she answered while her chat was not open */
  unseen: boolean
  online: boolean
}
export interface Who { code?: string; name?: string; me?: string }

const PENDING_KEY = 'dk.ai-pending'
/** how long she may take before the question counts as unanswered (the server gives up after 5 minutes) */
const PATIENCE = 5.5 * 60_000
const EMPTY: AiState = { turns: [], pending: null, problem: null, fresh: -1, unseen: false, online: true }
let state: AiState = EMPTY
let started = false
const listeners = new Set<() => void>()
/** the wait that is current: a new question or a stop ends the one before */
let run = 0
/** the pictures and files of the last question (for "try again"; not kept on the phone) */
let lastFiles: AiUpload[] = []
/** how many of her chat screens are open (an answer that comes with none open is "unseen") */
let watching = 0
/** whether a wait is still the current one (a function, so the check is made anew after every await) */
const current = (my: number) => my === run
const offline = () => navigator.onLine === false

function set(patch: Partial<AiState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l()
}
function savePending(p: AiState['pending']) {
  try {
    if (p) localStorage.setItem(PENDING_KEY, JSON.stringify(p))
    else localStorage.removeItem(PENDING_KEY)
  } catch { /* storage blocked: the wait is not kept across openings */ }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  let pending: AiState['pending'] = null
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch { /* none */ }
  state = { ...state, turns: loadChat(), online: navigator.onLine !== false }
  // a question asked before the app was closed: her answer is fetched now
  if (pending?.id && Date.now() - pending.since < PATIENCE && state.turns[state.turns.length - 1]?.role === 'user') {
    state = { ...state, pending }
    void wait(pending.id, pending.since, ++run)
  } else if (pending) {
    savePending(null)
    if (state.turns[state.turns.length - 1]?.role === 'user') state = { ...state, problem: 'unavailable' }
  }
  window.addEventListener('online', () => set({ online: true, problem: state.problem === 'offline' ? null : state.problem }))
  window.addEventListener('offline', () => set({ online: false }))
}

function subscribe(l: () => void) {
  start()
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** The conversation and what is happening in it (the same for every screen). */
export function useMahliyo(): AiState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY)
}

/** Her chat is open (while the returned function is not called): answers coming are seen. */
export function watch(): () => void {
  watching++
  if (state.unseen) set({ unseen: false })
  return () => { watching-- }
}
/** The fresh answer was drawn: it is not drawn word by word again. */
export function drawn() {
  if (state.fresh >= 0) set({ fresh: -1 })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new AiError(res.status)
  return (await res.json()) as T
}

/**
 * Asks her: the conversation so far (from `editFrom` on, when a question is edited, the rest is left out)
 * and the new question. She answers in the background.
 */
export async function ask(question: string, who: Who, editFrom?: number, files: AiUpload[] = []) {
  const q = question.trim()
  if (!q || state.pending) return
  if (offline()) return set({ problem: 'offline', online: false })
  lastFiles = files
  const views = files.map(({ mime, name, thumb }) => ({ mime, name, thumb }))
  const turns: AiTurn[] = [...(editFrom === undefined ? state.turns : state.turns.slice(0, editFrom)),
    { role: 'user', content: q, at: new Date().toISOString(), ...(views.length ? { files: views } : {}) }]
  const my = ++run
  const pending = { id: null, since: Date.now() }
  saveChat(turns)
  savePending(pending)
  set({ turns, pending, problem: null, fresh: -1 })
  // the conversation sent starts with a question of hers (the server's rule)
  let recent = turns.slice(-CONTEXT)
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1)
  let tz: string | undefined
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* unknown zone */ }
  try {
    const { id } = await post<{ id: string }>('/mahliyo/ask', {
      token: supportToken(), ...who, now: localIso(), tz: tz?.slice(0, 64), background: true,
      // an earlier question's pictures are named, not sent again
      turns: recent.map((t, i) => ({
        role: t.role,
        content: (i < recent.length - 1 && t.files?.length ? `${t.content}\n[📎 ${t.files.map((f) => f.name).join(', ')}]` : t.content).slice(0, t.role === 'user' ? 1000 : 6000)
      })),
      ...(files.length ? { files: files.map(({ mime, name, data }) => ({ mime, name, data })) } : {})
    })
    if (!current(my)) return void post('/mahliyo/stop', { token: supportToken(), id }).catch(() => undefined)
    savePending({ id, since: pending.since })
    set({ pending: { id, since: pending.since } })
    await wait(id, pending.since, my)
  } catch (e) {
    if (!current(my)) return
    end(e instanceof AiError && e.status === 429 ? 'limit' : offline() ? 'offline' : 'unavailable')
  }
}

function end(problem: AiProblem | null, patch: Partial<AiState> = {}) {
  savePending(null)
  set({ pending: null, problem, ...patch })
}

/** Waits for her answer to question `id` (asking the server now and then; without internet, it waits). */
async function wait(id: string, since: number, my: number) {
  let every = 900
  while (current(my)) {
    await sleep(every)
    every = Math.min(every * 1.3, 3000)
    if (!current(my)) return
    if (Date.now() - since > PATIENCE) return end('unavailable')
    if (offline()) continue
    let r: { status: 'pending' | 'done' | 'failed'; reason?: string; tajik?: boolean; reply?: string; blocks?: AiBlock[] | null }
    try {
      r = await post('/mahliyo/answer', { token: supportToken(), id })
    } catch (e) {
      // the connection dropped or the server stumbled: ask again; a question it does not know: give up
      if (e instanceof AiError && e.status < 500 && e.status !== 429) return current(my) ? end('unavailable') : undefined
      continue
    }
    if (!current(my) || r.status === 'pending') continue
    if (r.status === 'failed') return end(r.reason === 'stopped' ? 'stopped' : 'unavailable')
    const blocks = r.blocks?.length ? r.blocks : [{ type: 'text' as const, text: r.reply ?? '' }]
    const turns: AiTurn[] = [...state.turns, { role: 'assistant', content: r.reply ?? '', tajik: r.tajik !== false, blocks, at: new Date().toISOString() }]
    saveChat(turns)
    end(null, { turns, fresh: turns.length - 1, unseen: watching === 0 })
    void tell(r.reply ?? '')
    return
  }
}

/** Her answer came while the app was in the background: a notification (when notifications are allowed). */
async function tell(reply: string) {
  if (!document.hidden) return
  const { canNotify } = await import('./notify')
  if (!canNotify()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
  const body = reply.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160)
  await LocalNotifications.schedule({ notifications: [{ id: 299_999, title: 'Маҳлиё AI', body, largeBody: body, schedule: { at: new Date(Date.now() + 500) }, extra: { href: '/mahliyo' } }] }).catch(() => undefined)
}

/** Stops the question she is answering (her late answer is not kept). */
export function stop() {
  const p = state.pending
  if (!p) return
  run++
  if (p.id) void post('/mahliyo/stop', { token: supportToken(), id: p.id }).catch(() => undefined)
  end('stopped')
}

/** Asks the last question again (after it was stopped or not answered). */
export function retry(who: Who) {
  const last = state.turns[state.turns.length - 1]
  if (last?.role === 'user') void ask(last.content, who, state.turns.length - 1, last.files?.length ? lastFiles : [])
}

/** A new conversation. */
export function clear() {
  stop()
  saveChat([])
  set({ turns: [], problem: null, fresh: -1, unseen: false })
}

/** Her answer as text to copy: her words and steps, links by their names (no pictures or reminders). */
export function copyOf(t: AiTurn): string {
  if (!t.blocks?.length) return t.content
  return t.blocks.flatMap((b) => {
    switch (b.type) {
      case 'text': return [b.text]
      case 'steps': return [[b.title, ...b.items.map((s, i) => `${i + 1}. ${s}`)].filter(Boolean).join('\n')]
      case 'link': return [`${b.label}: ${b.to.startsWith('/') ? `https://dukhtari-khubam.vercel.app${b.to}` : b.to}`]
      case 'screen': return b.caption ? [b.caption] : []
      case 'reminder': return [`${b.title}: ${b.text}`]
    }
  }).join('\n\n')
}

/** Copies text (the clipboard, or the old way where it is not allowed). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = Object.assign(document.createElement('textarea'), { value: text })
      area.style.cssText = 'position:fixed;opacity:0'
      document.body.append(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

/* ---------------------------------------------------------------- pictures and files for her */

export const MAX_FILES = 3
/** what may be sent: pictures (made smaller, as JPEG), PDF and text files up to 3 MB */
const FILE_BYTES = 3 * 1024 * 1024
const PICTURE_SIDE = 1600
const THUMB_SIDE = 180
/** all of a question's files together (base64), under the server's request limit */
export const FILES_CAP = 4_200_000

export class FileProblem extends Error {
  constructor(readonly kind: 'type' | 'big') { super(kind) }
}

const base64Of = (file: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1] ?? '')
  r.onerror = () => fail(r.error)
  r.readAsDataURL(file)
})

/** A picture drawn at most `side` pixels wide or high, as a JPEG data URL. */
async function shrink(file: Blob, side: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => fail(new FileProblem('type'))
      i.src = url
    })
    const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * k))
    c.height = Math.max(1, Math.round(img.naturalHeight * k))
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
    g.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A chosen file made ready for her: a picture smaller and as JPEG (with a little copy for the chat). */
export async function prepareFile(file: File): Promise<AiUpload> {
  const name = (file.name || 'file').slice(0, 120)
  if (file.type.startsWith('image/')) {
    const picture = await shrink(file, PICTURE_SIDE, 0.82)
    return { mime: 'image/jpeg', name, data: picture.split(',')[1], thumb: await shrink(file, THUMB_SIDE, 0.7) }
  }
  if (file.type !== 'application/pdf' && file.type !== 'text/plain') throw new FileProblem('type')
  if (file.size > FILE_BYTES) throw new FileProblem('big')
  return { mime: file.type, name, data: await base64Of(file) }
}
