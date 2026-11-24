import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * The bridge's guards, kept apart from WhatsApp itself so they can be tested: who may call it (the shared
 * secret), which numbers are numbers, and how many messages may leave the owner's number. A number that sends
 * too much too fast is what WhatsApp bans, so the bridge sends little and slowly.
 */

/** The caller's bearer token against the secret, in constant time. */
export function authorized(header, secret) {
  if (!secret || secret.length < 24 || typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const a = createHash('sha256').update(header.slice(7)).digest()
  const b = createHash('sha256').update(secret).digest()
  return timingSafeEqual(a, b)
}

/** "+992 90 123-45-67" → "992901234567"; anything that is not 9–15 digits → null. */
export function digitsOf(phone) {
  const d = String(phone ?? '').replace(/[\s()+.-]/g, '')
  return /^[1-9][0-9]{8,14}$/.test(d) ? d : null
}

/**
 * A sliding-window counter: at most `max` events per key in `windowMs`. `take` counts one and says whether
 * it was allowed.
 */
export class Window {
  constructor(max, windowMs, now = () => Date.now()) {
    this.max = max
    this.windowMs = windowMs
    this.now = now
    this.seen = new Map()
  }

  take(key = '') {
    const t = this.now()
    const kept = (this.seen.get(key) ?? []).filter((at) => t - at < this.windowMs)
    if (kept.length >= this.max) {
      this.seen.set(key, kept)
      return false
    }
    kept.push(t)
    this.seen.set(key, kept)
    return true
  }
}

/** The limits: the whole number, and each person it writes to. */
export function makeLimits(now) {
  return {
    perMinute: new Window(12, 60_000, now),
    perDay: new Window(400, 86_400_000, now),
    perPerson: new Window(12, 3_600_000, now)
  }
}

/** Whether one message to `to` may go now (counts it when it may). */
export function maySend(limits, to) {
  // the person's own limit first: a refused message must not use up the number's minute
  if (!limits.perPerson.take(to)) return 'person'
  if (!limits.perMinute.take()) return 'minute'
  if (!limits.perDay.take()) return 'day'
  return null
}

/** A text the bridge will send: plain, trimmed, not too long. */
export function cleanText(text) {
  const t = String(text ?? '').replace(/\r/g, '').trim()
  return t.length >= 1 && t.length <= 2000 ? t : null
}
