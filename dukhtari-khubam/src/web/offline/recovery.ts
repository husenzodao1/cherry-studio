/**
 * Three life questions that open the app when its PIN is forgotten. They are chosen when the PIN is set;
 * only a salted SHA-256 of each normalised answer stays on this phone. Answers are compared without
 * case, extra spaces or punctuation, so "Манту", " манту " and "МАНТУ!" are the same answer.
 * After five wrong answers in a row the questions wait a minute.
 */
const KEY = 'dk.pin_recovery'
const MAX_TRIES = 5
const WAIT_MS = 60_000

export const RECOVERY_QUESTIONS = [
  'food', 'teacher', 'friend', 'city', 'flower', 'book', 'grandma', 'colour', 'dream', 'school'
] as const
export type RecoveryQuestion = (typeof RECOVERY_QUESTIONS)[number]
export const RECOVERY_COUNT = 3

interface Item { q: RecoveryQuestion; salt: string; hash: string }
interface Stored { items: Item[]; fails: number; until: number }

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && Array.isArray(v.items) && v.items.length === RECOVERY_COUNT ? { fails: 0, until: 0, ...v } : null
  } catch {
    return null
  }
}

function write(v: Stored | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked */
  }
}

/** Lower case, letters and digits only, single spaces; ё is е. */
export function normalizeAnswer(a: string): string {
  return a.toLocaleLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function digest(salt: string, answer: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${normalizeAnswer(answer)}`)))
}

export const hasRecovery = () => read() !== null
export const recoveryQuestions = (): RecoveryQuestion[] => read()?.items.map((i) => i.q) ?? []

/** Keeps three different questions with their answers (each answer needs at least two letters). */
export async function setRecovery(pairs: { q: RecoveryQuestion; answer: string }[]): Promise<void> {
  const qs = new Set(pairs.map((p) => p.q))
  if (pairs.length !== RECOVERY_COUNT || qs.size !== RECOVERY_COUNT || pairs.some((p) => normalizeAnswer(p.answer).length < 2)) {
    throw new Error('invalid_recovery')
  }
  const items = await Promise.all(pairs.map(async (p) => {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
    return { q: p.q, salt, hash: await digest(salt, p.answer) }
  }))
  write({ items, fails: 0, until: 0 })
}

export const clearRecovery = () => write(null)

/** Seconds to wait before the next answer (0 when answering is allowed). */
export function recoveryWait(now = Date.now()): number {
  const v = read()
  return v && v.until > now ? Math.ceil((v.until - now) / 1000) : 0
}

/** Checks the answer to question `index` (0–2). */
export async function checkAnswer(index: number, answer: string, now = Date.now()): Promise<'ok' | 'wrong' | 'wait'> {
  const v = read()
  if (!v || !v.items[index]) return 'wrong'
  if (v.until > now) return 'wait'
  const item = v.items[index]
  if ((await digest(item.salt, answer)) === item.hash) {
    write({ ...v, fails: 0, until: 0 })
    return 'ok'
  }
  const fails = v.fails + 1
  write({ ...v, fails: fails >= MAX_TRIES ? 0 : fails, until: fails >= MAX_TRIES ? now + WAIT_MS : 0 })
  return fails >= MAX_TRIES ? 'wait' : 'wrong'
}
