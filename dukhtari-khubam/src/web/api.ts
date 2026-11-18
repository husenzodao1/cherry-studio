'use client'

import { apiUrl } from './offline/base'
import { browserSupabase } from './supabase-browser'

export class ApiFailure extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) {
    super(message)
  }
}

async function token(): Promise<string | null> {
  const sb = browserSupabase()
  if (!sb) return null
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

/** Calls the versioned backend API as the signed-in user (if any). */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const t = await token()
  if (t) headers.authorization = `Bearer ${t}`
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(apiUrl(path), {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: init.signal
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const e = data?.error ?? {}
    throw new ApiFailure(res.status, e.code ?? 'error', e.message ?? 'Хато', e.details)
  }
  return data as T
}
