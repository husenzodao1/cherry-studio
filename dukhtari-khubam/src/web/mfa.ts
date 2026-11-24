'use client'

import { browserSupabase } from './supabase-browser'

/**
 * Two-step sign-in (2FA) with Supabase Auth: a TOTP code from an authenticator app (Google Authenticator,
 * Microsoft Authenticator, Authy…). Paid accounts are asked to turn it on; once on, her plan counts only in a
 * session that passed it (the database checks it), so a password or e-mail code alone opens nothing paid.
 */

export interface MfaState { enabled: boolean; needed: boolean; factor: string | null }

export async function mfaState(): Promise<MfaState> {
  const sb = browserSupabase()
  if (!sb) return { enabled: false, needed: false, factor: null }
  const [{ data: levels }, { data: factors }] = await Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()])
  const factor = factors?.totp.find((f) => f.status === 'verified')?.id ?? null
  return { enabled: !!factor, needed: !!factor && levels?.currentLevel !== 'aal2' && levels?.nextLevel === 'aal2', factor }
}

/** a new authenticator: its QR code (an SVG picture) and its secret to type in by hand */
export async function enrollTotp(): Promise<{ id: string; qr: string; secret: string }> {
  const sb = browserSupabase()!
  // an unfinished one from before is taken away first (one authenticator at a time)
  const { data: factors } = await sb.auth.mfa.listFactors()
  for (const f of factors?.all ?? []) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `LifeHub ${new Date().toISOString().slice(0, 10)}` })
  if (error || !data) throw error ?? new Error('enroll')
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }
}

/** the 6-digit code checked: the authenticator is on (or, signing in, this session passed the second step) */
export async function verifyCode(factorId: string, code: string): Promise<void> {
  const { error } = await browserSupabase()!.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, '') })
  if (error) throw error
}

/** turned off (only in a session that passed it) */
export async function removeTotp(factorId: string): Promise<void> {
  const { error } = await browserSupabase()!.auth.mfa.unenroll({ factorId })
  if (error) throw error
}
