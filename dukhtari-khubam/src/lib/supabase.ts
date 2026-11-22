import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env, isConfigured } from './env'
import { ApiError, fromDatabase } from './http'

/**
 * A Supabase client acting as the caller: the request's access token is forwarded, so
 * Postgres row-level security and role checks decide what is allowed. The API never uses
 * a service-role key for content operations.
 */
export function supabaseFor(token: string | null): SupabaseClient {
  if (!isConfigured()) throw new ApiError(503, 'not_configured', 'Сервер ҳанӯз танзим нашудааст.')
  return createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  })
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i.exec(header.trim())
  return match ? match[1] : null
}

/** Reads `sub` from the JWT without verifying it. Postgres verifies the token on every query. */
export function tokenSubject(token: string | null): string | null {
  if (!token) return null
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

interface Result<T> {
  data: T | null
  error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null
  status?: number
}

/** Unwrap a Supabase response or throw a mapped ApiError. */
export async function unwrap<T>(promise: PromiseLike<Result<T>>): Promise<T> {
  const { data, error, status } = await promise
  if (error) throw fromDatabase(error, status)
  return data as T
}
