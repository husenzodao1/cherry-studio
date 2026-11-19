/**
 * Login and password for a learner whose 15-digit code is lost. The phone encrypts the code with a key
 * derived from the password (PBKDF2-SHA-256 → AES-GCM) and the server keeps only that ciphertext and a
 * bcrypt hash of the password, so the code never sits on the server in a readable form.
 */

const ITERATIONS = 150_000
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const normalizeUsername = (s: string) => s.trim().toLowerCase()
export const isUsername = (s: string) => /^[a-z0-9_.]{3,32}$/.test(normalizeUsername(s))
export const isPassword = (s: string) => s.length >= 6 && s.length <= 72

async function keyFor(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

/** "v1.<salt>.<iv>.<ciphertext>", all base64. */
export async function encryptCode(code: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await keyFor(password, salt)
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(code)))
  return ['v1', b64(salt), b64(iv), b64(sealed)].join('.')
}

/** The code, or null when the password does not open it. */
export async function decryptCode(sealed: string, password: string): Promise<string | null> {
  const [v, salt, iv, data] = sealed.split('.')
  if (v !== 'v1' || !salt || !iv || !data) return null
  try {
    const key = await keyFor(password, unb64(salt))
    return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, key, unb64(data) as BufferSource))
  } catch {
    return null
  }
}
