'use client'

import { Capacitor } from '@capacitor/core'

import { accountAuth, accountProfile, endAccount, linkAccount, type AccountProfile } from './accountAuth'
import { apiUrl } from './base'

/**
 * Sign-in with Google. In the Android app the phone's own Google account sheet opens (Credential
 * Manager) — nothing goes to a web page; on the website Google's account chooser opens in a popup.
 * Google's ID token signs the learner in to Supabase Auth, where her Google account is tied to her
 * profile (api_google_link), so on a new phone Google gives her code back (api_google_profile).
 *
 * Name and photo come from the Google account. The birthday comes from the Google account when she
 * allows it (People API, scope user.birthday.read; Android app only); otherwise she types it.
 * The profile comes back whole with the sign-in (api_google_profile), so a returning learner is home
 * right after Google's sheet closes.
 * Setup: GOOGLE_WEB_CLIENT_ID in Vercel and the Google provider in Supabase (see README).
 */

const BUILT_IN_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''
const CONFIG_KEY = 'dk.google_client'

/**
 * The Web client ID: built in, or read from the server (GET /app-config, Vercel variable
 * GOOGLE_WEB_CLIENT_ID), so an installed app starts offering Google as soon as it is set there.
 * The last answer is kept on the phone.
 */
async function config(): Promise<{ id: string; birthday: boolean }> {
  // the kept answer is used at once (and refreshed for next time), so the button never waits for the server
  const kept = keptConfig()
  if (kept.id) {
    fetchConfig().catch(() => undefined)
    return kept
  }
  return (await fetchConfig().catch(() => null)) ?? kept
}

async function fetchConfig(): Promise<{ id: string; birthday: boolean } | null> {
  const res = await fetch(apiUrl('/app-config'), { cache: 'no-cache' })
  if (!res.ok) return null
  const c = (await res.json()) as { google_web_client_id?: string | null; google_birthday?: boolean }
  const out = { id: BUILT_IN_CLIENT_ID || (c.google_web_client_id ?? ''), birthday: c.google_birthday === true }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(out))
  return out
}

function keptConfig(): { id: string; birthday: boolean } {
  try {
    const kept = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? 'null') as { id?: string; birthday?: boolean } | string | null
    if (typeof kept === 'string') return { id: BUILT_IN_CLIENT_ID || kept, birthday: false }
    return { id: BUILT_IN_CLIENT_ID || (kept?.id ?? ''), birthday: kept?.birthday === true }
  } catch {
    return { id: BUILT_IN_CLIENT_ID, birthday: false }
  }
}
const BIRTHDAY_SCOPE = 'https://www.googleapis.com/auth/user.birthday.read'

export interface GoogleAccount {
  email: string | null
  name: string
  photo: string | null
  /** the birthday in the Google account as dd.mm.yyyy, when Google gave it */
  birthday: string | null
  /** her profile (name and progress), when this Google account is already tied to one */
  profile: AccountProfile | null
}
export type GoogleResult = GoogleAccount | 'cancelled' | 'not_configured' | 'offline' | 'error'

let ready: Promise<void> | null = null
async function plugin(webClientId: string, birthday: boolean) {
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  // on the website Google's chooser opens in a popup and comes back to /start (an authorised redirect URI)
  const redirectUrl = Capacitor.isNativePlatform() ? undefined : `${window.location.origin}/start`
  // Android: without extra scopes, skip the second "authorize" step after the account is chosen — it is
  // not needed for signing in and can hang on some phones (the plugin's documented workaround)
  ready ??= SocialLogin.initialize({
    google: { webClientId, mode: 'online', ...(redirectUrl ? { redirectUrl } : {}), ...(birthday ? {} : { skipAuthOnlyAuthorizationAfterSignIn: true }) }
  })
  await ready
  return SocialLogin
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

async function googleBirthday(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', { headers: { authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null
    const body = (await res.json()) as { birthdays?: { date?: { year?: number; month?: number; day?: number }; metadata?: { primary?: boolean } }[] }
    const list = body.birthdays ?? []
    const d = (list.find((b) => b.metadata?.primary && b.date?.year) ?? list.find((b) => b.date?.year))?.date
    if (!d?.year || !d.month || !d.day) return null
    return `${String(d.day).padStart(2, '0')}.${String(d.month).padStart(2, '0')}.${d.year}`
  } catch {
    return null
  }
}

/** Starts loading the Google sign-in early (the start screen calls it), so the button answers at once. */
export function warmGoogle(): void {
  const { id, birthday } = keptConfig()
  if (id) plugin(id, birthday).catch(() => { ready = null })
}

/** The claims of a Google ID token (name, e-mail, picture): read from the token itself, not the plugin's profile. */
export function idTokenClaims(token: string): { email?: string; name?: string; given_name?: string; picture?: string } {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent([...atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '='))]
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

/** Fails after `ms` instead of waiting for ever. */
function within<T>(p: Promise<T>, ms: number, step: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout:${step}`)), ms))])
}

/** Which step failed last time (shown small under the message, so a problem can be told apart). */
export let lastGoogleStep = ''

export async function signInWithGoogle(): Promise<GoogleResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  const { id, birthday } = await config()
  if (!id) return 'not_configured'
  const sb = accountAuth()
  if (!sb) return 'not_configured'
  let step = 'start'
  lastGoogleStep = ''
  try {
    step = 'plugin'
    const SocialLogin = await within(plugin(id, birthday), 20_000, step)
    // Supabase checks that the token carries sha256(nonce); Google receives the hash, Supabase the nonce
    const nonce = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)))
    const native = Capacitor.isNativePlatform()
    step = 'google'
    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { nonce: hashed, ...(native && birthday ? { scopes: [BIRTHDAY_SCOPE] } : {}) }
    })
    if (result.responseType !== 'online' || !result.idToken) throw new Error('no_id_token')
    step = 'supabase'
    const { error } = await within(sb.auth.signInWithIdToken({ provider: 'google', token: result.idToken, nonce }), 20_000, step)
    if (error) throw new Error(error.message)
    step = 'profile'
    const profile = await within(accountProfile(), 20_000, step)
    if (profile === 'error') throw new Error('profile')
    // name, e-mail and photo from the token itself (the plugin's profile can come back empty)
    const c = idTokenClaims(result.idToken)
    const p = result.profile ?? ({} as Partial<NonNullable<typeof result.profile>>)
    step = 'birthday'
    const born = birthday && !profile && result.accessToken?.token ? await within(googleBirthday(result.accessToken.token), 6000, step).catch(() => null) : null
    return {
      email: p.email ?? c.email ?? null,
      name: (p.givenName || c.given_name || p.name || c.name || '').trim().slice(0, 80),
      photo: p.imageUrl ?? c.picture ?? null,
      birthday: born,
      profile
    }
  } catch (e) {
    const text = String((e as Error)?.message ?? e)
    if (step === 'google' && /cancel|closed|dismiss|abort/i.test(text)) return 'cancelled'
    lastGoogleStep = `${step}: ${text}`.slice(0, 120)
    await endAccount()
    return 'error'
  }
}

/** Ties the Google account signed in above to this phone's profile, then ends the Google session. */
export const linkGoogle = linkAccount
/** Ends the Google session without linking (she signed in to an existing profile). */
export const endGoogle = endAccount

/** Keeps the Google photo as her profile photo (only when she has none yet). */
export async function googlePhotoFile(url: string | null): Promise<File | null> {
  if (!url) return null
  try {
    const res = await fetch(url.replace(/=s\d+-c$/, '=s512-c'), { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], 'google.jpg', { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
}
