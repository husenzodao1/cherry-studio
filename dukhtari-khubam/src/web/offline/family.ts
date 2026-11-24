'use client'

import { localDay, streak, type ProgressData } from '@/lib/progress'

import { allDecks } from './decks'
import { attempts } from './mmt'
import { browserSupabase } from '../supabase-browser'

/**
 * The parents' view, her side: a link she makes and can take back, and the short summary her phone writes for
 * it after each backup — how she learns, never what she writes.
 */

export interface Summary {
  streak: number
  /** the last 14 days, oldest first: whether she studied that day */
  days: boolean[]
  lessons: number
  lessons_week: number
  tests: number
  test_avg: number | null
  cards_learnt: number
  mmt: { total: number; max: number; at: string } | null
}

const ON = 'dk.parent.on'

export function summaryOf(p: ProgressData, today = new Date()): Summary {
  const days = Array.from({ length: 14 }, (_, i) => localDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 13 + i)))
  const studied = new Set(p.days)
  const weekAgo = new Date(today.getTime() - 7 * 86_400_000).toISOString()
  const done = Object.values(p.lessons).filter((l) => l.done)
  const tests = Object.values(p.quizzes)
  const last = attempts().at(-1)
  const learnt = Object.values(allDecks()).filter((d) => !d.del).reduce((n, d) => n + d.cards.filter((c) => !c.del && c.f && c.st && c.st.s >= 21).length, 0)
  return {
    streak: streak(p.days, today),
    days: days.map((d) => studied.has(d)),
    lessons: done.length,
    lessons_week: done.filter((l) => (l.done ?? '') >= weekAgo).length,
    tests: tests.length,
    test_avg: tests.length ? Math.round(tests.reduce((n, q) => n + q.best, 0) / tests.length) : null,
    cards_learnt: learnt,
    mmt: last ? { total: Math.round(last.total), max: last.max, at: last.at } : null
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = browserSupabase()
  if (!sb) throw new Error('offline')
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const parentsOn = () => { try { return localStorage.getItem(ON) === '1' } catch { return false } }

export async function makeLink(code: string, p: ProgressData): Promise<string> {
  const { token } = await rpc<{ token: string }>('api_parent_link', { p_code: code })
  try { localStorage.setItem(ON, '1') } catch { /* asked again next time */ }
  await pushSummary(code, p)
  return token
}

export async function removeLink(code: string) {
  await rpc('api_parent_unlink', { p_code: code })
  try { localStorage.removeItem(ON) } catch { /* nothing kept */ }
}

/** the summary sent (after a backup, when she has a link); quietly nothing offline */
export async function pushSummary(code: string, p: ProgressData) {
  if (!parentsOn()) return
  await rpc('api_parent_summary', { p_code: code, p_summary: summaryOf(p) }).catch(() => undefined)
}
