/**
 * The app's plans: free, Standard and Premium — their prices, what each may do with Mahliyo (counted by the
 * server), and the rows of the comparison table. The staff may change any limit in the panel
 * (app_settings.plan_limits); these are the defaults.
 */

export type Plan = 'free' | 'standard' | 'premium'
export const PLANS: Plan[] = ['free', 'standard', 'premium']
export const planRank = (p: Plan | string | null | undefined) => (p === 'premium' ? 2 : p === 'standard' ? 1 : 0)
/** whether a plan opens content of a tier */
export const canOpen = (plan: Plan, tier: string | null | undefined) => planRank(tier) <= planRank(plan)

/** prices in somoni a month; Standard's first month is cheaper */
export const PRICES = { standard: 45, standardFirst: 25, premium: 99 } as const
/** days of Premium given to a friend with a Premium purchase */
export const GIFT_DAYS = 3

/** what is counted: per day (d) or per month (m); −1 is "no limit", 0 is "not in this plan" */
export interface Limits {
  /** questions to Mahliyo a day */
  message: number
  /** presentations a month */
  slides: number
  /** Word and PDF documents a month */
  doc: number
  /** other files (code, tables, text) a month */
  file: number
  /** tests in the chat a month */
  quiz: number
  /** ММТ practice tests a month */
  mmt: number
  /** exact answers on Tajikistan's laws a month */
  lawyer: number
  /** songs a month */
  music: number
  /** exam preparation answers a month */
  exam: number
  /** how many turns of the conversation she reads */
  context: number
  /** how long chats are kept (days) */
  keep: number
}
export type LimitKind = Exclude<keyof Limits, 'context' | 'keep'>
export const PERIOD: Record<LimitKind, 'd' | 'm'> = { message: 'd', slides: 'm', doc: 'm', file: 'm', quiz: 'm', mmt: 'm', lawyer: 'm', music: 'm', exam: 'm' }

export const DEFAULT_LIMITS: Record<Plan, Limits> = {
  free: { message: 15, slides: 1, doc: 1, file: 2, quiz: 3, mmt: 1, lawyer: 2, music: 0, exam: 2, context: 12, keep: 7 },
  standard: { message: 40, slides: 3, doc: 4, file: 10, quiz: 20, mmt: 10, lawyer: 10, music: 0, exam: 20, context: 24, keep: 31 },
  premium: { message: 140, slides: 40, doc: 60, file: 100, quiz: -1, mmt: -1, lawyer: -1, music: 20, exam: -1, context: 40, keep: 366 }
}

/** the staff's limits over the defaults (only numbers they set; anything else is ignored) */
export function limitsFrom(setting: unknown): Record<Plan, Limits> {
  const out = structuredClone(DEFAULT_LIMITS)
  if (!setting || typeof setting !== 'object') return out
  for (const plan of PLANS) {
    const own = (setting as Record<string, unknown>)[plan]
    if (!own || typeof own !== 'object') continue
    for (const k of Object.keys(out[plan]) as (keyof Limits)[]) {
      const v = Number((own as Record<string, unknown>)[k])
      if (Number.isInteger(v) && v >= -1 && v <= 100_000) out[plan][k] = v
    }
  }
  return out
}

/** the period a use is counted in: "d2026-11-23" or "m2026-11" (the learner's own day: Tajikistan's, UTC+5) */
export function periodOf(kind: LimitKind, now = new Date()): string {
  const local = new Date(now.getTime() + 5 * 3600_000).toISOString()
  return PERIOD[kind] === 'd' ? `d${local.slice(0, 10)}` : `m${local.slice(0, 7)}`
}

/** a file's kind for the limits, by its name */
export function fileLimitKind(name: string): 'slides' | 'doc' | 'file' {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  return ext === 'pptx' ? 'slides' : ext === 'pdf' || ext === 'docx' ? 'doc' : 'file'
}

/**
 * The comparison table: each row says what free, Standard and Premium give — a number from the limits, a
 * tick, a cross, or a word. `soon`: being made, shown as "coming".
 */
export type Cell = boolean | 'limit' | string
export interface Row { id: string; icon: string; cells: [Cell, Cell, Cell]; limit?: LimitKind | 'keep'; soon?: boolean }
export const ROWS: Row[] = [
  { id: 'messages', icon: 'speech', cells: ['limit', 'limit', 'limit'], limit: 'message' },
  { id: 'model', icon: 'sparkle', cells: ['lite', 'omuzgor', 'tajthinker'] },
  { id: 'memory', icon: 'archive', cells: ['limit', 'limit', 'limit'], limit: 'keep' },
  { id: 'slides', icon: 'grid', cells: ['limit', 'limit', 'limit'], limit: 'slides' },
  { id: 'docs', icon: 'file', cells: ['limit', 'limit', 'limit'], limit: 'doc' },
  { id: 'files', icon: 'code', cells: ['limit', 'limit', 'limit'], limit: 'file' },
  { id: 'quiz', icon: 'check', cells: ['limit', 'limit', 'limit'], limit: 'quiz' },
  { id: 'mmt', icon: 'cap', cells: ['limit', 'limit', 'limit'], limit: 'mmt' },
  { id: 'mmt_course', icon: 'target', cells: [false, false, true] },
  { id: 'lawyer', icon: 'scale', cells: ['limit', 'limit', 'limit'], limit: 'lawyer' },
  { id: 'music', icon: 'music', cells: ['limit', 'limit', 'limit'], limit: 'music' },
  { id: 'calls', icon: 'phone', cells: [false, false, true] },
  { id: 'exams', icon: 'book', cells: ['limit', 'limit', 'limit'], limit: 'exam' },
  { id: 'courses', icon: 'layers', cells: ['free', 'standard', 'all'] },
  { id: 'workspace', icon: 'select', cells: [false, false, true] },
  { id: 'navigate', icon: 'compass', cells: [false, false, true] },
  { id: 'telegram', icon: 'share', cells: [false, false, true], soon: true },
  { id: 'widgets', icon: 'grid', cells: [false, true, true] },
  { id: 'speed', icon: 'flash', cells: [false, true, true] }
]
