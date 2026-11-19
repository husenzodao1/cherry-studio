'use client'

import { get, set } from 'idb-keyval'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { Asset, Block } from '../components/Blocks'
import { usePrefs } from '../prefs'
import { filterBundleForAge } from './age'
import { apiUrl } from './base'
import { bundleImageUrls, prefetchMedia } from './media'

/** After a content update, save its images on the phone without blocking the screen. */
function keepImages(bundle: Bundle) {
  setTimeout(() => prefetchMedia(bundleImageUrls(bundle)).catch(() => undefined), 3000)
}

/**
 * The published catalogue lives on the phone (IndexedDB), so every screen works offline.
 * On start the stored copy is shown at once; when online the app asks the server for a newer one
 * (ETag) and swaps it in. The APK also ships a copy (public/offline/bundle-<locale>.json) so the very
 * first launch works without a connection.
 */

export interface QuizCard { id: string; title: string; question_count: number }
export interface LessonRow { id: string; title: string; estimated_minutes?: number | null; locked: boolean }
export interface SchoolSummary {
  id: string; slug: string; title: string; description?: string | null; theme_color?: string | null; course_count: number
  icon?: { url: string | null; alt?: string | null } | null
}
export interface SchoolDetail extends SchoolSummary {
  courses: { id: string; title: string; description?: string | null; locked: boolean; module_count: number }[]
  quizzes: QuizCard[]
}
export interface Course {
  id: string; title: string; description?: string | null; goals: string[]; level?: string | null; locked: boolean
  estimated_minutes?: number | null; school?: { id: string; slug: string; title: string }
  prerequisites: { id: string; title: string }[]
  quizzes: QuizCard[]
  modules: { id: string; title: string; description?: string | null; quizzes: QuizCard[]
    topics: { id: string; title: string; quizzes: QuizCard[]; lessons: LessonRow[] }[] }[]
}
export interface Lesson {
  id: string; title: string; summary?: string | null; locked: boolean; locale: string; estimated_minutes?: number | null
  context: { school: { id?: string; title: string }; course: { id: string; title: string } }
  blocks: Block[]; assets: Record<string, Asset>
  position: { index: number | null; total: number }
  prev_lesson_id?: string | null; next_lesson_id?: string | null
}
export interface OfflineOption { id: string; text?: string | null; side?: 'left' | 'right' | null; media?: Asset | null }
export interface OfflineQuestion { id: string; type: string; points: number; prompt: string; hint?: string | null; section?: string | null; media?: Asset | null; options: OfflineOption[] }
export interface Grading {
  partial_credit: boolean; penalty: number; case_sensitive: boolean; ignore_punctuation: boolean
  key: { correct_option_ids?: string[]; correct_order?: string[]; matching?: Record<string, string>; accepted_answers?: Record<string, string[]> }
  explanation_correct?: string | null; explanation_incorrect?: string | null; related_lesson_id?: string | null
}
export interface OfflineQuiz {
  locale: string
  quiz: { id: string; title: string; instructions?: string | null; pass_score_percent: number; show_explanations: string; show_correct_answers: string; question_count: number }
  questions: OfflineQuestion[]
  settings: { shuffle_questions: boolean; shuffle_options: boolean; allow_retry: boolean; max_attempts?: number | null; completion_text?: string | null }
  grading: Record<string, Grading>
}
export interface Achievement { id: string; key: string; title: string; description?: string | null; rule: Record<string, any>; icon?: { url: string | null } | null }
export interface Bundle {
  v: 1; locale: string; version: string; generated_at: string
  schools: SchoolSummary[]
  schoolDetails: Record<string, SchoolDetail>
  courses: Record<string, Course>
  lessons: Record<string, Lesson>
  quizzes: Record<string, OfflineQuiz>
  pages: Record<string, { slug: string; title: string; body: Block[] | unknown[] }>
  ui: { strings?: Record<string, string>; help?: Record<string, { title?: string | null; body: string; icon: string }> }
  inspiration: { body: string; author_name?: string | null; source_title?: string | null } | null
  /** the newest inspirations, for the words of the day on the home screen (older bundles lack it) */
  inspirations?: { id: string; body: string; author_name?: string | null; source_title?: string | null }[]
  achievements: Achievement[]
}

interface ContentState {
  bundle: Bundle | null
  /** true while the first copy (stored or shipped) is being read */
  loading: boolean
  /** set when no copy exists yet and the server could not be reached */
  offlineEmpty: boolean
  refresh: () => void
}

const ContentContext = createContext<ContentState>({ bundle: null, loading: true, offlineEmpty: false, refresh: () => undefined })
const key = (locale: string) => `bundle:${locale}`
const REFRESH_MS = 30 * 60 * 1000

export function ContentProvider({ children }: { children: ReactNode }) {
  const { locale } = usePrefs()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [offlineEmpty, setOfflineEmpty] = useState(false)
  const current = useRef<Bundle | null>(null)

  const refresh = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (!current.current) setOfflineEmpty(true)
      return
    }
    try {
      const headers: Record<string, string> = current.current ? { 'if-none-match': `"${current.current.version}"` } : {}
      const res = await fetch(apiUrl(`/bundle?locale=${locale}`), { headers, cache: 'no-cache' })
      if (res.status === 304 || !res.ok) {
        if (!res.ok && res.status !== 304 && !current.current) setOfflineEmpty(true)
        return
      }
      const next = (await res.json()) as Bundle
      if (next.version !== current.current?.version) {
        current.current = next
        setBundle(next)
        setOfflineEmpty(false)
        await set(key(locale), next).catch(() => undefined)
        keepImages(next)
      }
    } catch {
      if (!current.current) setOfflineEmpty(true)
    }
  }, [locale])

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      let stored = (await get<Bundle>(key(locale)).catch(() => undefined)) ?? null
      if (!stored) {
        // the copy shipped inside the app, for a first launch without a connection
        stored = await fetch(`/offline/bundle-${locale}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      }
      if (!alive) return
      current.current = stored
      setBundle(stored)
      setLoading(false)
      refresh()
    })()
    const onOnline = () => refresh()
    window.addEventListener('online', onOnline)
    const timer = setInterval(refresh, REFRESH_MS)
    return () => {
      alive = false
      window.removeEventListener('online', onOnline)
      clearInterval(timer)
    }
  }, [locale, refresh])

  const value = useMemo(() => ({ bundle, loading, offlineEmpty, refresh }), [bundle, loading, offlineEmpty, refresh])
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

export const useContent = () => useContext(ContentContext)

/** Re-provides the catalogue with age-tagged content limited to the learner's age (see age.ts). */
export function AgeFilter({ age, children }: { age: number | null; children: ReactNode }) {
  const parent = useContext(ContentContext)
  const bundle = useMemo(() => (parent.bundle ? filterBundleForAge(parent.bundle, age) : null), [parent.bundle, age])
  const value = useMemo(() => ({ ...parent, bundle }), [parent, bundle])
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}
