/**
 * The app's own 4-digit PIN. Only a salted SHA-256 of it is kept on this phone. It keeps the app closed
 * to people nearby; it is not a defence against someone who can read the phone's storage. After five
 * wrong tries in a row the pad waits 30 seconds.
 */
const KEY = 'dk.pin'
const MAX_TRIES = 5
const WAIT_MS = 30_000

interface Stored { salt: string; hash: string; fails: number; until: number }

function read(): Stored | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && typeof v.hash === 'string' ? { fails: 0, until: 0, ...v } : null
  } catch {
    return null
  }
}

function write(v: Stored | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: nothing to lock with */
  }
}

async function digest(salt: string, pin: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const isPin = (pin: string) => /^\d{4}$/.test(pin)
export const hasPin = () => read() !== null

export async function setPin(pin: string): Promise<void> {
  if (!isPin(pin)) throw new Error('invalid_pin')
  const salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')
  write({ salt, hash: await digest(salt, pin), fails: 0, until: 0 })
}

export const clearPin = () => write(null)

/** Seconds to wait before the next try (0 when trying is allowed). */
export function waitLeft(now = Date.now()): number {
  const v = read()
  return v && v.until > now ? Math.ceil((v.until - now) / 1000) : 0
}

export async function checkPin(pin: string, now = Date.now()): Promise<'ok' | 'wrong' | 'wait'> {
  const v = read()
  if (!v) return 'ok'
  if (v.until > now) return 'wait'
  if ((await digest(v.salt, pin)) === v.hash) {
    write({ ...v, fails: 0, until: 0 })
    return 'ok'
  }
  const fails = v.fails + 1
  write({ ...v, fails: fails >= MAX_TRIES ? 0 : fails, until: fails >= MAX_TRIES ? now + WAIT_MS : 0 })
  return fails >= MAX_TRIES ? 'wait' : 'wrong'
}
