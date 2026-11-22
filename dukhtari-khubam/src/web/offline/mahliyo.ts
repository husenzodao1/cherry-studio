import { compressToUTF16, decompressFromUTF16 } from 'lz-string'
import { useSyncExternalStore } from 'react'

import type { AiBlock } from '@/lib/aiCatalog'
import { ageOf, streak, type ProgressData } from '@/lib/progress'

import { apiUrl, SITE } from './base'
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

export interface AiTurn {
  role: 'user' | 'assistant'; content: string; at: string; tajik?: boolean; blocks?: AiBlock[]; files?: AiFileView[]
  /** her answer's question on the server (to mark it 👍/👎), and how the learner marked it */
  id?: string; rating?: 1 | -1
  /** the account a question was asked from (its answer belongs to the same) */
  account?: string
}

/** whose each turn is: a question's account, and its answer's the same */
const ownersOf = (turns: AiTurn[]) => {
  let owner: string | undefined
  return turns.map((t) => (t.role === 'user' ? (owner = t.account) : owner))
}
/** Whether question `i` is the first one asked after the account on this phone was changed. */
export function accountChanged(turns: AiTurn[], i: number): boolean {
  const mine = turns[i]?.account
  if (turns[i]?.role !== 'user' || !mine) return false
  for (let j = i - 1; j >= 0; j--) if (turns[j].role === 'user' && turns[j].account) return turns[j].account !== mine
  return false
}
/** A picture or a file sent with a question, as the chat keeps it (a small picture, no data). */
export interface AiFileView { mime: string; name: string; thumb?: string }
/** …and as it goes to her (base64). */
export interface AiUpload extends AiFileView { data: string }

/** the chats kept on this phone (newest first), and the one open; the single chat of earlier versions */
const CHATS_KEY = 'dk.ai.chats'
const CURRENT_KEY = 'dk.ai.current'
const OLD_KEY = 'dk.ai'
/** how many chats the phone keeps, how much of each, and how much goes with a question */
const MAX_CHATS = 30
const KEEP = 40
const CONTEXT = 12
/** the most the summary of the learner may be (the server's limit) */
const ME_CAP = 4000

export interface AiChat { id: string; title: string; at: string; turns: AiTurn[]; archived?: boolean }
/** a chat as the history lists it */
export type AiChatMeta = Omit<AiChat, 'turns'>

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`)
/** a chat's name: its first question */
const titleOf = (turns: AiTurn[]) => (turns.find((t) => t.role === 'user')?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)

/**
 * The chats are kept compressed (lz-string: a few times smaller), and only for a week after their last
 * message — a Premium account keeps them (FOREVER_KEY, set by her chat when the account is Premium).
 */
const PACKED = 'lz:'
const FOREVER_KEY = 'dk.ai.forever'
const KEEP_DAYS = 7
const forever = () => {
  try { return localStorage.getItem(FOREVER_KEY) === '1' } catch { return false }
}
/** a chat whose last message is older than a week is let go (not for Premium) */
const fresh = (c: AiChat, now = Date.now()) => forever() || now - Date.parse(c.at) < KEEP_DAYS * 86_400_000
export function keepChatsForever(on: boolean) {
  try {
    if (on) localStorage.setItem(FOREVER_KEY, '1')
    else localStorage.removeItem(FOREVER_KEY)
  } catch { /* storage blocked */ }
}

function readChats(): AiChat[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    const list = JSON.parse((raw?.startsWith(PACKED) ? decompressFromUTF16(raw.slice(PACKED.length)) : raw) || 'null') as AiChat[] | null
    if (Array.isArray(list)) return list.filter((c) => c && typeof c.id === 'string' && Array.isArray(c.turns) && fresh(c))
    // the one chat of earlier versions becomes the first in the history
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || '[]') as AiTurn[]
    return Array.isArray(old) && old.length ? [{ id: newId(), title: titleOf(old), at: old[old.length - 1].at ?? new Date().toISOString(), turns: old }] : []
  } catch {
    return []
  }
}
function writeChats(list: AiChat[]) {
  try {
    localStorage.setItem(CHATS_KEY, PACKED + compressToUTF16(JSON.stringify(list.filter((c) => fresh(c)).slice(0, MAX_CHATS))))
    localStorage.removeItem(OLD_KEY)
  } catch { /* storage blocked: the chats are not kept */ }
}

let ready: Promise<boolean> | null = null
/** Whether she can answer — asked once per opening of the app. */
export function aiReady(): Promise<boolean> {
  // only "she can" is kept; "not" (or no answer) is asked again next time
  ready ??= fetch(apiUrl('/mahliyo/status'))
    .then((r) => (r.ok ? r.json() : { ready: false }))
    .then((r: { ready?: boolean }) => {
      if (!r.ready) ready = null
      return !!r.ready
    })
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

/**
 * Sets a reminder she was asked for: at that time she calls — her call screen while the app is open, and in
 * the phone app an incoming-call notification that rings over the lock screen even with the app closed.
 */
export async function setReminder(b: Extract<AiBlock, { type: 'reminder' }>): Promise<'set' | 'denied' | 'past' | 'web'> {
  const when = new Date(b.at)
  if (!(when.getTime() > Date.now() + 30_000)) return 'past'
  const { allowNotifications, canNotify } = await import('./notify')
  const native = canNotify()
  const allowed = native && (await allowNotifications())
  const { planCall } = await import('./call')
  planCall({ id: reminderId(b.at), at: when.toISOString(), title: b.title, text: b.text })
  return !native ? 'web' : allowed ? 'set' : 'denied'
}

/** Removes a reminder she set (and her call). */
export async function cancelReminder(at: string): Promise<void> {
  const { unplanCall } = await import('./call')
  unplanCall(reminderId(at))
  const { canNotify } = await import('./notify')
  if (!canNotify()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  await LocalNotifications.cancel({ notifications: [{ id: reminderId(at) }] }).catch(() => undefined)
}

/* ---------------------------------------------------------------- the conversation, kept by the app */

/** Why there is no answer to the last question: no internet, too many questions, she could not, or stopped. */
export type AiProblem = 'offline' | 'limit' | 'unavailable' | 'stopped'
export interface AiState {
  /** the open chat, and its conversation */
  chat: string
  turns: AiTurn[]
  /** every chat kept, newest first (the history) */
  chats: AiChatMeta[]
  /** a question she is answering: its id once the server has it, since when, and in which chat */
  /** `books`: the staff gave her books, so a long wait is her searching them */
  pending: { id: string | null; since: number; chat: string; books?: boolean } | null
  problem: AiProblem | null
  /** the index of an answer that has just come (drawn word by word, its reminder set) */
  fresh: number
  /** she answered while her chat was not open */
  unseen: boolean
  online: boolean
}
export interface Who { code?: string; name?: string; me?: string; account?: string }

const PENDING_KEY = 'dk.ai-pending'
/** how long she may take before the question counts as unanswered (the server gives up after 5 minutes) */
const PATIENCE = 5.5 * 60_000
const EMPTY: AiState = { chat: '', turns: [], chats: [], pending: null, problem: null, fresh: -1, unseen: false, online: true }
let chats: AiChat[] = []
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

const metaOf = (list: AiChat[]): AiChatMeta[] => list.map(({ id, title, at, archived }) => ({ id, title, at, ...(archived ? { archived } : {}) }))
const turnsOf = (id: string) => chats.find((c) => c.id === id)?.turns ?? []

/** Keeps a chat's conversation (the newest chat first in the history; talked in again, it leaves the archive). */
function keep(id: string, turns: AiTurn[]) {
  const rest = chats.filter((c) => c.id !== id)
  chats = turns.length ? [{ id, title: titleOf(turns), at: new Date().toISOString(), turns: turns.slice(-KEEP) }, ...rest] : rest
  writeChats(chats)
  return metaOf(chats)
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  let pending: AiState['pending'] = null
  try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null') } catch { /* none */ }
  chats = readChats()
  let chat = ''
  try { chat = localStorage.getItem(CURRENT_KEY) || '' } catch { /* none */ }
  // the chat open last (a new one not yet asked in is not in the history: it opens empty)
  if (!chat) chat = chats[0]?.id ?? newId()
  state = { ...state, chat, turns: turnsOf(chat), chats: metaOf(chats), online: navigator.onLine !== false }
  // a question asked before the app was closed: her answer is fetched now
  const asked = pending && turnsOf(pending.chat ?? chat)
  const id = pending?.id
  if (pending && id && Date.now() - pending.since < PATIENCE && asked?.[asked.length - 1]?.role === 'user') {
    pending = { ...pending, chat: pending.chat ?? chat }
    state = { ...state, pending }
    void wait(id, pending.since, ++run)
  } else if (pending) {
    savePending(null)
    if (asked?.[asked.length - 1]?.role === 'user' && (pending.chat ?? chat) === chat) state = { ...state, problem: 'unavailable' }
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

/** the longest question (a whole problem may be pasted in) */
export const QUESTION_CAP = 4000

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
    { role: 'user', content: q, at: new Date().toISOString(), ...(views.length ? { files: views } : {}), ...(who.account ? { account: who.account } : {}) }]
  const my = ++run
  const chat = state.chat
  const pending = { id: null, since: Date.now(), chat }
  savePending(pending)
  set({ turns, chats: keep(chat, turns), pending, problem: null, fresh: -1 })
  // the conversation sent starts with a question of hers (the server's rule)
  // what was said from another account on this phone is not hers: it is not sent
  const owners = ownersOf(turns)
  let recent = turns.filter((_, i) => !who.account || !owners[i] || owners[i] === who.account).slice(-CONTEXT)
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1)
  let tz: string | undefined
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* unknown zone */ }
  try {
    const { account: _account, ...asker } = who
    const { id, books } = await post<{ id: string; books?: boolean }>('/mahliyo/ask', {
      token: supportToken(), ...asker, now: localIso(), tz: tz?.slice(0, 64), background: true,
      // an earlier question's pictures are named, not sent again
      turns: recent.map((t, i) => ({
        role: t.role,
        content: (i < recent.length - 1 && t.files?.length ? `${t.content}\n[📎 ${t.files.map((f) => f.name).join(', ')}]` : t.content).slice(0, t.role === 'user' ? QUESTION_CAP : 6000)
      })),
      ...(files.length ? { files: files.map(({ mime, name, data }) => ({ mime, name, data })) } : {})
    })
    if (!current(my)) return void post('/mahliyo/stop', { token: supportToken(), id }).catch(() => undefined)
    savePending({ id, since: pending.since, chat, books: !!books })
    set({ pending: { id, since: pending.since, chat, books: !!books } })
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

type AnswerState = { status: 'pending' | 'done' | 'failed'; reason?: string; tajik?: boolean; reply?: string; blocks?: AiBlock[] | null }

const DB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const DB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
/** the phone's token as the database keeps it (sha-256, hex) */
async function tokenHash(): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(supportToken() ?? ''))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
/**
 * Whether her answer is ready: asked straight from the database (as the content stamp is), not through
 * the app's server — waiting costs the server nothing, however many learners wait. The server is asked
 * only when the database cannot be reached this way.
 */
async function readAnswer(id: string): Promise<AnswerState> {
  if (DB_URL && DB_KEY && typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const res = await fetch(`${DB_URL}/rest/v1/rpc/api_mahliyo_result`, {
        method: 'POST',
        headers: { apikey: DB_KEY, authorization: `Bearer ${DB_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_id: id, p_token_hash: await tokenHash() }),
        cache: 'no-store'
      })
      if (res.ok) {
        const r = (await res.json()) as AnswerState | null
        if (r && typeof r.status === 'string') return r
        throw new AiError(404)
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new AiError(res.status)
    } catch (e) {
      if (e instanceof AiError) throw e
      /* the database could not be reached this way: the server is asked */
    }
  }
  return post<AnswerState>('/mahliyo/answer', { token: supportToken(), id })
}

/** Waits for her answer to question `id` (asking the server now and then; without internet, it waits). */
async function wait(id: string, since: number, my: number) {
  while (current(my)) {
    // often while an answer is likely (she usually answers in seconds), then less often
    await sleep(Date.now() - since < 40_000 ? 1000 : 2500)
    if (!current(my)) return
    if (Date.now() - since > PATIENCE) return end('unavailable')
    if (offline()) continue
    let r: AnswerState
    try {
      r = await readAnswer(id)
    } catch (e) {
      // the connection dropped or the server stumbled: ask again; a question it does not know: give up
      if (e instanceof AiError && e.status < 500 && e.status !== 429) return current(my) ? end('unavailable') : undefined
      continue
    }
    if (!current(my) || r.status === 'pending') continue
    if (r.status === 'failed') return end(r.reason === 'stopped' ? 'stopped' : 'unavailable')
    const blocks = r.blocks?.length ? r.blocks : [{ type: 'text' as const, text: r.reply ?? '' }]
    // into the chat she was asked in (the learner may have opened another meanwhile)
    const chat = state.pending?.chat ?? state.chat
    const turns: AiTurn[] = [...turnsOf(chat), { role: 'assistant', content: r.reply ?? '', tajik: r.tajik !== false, blocks, at: new Date().toISOString(), id }]
    const here = chat === state.chat
    end(null, { chats: keep(chat, turns), ...(here ? { turns, fresh: turns.length - 1 } : {}), unseen: watching === 0 || !here })
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
  const said = reply.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)
  const body = `Ҷавоби шумо аз Маҳлиё омад: ${said}`
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

/** Opens a chat from the history. */
export function openChat(id: string) {
  if (!chats.some((c) => c.id === id) || id === state.chat) return
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* not kept */ }
  set({ chat: id, turns: turnsOf(id), problem: null, fresh: -1 })
}

/** A new chat (the one open stays in the history). */
export function newChat() {
  if (!state.turns.length) return
  const id = newId()
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* not kept */ }
  set({ chat: id, turns: [], problem: null, fresh: -1 })
}

/** Puts a chat in the archive, or takes it out (the one open, archived: a new one opens). */
/**
 * A chat shared as a link: its words (her questions, Mahliyo's answers as blocks; no pictures or files) go
 * to the server, and the link shows them to anyone who has it. Resolves to the link.
 */
export async function shareChat(id: string): Promise<string> {
  const chat = chats.find((c) => c.id === id)
  if (!chat?.turns.length) throw new AiError(404)
  const turns = chat.turns.slice(-60).map((t) => (t.role === 'user'
    ? { role: 'user', content: t.content.slice(0, QUESTION_CAP) }
    : { role: 'assistant', content: t.content.slice(0, 6000), ...(t.blocks?.length ? { blocks: t.blocks.filter((b) => b.type !== 'reminder') } : {}) }))
  const { id: shared } = await post<{ id: string }>('/mahliyo/share', { token: supportToken(), title: chat.title.slice(0, 200), turns })
  return `${SITE}/share?id=${shared}`
}

/** The learner marks her answer (turn `i` of the open chat) 👍 or 👎; the same again takes it back. The staff see it. */
export function rate(i: number, rating: 1 | -1) {
  const turn = state.turns[i]
  if (!turn || turn.role !== 'assistant') return
  const next = turn.rating === rating ? undefined : rating
  const turns = state.turns.map((t, n) => (n === i ? { ...t, rating: next } : t))
  set({ turns, chats: keep(state.chat, turns) })
  if (turn.id) void post('/mahliyo/rate', { token: supportToken(), id: turn.id, rating: next ?? null }).catch(() => undefined)
}

export function archiveChat(id: string, archived = true) {
  chats = chats.map((c) => (c.id === id ? { ...c, archived } : c))
  writeChats(chats)
  if (archived && id === state.chat) {
    const chat = newId()
    try { localStorage.setItem(CURRENT_KEY, chat) } catch { /* not kept */ }
    set({ chats: metaOf(chats), chat, turns: [], problem: null, fresh: -1 })
  } else set({ chats: metaOf(chats) })
}

/** Removes a chat for good (the one open: a new one opens). */
export function removeChat(id: string) {
  if (state.pending?.chat === id) stop()
  chats = chats.filter((c) => c.id !== id)
  writeChats(chats)
  if (id === state.chat) {
    const chat = newId()
    try { localStorage.setItem(CURRENT_KEY, chat) } catch { /* not kept */ }
    set({ chats: metaOf(chats), chat, turns: [], problem: null, fresh: -1 })
  } else set({ chats: metaOf(chats) })
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
