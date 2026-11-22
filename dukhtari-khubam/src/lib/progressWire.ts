/**
 * How progress travels to and rests in the backup (device_profiles.data), kept small so 100 000+
 * learners fit the free database:
 * - trimmed: study days of the last year only, lessons never opened dropped;
 * - compressed: from about 1.5 KB on, the JSON is gzipped and kept as base64 in `z`. The welcome
 *   answers (`about`), the year of birth and the birthday stay readable beside it (the panel counts them).
 * Small progress is kept as plain JSON. Works the same in the browser, the Android app and on the server
 * (CompressionStream and btoa exist in all three).
 */
import type { ProgressData } from './progress'

const KEEP_DAYS = 366
const COMPRESS_FROM = 1500

export interface Packed { v: 1; z: string; about?: ProgressData['about']; born?: number; birthday?: string }

/** Drops what is not needed any more: study days older than a year, lessons at 0 % and not done. */
export function trim(p: ProgressData): ProgressData {
  const lessons = Object.fromEntries(Object.entries(p.lessons).filter(([, l]) => l.done || (l.p ?? 0) > 0))
  return { ...p, days: [...p.days].sort().slice(-KEEP_DAYS), lessons }
}

const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream))
  return new Uint8Array(await out.arrayBuffer())
}

/** Progress as it is sent and stored: trimmed, and compressed when large. */
export async function pack(p: ProgressData): Promise<ProgressData | Packed> {
  const t = trim(p)
  const json = JSON.stringify(t)
  if (json.length < COMPRESS_FROM || typeof CompressionStream === 'undefined') return t
  const z = toBase64(await through(new TextEncoder().encode(json), new CompressionStream('gzip')))
  return { v: 1, z, ...(t.about ? { about: t.about } : {}), ...(t.born !== undefined ? { born: t.born } : {}), ...(t.birthday ? { birthday: t.birthday } : {}) }
}

/** Stored progress back to plain JSON (as it was, when it was not compressed). */
export async function unpack(raw: unknown): Promise<unknown> {
  const z = (raw as { z?: unknown } | null)?.z
  if (typeof z !== 'string') return raw
  const bytes = await through(fromBase64(z), new DecompressionStream('gzip'))
  return JSON.parse(new TextDecoder().decode(bytes))
}
