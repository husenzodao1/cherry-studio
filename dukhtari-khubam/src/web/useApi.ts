'use client'

import { useCallback, useEffect, useState } from 'react'

import { api, ApiFailure } from './api'
import { useAuth } from './auth'

export interface ApiState<T> {
  data: T | undefined
  error: ApiFailure | undefined
  loading: boolean
  reload: () => void
}

/**
 * Stale-while-revalidate memory cache: a page seen before renders instantly from the last
 * response while a fresh copy loads; identical requests in flight are shared.
 */
const cache = new Map<string, unknown>()
// the panel's own data is also kept on the device, so the panel opens without a connection
const KEEP = /^\/(admin\/|me$)/
const stored = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(`dk.api:${key}`)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}
const keep = (key: string, path: string, data: unknown) => {
  if (!KEEP.test(path)) return
  try {
    localStorage.setItem(`dk.api:${key}`, JSON.stringify(data))
  } catch {
    /* storage full: memory only */
  }
}
const remembered = (key: string, path: string | null) => {
  if (cache.has(key)) return cache.get(key)
  if (!path || !KEEP.test(path) || typeof window === 'undefined') return undefined
  const v = stored(key)
  if (v !== undefined) cache.set(key, v)
  return v
}
const inflight = new Map<string, Promise<unknown>>()

function load<T>(key: string, path: string): Promise<T> {
  let p = inflight.get(key) as Promise<T> | undefined
  if (!p) {
    p = api<T>(path).finally(() => inflight.delete(key))
    inflight.set(key, p)
  }
  return p
}

/** Loading / error / success state for a GET endpoint; refetches when the session changes. */
export function useApi<T>(path: string | null): ApiState<T> {
  const { session } = useAuth()
  const userKey = session?.user.id ?? 'anon'
  const key = path ? `${userKey}|${path}` : ''
  const [state, setState] = useState<{ data?: T; error?: ApiFailure; loading: boolean }>(() => {
    const kept = key ? remembered(key, path) : undefined
    return kept !== undefined ? { data: kept as T, loading: false } : { loading: !!path }
  })
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (!path) {
      setState({ loading: false })
      return
    }
    let alive = true
    const cached = remembered(key, path) as T | undefined
    setState(cached !== undefined ? { data: cached, loading: false } : (s) => ({ ...s, loading: true, error: undefined }))
    load<T>(key, path)
      .then((data) => {
        cache.set(key, data)
        keep(key, path, data)
        if (alive) setState({ data, loading: false })
      })
      .catch((error: unknown) => {
        if (!alive) return
        const failure = error instanceof ApiFailure ? error : new ApiFailure(0, 'network', 'Пайваст нест.')
        // keep showing the last good data when a background refresh fails
        setState((s) => (s.data !== undefined ? { ...s, loading: false } : { loading: false, error: failure }))
      })
    return () => {
      alive = false
    }
  }, [path, key, nonce])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
