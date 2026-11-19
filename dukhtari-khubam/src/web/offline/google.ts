'use client'

import { Capacitor } from '@capacitor/core'

import { accountAuth, accountProfile, endAccount, linkAccount } from './accountAuth'
import { apiUrl } from './base'

/**
 * Sign-in with Google. In the Android app the phone's own Google account sheet opens (Credential
 * Manager) — nothing goes to a web page; on the website Google's account chooser opens in a popup.
 * Google's ID token signs the learner in to Supabase Auth, where her Google account is tied to her
 * profile (api_google_link), so on a new phone Google gives her code back (api_google_profile).
 *
 * Name and photo come from the Google account. The age comes from the birthday in the Google account
 * when she allows it (People API, scope user.birthday.read; Android app only); otherwise she types it.
 * Setup: GOOGLE_WEB_CLIENT_ID in Vercel and the Google provider in Supabase (see README).
 */

const BUILT_IN_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? ''
const CONFIG_KEY = 'dk.google_client'

/**
 * The Web client ID: built in, or read from the server (GET /app-config, Vercel variable
 * GOOGLE_WEB_CLIENT_ID), so an installed app starts offering Google as soon as it is set there.
 * The last answer is kept on the phone.
 */
async function clientId(): Promise<string> {
  if (BUILT_IN_CLIENT_ID) return BUILT_IN_CLIENT_ID
  try {
    const res = await fetch(apiUrl('/app-config'), { cache: 'no-cache' })
    if (res.ok) {
      const id = ((await res.json()) as { google_web_client_id?: string | null }).google_web_client_id ?? ''
      localStorage.setItem(CONFIG_KEY, id)
      return id
    }
  } catch {
    /* offline: use the kept one */
  }
  try {
    return localStorage.getItem(CONFIG_KEY) ?? ''
  } catch {
    return ''
  }
}
const BIRTHDAY_SCOPE = 'https://www.googleapis.com/auth/user.birthday.read'
// ask for the birthday unless turned off (an unverified Google app shows a warning for this scope)
const ASK_BIRTHDAY = process.env.NEXT_PUBLIC_GOOGLE_BIRTHDAY !== '0'

export interface GoogleProfile { code: string; name: string }
export interface GoogleAccount {
  email: string | null
  name: string
  photo: string | null
  /** whole years from the Google birthday, when Google gave it */
  age: number | null
  /** her profile, when this Google account is already tied to one */
  profile: GoogleProfile | null
}
export type GoogleResult = GoogleAccount | 'cancelled' | 'not_configured' | 'offline' | 'error'

let ready: Promise<void> | null = null
async function plugin(webClientId: string) {
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  // on the website Google's chooser opens in a popup and comes back to /start (an authorised redirect URI)
  const redirectUrl = Capacitor.isNativePlatform() ? undefined : `${window.location.origin}/start`
  ready ??= SocialLogin.initialize({ google: { webClientId, mode: 'online', ...(redirectUrl ? { redirectUrl } : {}) } })
  await ready
  return SocialLogin
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')

/** Whole years between a birthday and today. */
export function ageFrom(b: { year?: number; month?: number; day?: number }, today = new Date()): number | null {
  if (!b.year || !b.month || !b.day) return null
  let age = today.getFullYear() - b.year
  if (today.getMonth() + 1 < b.month || (today.getMonth() + 1 === b.month && today.getDate() < b.day)) age--
  return age >= 5 && age <= 99 ? age : null
}

async function birthdayAge(accessToken: string): Promise<number | null> {
  try {
    const res = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', { headers: { authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null
    const body = (await res.json()) as { birthdays?: { date?: { year?: number; month?: number; day?: number }; metadata?: { primary?: boolean } }[] }
    const list = body.birthdays ?? []
    const best = list.find((b) => b.metadata?.primary && b.date?.year) ?? list.find((b) => b.date?.year)
    return best?.date ? ageFrom(best.date) : null
  } catch {
    return null
  }
}

export async function signInWithGoogle(): Promise<GoogleResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  const id = await clientId()
  if (!id) return 'not_configured'
  const sb = accountAuth()
  if (!sb) return 'not_configured'
  try {
    const SocialLogin = await plugin(id)
    // Supabase checks that the token carries sha256(nonce); Google receives the hash, Supabase the nonce
    const nonce = hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    const hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)))
    const native = Capacitor.isNativePlatform()
    const { result } = await SocialLogin.login({
      provider: 'google',
      options: { nonce: hashed, ...(native && ASK_BIRTHDAY ? { scopes: [BIRTHDAY_SCOPE] } : {}) }
    })
    if (result.responseType !== 'online' || !result.idToken) return 'error'
    const { error } = await sb.auth.signInWithIdToken({ provider: 'google', token: result.idToken, nonce })
    if (error) return 'error'
    const profile = await accountProfile()
    if (profile === 'error') return 'error'
    const p = result.profile
    return {
      email: p.email,
      name: (p.givenName || p.name || '').trim().slice(0, 80),
      photo: p.imageUrl,
      age: result.accessToken?.token ? await birthdayAge(result.accessToken.token) : null,
      profile
    }
  } catch (e) {
    const text = String((e as Error)?.message ?? e).toLowerCase()
    return /cancel|closed|dismiss|16:|abort/.test(text) ? 'cancelled' : 'error'
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
