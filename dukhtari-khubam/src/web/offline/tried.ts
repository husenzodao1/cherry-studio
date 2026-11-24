'use client'

import type { Plan } from '@/lib/plans'

/**
 * The plans' newer features she has opened at least once (kept on this phone): those she has not are offered
 * on the home screen ("Also try the new features: …") until she does, or closes the offer for a while.
 */

export interface NewFeature { id: string; href: string; emoji: string; label: string; plan: Exclude<Plan, 'free'> }
export const NEW_FEATURES: NewFeature[] = [
  { id: 'hey', href: '/hey', emoji: '🎙️', label: 'pw.row_hey', plan: 'standard' },
  { id: 'workspace', href: '/workspace', emoji: '🎓', label: 'pw.row_workspace', plan: 'premium' },
  { id: 'navigate', href: '/navigate', emoji: '🧭', label: 'pw.row_navigate', plan: 'premium' },
  { id: 'telegram', href: '/telegram', emoji: '✈️', label: 'pw.row_telegram', plan: 'premium' }
]
const KEY = 'dk.tried'
const HIDDEN = 'dk.tried-hidden'
/** closed: offered again after this long */
const HIDE_MS = 3 * 86_400_000

const read = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] } }

export function markTried(id: string) {
  try {
    const all = read()
    if (!all.includes(id)) localStorage.setItem(KEY, JSON.stringify([...all, id]))
  } catch { /* private mode */ }
}

/** what her plan gives that she has not opened yet (nothing while the offer is closed) */
export function untried(plan: Plan, now = Date.now()): NewFeature[] {
  if (plan === 'free') return []
  try { if (now - Number(localStorage.getItem(HIDDEN) ?? 0) < HIDE_MS) return [] } catch { /* shown */ }
  const done = new Set(read())
  return NEW_FEATURES.filter((f) => !done.has(f.id) && (plan === 'premium' || f.plan === 'standard'))
}

export function hideTryAlso(now = Date.now()) {
  try { localStorage.setItem(HIDDEN, String(now)) } catch { /* private mode */ }
}
