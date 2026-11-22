'use client'

import { accountAuth, accountProfile, type AccountProfile } from './accountAuth'

/**
 * Sign-in with e-mail and a 6-digit code: Supabase Auth sends the code (one-time password) to her
 * address; typing it signs her in, and the address keeps her profile like a Google account does.
 */
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())
export const normalizeEmail = (e: string) => e.trim().toLowerCase()

export type SendResult = 'sent' | 'offline' | 'invalid' | 'wait' | 'error'

export async function sendEmailCode(raw: string): Promise<SendResult> {
  const email = normalizeEmail(raw)
  if (!isEmail(email)) return 'invalid'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  const sb = accountAuth()
  if (!sb) return 'error'
  try {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (!error) return 'sent'
    return error.status === 429 || /rate|seconds/i.test(error.message) ? 'wait' : 'error'
  } catch {
    return navigator.onLine === false ? 'offline' : 'error'
  }
}

/** Checks the code; on success returns the profile tied to the address (or null for a new one). */
export async function verifyEmailCode(raw: string, code: string): Promise<{ profile: AccountProfile | null } | 'wrong' | 'offline' | 'error'> {
  const email = normalizeEmail(raw)
  const sb = accountAuth()
  if (!sb) return 'error'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  try {
    const { error } = await sb.auth.verifyOtp({ email, token: code.replace(/\D/g, ''), type: 'email' })
    if (error) return 'wrong'
    const profile = await accountProfile()
    return profile === 'error' ? 'error' : { profile }
  } catch {
    return 'error'
  }
}
