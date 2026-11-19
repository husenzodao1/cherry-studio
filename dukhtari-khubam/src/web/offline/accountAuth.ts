'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Accounts that keep a learner's code: Google (google.ts) or her e-mail with a 6-digit code (email.ts).
 * Either signs her in to Supabase Auth in a separate, in-memory client (never mixed with a staff
 * session); the signed-in account is then tied to her profile (api_google_link — the name is historic,
 * it serves every sign-in method) and gives the code back on a new phone (api_google_profile).
 */
let client: SupabaseClient | null = null
export function accountAuth(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'dk-account' } })
  return client
}

export interface AccountProfile { code: string; name: string; data?: unknown }

/** The profile tied to the signed-in account, null when there is none, or 'error'. */
export async function accountProfile(): Promise<AccountProfile | null | 'error'> {
  const sb = accountAuth()
  if (!sb) return 'error'
  const { data, error } = await sb.rpc('api_google_profile')
  if (error) return 'error'
  // the profile comes whole (name and progress), so signing in needs no second request
  const p = data as AccountProfile | null
  return p && typeof p === 'object' ? { code: String(p.code), name: String(p.name), data: p.data } : null
}

/** Ties the signed-in account to this phone's profile, then ends the session. */
export async function linkAccount(code: string): Promise<boolean> {
  const sb = accountAuth()
  if (!sb) return false
  try {
    const { error } = await sb.rpc('api_google_link', { p_code: code })
    return !error
  } catch {
    return false
  } finally {
    await sb.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
}

/** Ends the session without linking (she signed in to an existing profile). */
export async function endAccount(): Promise<void> {
  await accountAuth()?.auth.signOut({ scope: 'local' }).catch(() => undefined)
}
