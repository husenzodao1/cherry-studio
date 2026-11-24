'use client'

import type { Answered, MmtProgram, MmtQuestion, MmtSubject } from '@/lib/mmt'

import { apiUrl } from './base'
import { supportToken } from './support'

/**
 * ММТ on the phone: the subjects and programmes from the server, a mock exam's questions (counted against her
 * plan there), and everything she answered kept here — her predicted score, chances and plan are worked out
 * from it on the phone.
 */

export interface Catalog { exam_date: string | null; subjects: MmtSubject[] }
export interface Attempt { at: string; cluster: number; scores: Record<string, number>; total: number; max: number; asked: number; right: number }

const HISTORY = 'dk.mmt.history'
const ATTEMPTS = 'dk.mmt.attempts'
const CLUSTER = 'dk.mmt.cluster'
const KEEP = 3000

const read = <T>(key: string, empty: T): T => {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as T | null) ?? empty } catch { return empty }
}
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* not kept */ } }

export const history = () => read<Answered[]>(HISTORY, [])
export const attempts = () => read<Attempt[]>(ATTEMPTS, [])
export const savedCluster = () => read<number | null>(CLUSTER, null)
export const saveCluster = (c: number) => write(CLUSTER, c)

/** one finished mock exam: its answers join her history, its scores the list of attempts */
export function keepAttempt(answers: Answered[], a: Attempt) {
  write(HISTORY, [...history(), ...answers].slice(-KEEP))
  write(ATTEMPTS, [...attempts(), a].slice(-50))
}

export class MmtError extends Error {
  constructor(readonly status: number) { super(String(status)) }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path))
  if (!res.ok) throw new MmtError(res.status)
  return (await res.json()) as T
}

export const catalog = () => get<Catalog>('/mmt/catalog')
export const programs = (cluster: number) => get<{ programs: MmtProgram[] }>(`/mmt/programs?cluster=${cluster}`).then((r) => r.programs)

async function sessionToken(): Promise<string | undefined> {
  try {
    const { browserSupabase } = await import('../supabase-browser')
    const { data } = await browserSupabase()?.auth.getSession() ?? { data: { session: null } }
    return data.session?.access_token ?? undefined
  } catch {
    return undefined
  }
}

/** a mock exam's questions (402: her plan's ММТ tests are used up) */
export async function drawExam(subjects: string[], per: number): Promise<MmtQuestion[]> {
  const res = await fetch(apiUrl('/mmt/exam'), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: supportToken(), session: await sessionToken(), subjects, per })
  })
  if (!res.ok) throw new MmtError(res.status)
  return ((await res.json()) as { questions: MmtQuestion[] }).questions
}

/** opens Mahliyo in her ММТ mode with a question written in */
export function askMahliyo(question: string, go: (path: string) => void) {
  try {
    localStorage.setItem('dk.ai.mode', 'mmt')
    sessionStorage.setItem('dk.ai.ask', question)
  } catch { /* storage blocked: the chat opens empty */ }
  go('/mahliyo')
}
