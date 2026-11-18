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

/** Loading / error / success state for a GET endpoint; refetches when the session changes. */
export function useApi<T>(path: string | null): ApiState<T> {
  const { session } = useAuth()
  const [state, setState] = useState<{ data?: T; error?: ApiFailure; loading: boolean }>({ loading: !!path })
  const [nonce, setNonce] = useState(0)
  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const userKey = session?.user.id ?? 'anon'

  useEffect(() => {
    if (!path) {
      setState({ loading: false })
      return
    }
    const ctrl = new AbortController()
    setState((s) => ({ ...s, loading: true, error: undefined }))
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ data, loading: false }))
      .catch((error: unknown) => {
        if (ctrl.signal.aborted) return
        setState({
          loading: false,
          error: error instanceof ApiFailure ? error : new ApiFailure(0, 'network', 'Пайваст нест.')
        })
      })
    return () => ctrl.abort()
  }, [path, nonce, userKey])

  return { data: state.data, error: state.error, loading: state.loading, reload }
}
