'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { pack, unpack } from '@/lib/progressWire'
import { emptyProgress, isCode, localDay, mergeProgress, newCode, ProgressData, withDay } from '@/lib/progress'

import { encryptCode, isPassword, isUsername, normalizeUsername } from './account'
import { clearPin } from './pin'
import { clearRecovery } from './recovery'
import { accountAuth } from './accountAuth'
import { apiUrl } from './base'
import { useContent, type Bundle } from './content'
import { schedule as nextReview } from './review'

/**
 * The learner: a name and a 15-digit code, no e-mail or password. Everything is kept on the phone;
 * when online, progress is backed up under the code (merged, never overwritten), so typing the code
 * after reinstalling the app brings it all back.
 */

export interface Learner {
  name: string
  code: string
  /** login for signing in without the code (set once, online) */
  username?: string
  /** signed in with a temporary password from support: a new password must be chosen */
  mustChange?: boolean
  /** the Google account her profile is tied to (signing in with it gives the code back) */
  google?: string
  /** her e-mail, confirmed with a 6-digit code: signing in with it gives the code back */
  email?: string
  /** an e-mail given without a connection, confirmed once online */
  emailPending?: string
}
export interface AccountLink { google?: string; email?: string; emailPending?: string }
export type LoginResult = 'ok' | 'invalid' | 'locked' | 'taken' | 'offline' | 'error'
type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

interface LearnerApi {
  ready: boolean
  learner: Learner | null
  progress: ProgressData
  sync: SyncState
  /** a new profile; birthday as 'YYYY-MM-DD' */
  register: (name: string, birthday: string, account?: AccountLink) => Learner
  /** marks her e-mail as confirmed and tied to the profile */
  confirmEmail: (email: string) => void
  setBirthday: (birthday: string) => void
  /** a girl or a boy (kept with the profile, so it comes back with the account) */
  setGender: (gender: 'girl' | 'boy') => void
  /** takes over the profile an account (Google or e-mail) already keeps, as the server gave it */
  adopt: (profile: { code: string; name: string; data?: unknown }, account?: AccountLink) => void
  /** backs the profile up now (it must exist on the server before a login or Google is tied to it) */
  backupNow: () => Promise<void>
  /** whether a login can be taken */
  checkUsername: (username: string) => Promise<'free' | 'taken' | 'invalid' | 'offline'>
  /** sets (or changes) the login and password of this phone's learner */
  setLogin: (username: string, password: string) => Promise<LoginResult>
  /** keeps a login chosen without a connection on the phone; it is saved on its own once online */
  queueLogin: (username: string, password: string) => void
  /** a login waits on the phone for the connection */
  pendingLogin: boolean
  /** why a waiting login could not be saved (e.g. the name was taken meanwhile) */
  loginProblem: LoginResult | null
  signOut: () => void
  readLesson: (lessonId: string, percent: number) => void
  completeLesson: (lessonId: string) => void
  toggleBookmark: (lessonId: string) => void
  recordQuiz: (quizId: string, percent: number, passed: boolean) => void
  /** answers to the welcome questions (an empty object when skipped) */
  answerWelcome: (about: { time?: string; schools?: string[]; source?: string }) => void
  /** daily review answer: moves the question between Leitner boxes */
  recordReview: (questionId: string, correct: boolean) => void
}

const LEARNER_KEY = 'dk.learner'
// a login chosen offline; kept only on this phone until the server has it
const PENDING_KEY = 'dk.pending_login'
const PROBLEM_KEY = 'dk.login_problem'
const PROGRESS_KEY = 'dk.progress'
// time of the last backup this phone saw, per learner code (dk.synced:<code>)
const SYNCED_KEY = 'dk.synced'
const LearnerContext = createContext<LearnerApi | null>(null)

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the in-memory copy still works this session */
  }
}

const now = () => new Date().toISOString()
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** Awards published achievements whose rules the progress now satisfies. */
export function award(progress: ProgressData, bundle: Bundle | null): ProgressData {
  if (!bundle?.achievements?.length) return progress
  const done = new Set(Object.entries(progress.lessons).filter(([, l]) => l.done).map(([id]) => id))
  const passed = new Set(Object.entries(progress.quizzes).filter(([, q]) => q.passed).map(([id]) => id))
  const courseLessons = (courseId: string) =>
    (bundle.courses[courseId]?.modules ?? []).flatMap((m) => m.topics.flatMap((t) => t.lessons.map((l) => l.id)))
  const courseDone = (courseId: string) => {
    const ids = courseLessons(courseId)
    return ids.length > 0 && ids.every((id) => done.has(id))
  }
  let changed = false
  const achievements = { ...progress.achievements }
  for (const a of bundle.achievements) {
    if (achievements[a.key]) continue
    const r = a.rule
    const ok =
      r.type === 'lessons_completed' ? done.size >= (r.count ?? 1)
      : r.type === 'quizzes_passed' ? passed.size >= (r.count ?? 1)
      : r.type === 'quiz_passed' ? passed.has(r.quiz_id)
      : r.type === 'course_completed' ? courseDone(r.course_id)
      : r.type === 'school_completed' ? (() => {
          const s = Object.values(bundle.schoolDetails).find((x) => x.id === r.school_id)
          return !!s && s.courses.length > 0 && s.courses.every((c) => courseDone(c.id))
        })()
      : false
    if (ok) {
      achievements[a.key] = now()
      changed = true
    }
  }
  return changed ? { ...progress, achievements } : progress
}

export function LearnerProvider({ children }: { children: ReactNode }) {
  const { bundle } = useContent()
  const [ready, setReady] = useState(false)
  const [learner, setLearner] = useState<Learner | null>(null)
  const [progress, setProgress] = useState<ProgressData>(emptyProgress)
  const [sync, setSync] = useState<SyncState>('idle')
  const [pendingLogin, setPendingLogin] = useState(false)
  const [loginProblem, setLoginProblem] = useState<LoginResult | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef({ learner, progress })
  latest.current = { learner, progress }

  useEffect(() => {
    setLearner(readJson<Learner>(LEARNER_KEY))
    setPendingLogin(!!readJson(PENDING_KEY))
    setLoginProblem(readJson<LoginResult>(PROBLEM_KEY))
    const stored = ProgressData.safeParse(readJson(PROGRESS_KEY))
    setProgress(stored.success ? stored.data : emptyProgress())
    setReady(true)
  }, [])

  /**
   * Backs the progress up straight to Supabase (api_profile_push; no Vercel function on the way). Sent
   * with the time of the last backup this phone saw: saved at once when nobody wrote since, otherwise the
   * stored progress comes back, is merged here (mergeProgress) and sent again.
   */
  const pushNow = useCallback(async () => {
    const { learner: l } = latest.current
    if (!l) return
    if (navigator.onLine === false) {
      setSync('offline')
      return
    }
    const sb = accountAuth()
    if (!sb) return setSync('error')
    setSync('syncing')
    try {
      let data = latest.current.progress
      let base = readJson<string>(`${SYNCED_KEY}:${l.code}`)
      for (let attempt = 0; attempt < 3; attempt++) {
        // trimmed and, when large, compressed (lib/progressWire): many learners fit the free database
        const { data: r, error } = await sb.rpc('api_profile_push', { p_code: l.code, p_name: l.name, p_data: await pack(data), p_base: base })
        if (error) throw error
        const res = r as { conflict?: boolean; data?: unknown; updated_at: string }
        if (!res.conflict) {
          writeJson(`${SYNCED_KEY}:${l.code}`, res.updated_at)
          setSync('synced')
          // her parents' summary, when she gave them a link (web/offline/family.ts)
          if (localStorage.getItem('dk.parent.on') === '1') void import('./family').then((f) => f.pushSummary(l.code, data)).catch(() => undefined)
          return
        }
        // another phone (or an older backup) wrote meanwhile: take both, then send the merge
        const server = ProgressData.safeParse(await unpack(res.data))
        if (server.success) {
          data = mergeProgress(latest.current.progress, server.data)
          setProgress(data)
          writeJson(PROGRESS_KEY, data)
          latest.current = { ...latest.current, progress: data }
        }
        base = res.updated_at
      }
      setSync('error')
    } catch {
      setSync(isOffline() ? 'offline' : 'error')
    }
  }, [])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(pushNow, 2500)
  }, [pushNow])

  // back up on start, whenever the connection returns, and every 10 minutes
  useEffect(() => {
    if (!ready || !learner) return
    pushNow()
    window.addEventListener('online', pushNow)
    const every = setInterval(pushNow, 10 * 60 * 1000)
    return () => {
      window.removeEventListener('online', pushNow)
      clearInterval(every)
    }
  }, [ready, learner, pushNow])

  const update = useCallback((fn: (p: ProgressData) => ProgressData) => {
    setProgress((cur) => {
      const next = award(fn(cur), bundle)
      writeJson(PROGRESS_KEY, next)
      return next
    })
    schedule()
  }, [bundle, schedule])

  // newly published achievements may already be earned
  useEffect(() => {
    if (ready && bundle) update((p) => p)
  }, [ready, bundle, update])

  const api = useMemo<LearnerApi>(() => ({
    ready,
    learner,
    progress,
    sync,
    register: (name, birthday, account) => {
      const l: Learner = { name: name.trim().slice(0, 80), code: newCode((n) => crypto.getRandomValues(new Uint8Array(n))), ...account }
      writeJson(LEARNER_KEY, l)
      setLearner(l)
      // the login is usually set right after; it must see the new learner before React re-renders
      latest.current = { ...latest.current, learner: l }
      update((p) => ({ ...p, birthday, born: Number(birthday.slice(0, 4)) }))
      return l
    },
    setBirthday: (birthday) => update((p) => ({ ...p, birthday, born: Number(birthday.slice(0, 4)) })),
    setGender: (gender) => update((p) => (p.gender === gender ? p : { ...p, gender })),
    backupNow: pushNow,
    confirmEmail: (email) => {
      const cur = latest.current.learner
      if (!cur) return
      const { emailPending: _, ...rest } = cur
      const next = { ...rest, email }
      writeJson(LEARNER_KEY, next)
      setLearner(next)
      latest.current = { ...latest.current, learner: next }
    },
    adopt: (profile, account) => {
      const l: Learner = { name: profile.name, code: profile.code, ...account }
      writeJson(LEARNER_KEY, l)
      setLearner(l)
      latest.current = { ...latest.current, learner: l }
      // the backup may be compressed (lib/progressWire): opened, then merged with this phone's
      unpack(profile.data).catch(() => null).then((raw) => {
        const server = ProgressData.safeParse(raw)
        if (!server.success) return
        setProgress((cur) => {
          const merged = mergeProgress(cur, server.data)
          writeJson(PROGRESS_KEY, merged)
          return merged
        })
      })
    },
    checkUsername: async (raw) => {
      const u = normalizeUsername(raw)
      if (!isUsername(u)) return 'invalid'
      if (isOffline()) return 'offline'
      try {
        const mine = latest.current.learner?.code
        const hash = mine ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mine)))).map((b) => b.toString(16).padStart(2, '0')).join('') : ''
        const res = await fetch(apiUrl(`/profile/username?username=${encodeURIComponent(u)}${hash ? `&code_hash=${hash}` : ''}`))
        if (!res.ok) return 'offline'
        return ((await res.json()) as { free: boolean }).free ? 'free' : 'taken'
      } catch {
        return 'offline'
      }
    },
    setLogin: async (raw, password) => {
      const l = latest.current.learner
      const username = normalizeUsername(raw)
      if (!l || !isUsername(username) || !isPassword(password)) return 'invalid'
      if (isOffline()) return 'offline'
      try {
        await pushNow() // the profile must exist on the server before it gets a login
        const res = await fetch(apiUrl('/profile/login-set'), {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: l.code, username, password, code_enc: await encryptCode(l.code, password) })
        })
        if (res.status === 409) return 'taken'
        if (!res.ok) return res.status === 422 ? 'invalid' : 'error'
        const next = { ...l, username, mustChange: false }
        writeJson(LEARNER_KEY, next)
        setLearner(next)
        writeJson(PROBLEM_KEY, null)
        setLoginProblem(null)
        return 'ok'
      } catch {
        return isOffline() ? 'offline' : 'error'
      }
    },
    queueLogin: (username, password) => {
      writeJson(PENDING_KEY, { username: normalizeUsername(username), password })
      setPendingLogin(true)
    },
    pendingLogin,
    loginProblem,
    signOut: () => {
      // the PIN and its questions belong to the profile that left: the next one starts without them
      clearPin()
      clearRecovery()
      writeJson(LEARNER_KEY, null)
      writeJson(PROGRESS_KEY, null)
      writeJson(PENDING_KEY, null)
      setPendingLogin(false)
      setLearner(null)
      setProgress(emptyProgress())
    },
    readLesson: (id, percent) => update((p) => {
      const cur = p.lessons[id]
      const pct = Math.max(cur?.p ?? 0, Math.min(100, Math.round(percent)))
      if (cur && cur.p >= pct && p.last?.lesson === id) return withDay(p)
      return withDay({ ...p, lessons: { ...p.lessons, [id]: { ...cur, p: pct, at: now() } }, last: { lesson: id, at: now() } })
    }),
    completeLesson: (id) => update((p) => withDay({
      ...p,
      lessons: { ...p.lessons, [id]: { p: 100, done: p.lessons[id]?.done ?? now(), at: now() } },
      last: { lesson: id, at: now() }
    })),
    toggleBookmark: (id) => update((p) => ({ ...p, bookmarks: { ...p.bookmarks, [id]: { on: !p.bookmarks[id]?.on, at: now() } } })),
    recordQuiz: (id, percent, passed) => update((p) => {
      const cur = p.quizzes[id]
      return withDay({
        ...p,
        quizzes: { ...p.quizzes, [id]: { best: Math.max(cur?.best ?? 0, percent), passed: (cur?.passed ?? false) || passed, tries: (cur?.tries ?? 0) + 1, at: now() } }
      })
    })
    ,
    answerWelcome: (about) => update((p) => ({ ...p, about: { ...about, at: now() } })),
    recordReview: (qid, correct) => update((p) => {
      const today = localDay()
      return withDay({ ...p, review: { ...p.review, [qid]: { ...nextReview(p.review[qid]?.box, correct, today), at: now() } } })
    })
  }), [ready, learner, progress, sync, update, pushNow, pendingLogin, loginProblem])

  // a login chosen offline is saved as soon as the phone is online
  const apiRef = useRef(api)
  apiRef.current = api
  useEffect(() => {
    if (!ready || !learner || learner.username || !pendingLogin) return
    let busy = false
    const trySave = async () => {
      const pending = readJson<{ username: string; password: string }>(PENDING_KEY)
      if (busy || !pending || navigator.onLine === false) return
      busy = true
      const r = await apiRef.current.setLogin(pending.username, pending.password)
      busy = false
      if (r === 'offline' || r === 'error') return // try again later
      writeJson(PENDING_KEY, null)
      setPendingLogin(false)
      writeJson(PROBLEM_KEY, r === 'ok' ? null : r)
      setLoginProblem(r === 'ok' ? null : r)
    }
    trySave()
    window.addEventListener('online', trySave)
    const every = setInterval(trySave, 60_000)
    return () => {
      window.removeEventListener('online', trySave)
      clearInterval(every)
    }
  }, [ready, learner, pendingLogin])

  return <LearnerContext.Provider value={api}>{children}</LearnerContext.Provider>
}

export function useLearner(): LearnerApi {
  const ctx = useContext(LearnerContext)
  if (!ctx) throw new Error('useLearner outside LearnerProvider')
  return ctx
}

/** Lesson ids of a course in reading order. */
export function courseLessonIds(bundle: Bundle | null, courseId: string): string[] {
  return (bundle?.courses[courseId]?.modules ?? []).flatMap((m) => m.topics.flatMap((t) => t.lessons.filter((l) => !l.locked).map((l) => l.id)))
}

export function courseProgress(bundle: Bundle | null, progress: ProgressData, courseId: string) {
  const ids = courseLessonIds(bundle, courseId)
  const completed = ids.filter((id) => progress.lessons[id]?.done).length
  return { completed, total: ids.length, percent: ids.length ? Math.round((completed * 100) / ids.length) : 0 }
}
