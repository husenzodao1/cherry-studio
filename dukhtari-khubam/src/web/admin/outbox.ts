'use client'

import { useEffect, useState } from 'react'

import { api, ApiFailure } from '../api'

/**
 * The panel keeps working without a connection: a change made offline (or when the connection drops
 * mid-request) is kept in order on this device and sent by itself as soon as the connection returns.
 * Changes the server then refuses are kept aside with their reason, so nothing is lost silently.
 */
const QUEUE = 'dk.admin_outbox'
const FAILED = 'dk.admin_outbox_failed'
const EVENT = 'dk-admin-outbox'

interface Pending { path: string; method: string; body?: unknown; at: string }
/** What a mutation returns when it waits in the queue (truthy, so callers treat it as saved). */
export const QUEUED = { queued: true } as const

const read = <T,>(key: string): T[] => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as T[]
  } catch {
    return []
  }
}
const write = (key: string, list: unknown[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* storage full: the change stays in memory for this session only */
  }
  window.dispatchEvent(new Event(EVENT))
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false
const isNetwork = (e: unknown) => e instanceof TypeError || (e instanceof ApiFailure && (e.code === 'network' || e.status === 0))

function enqueue(p: Omit<Pending, 'at'>) {
  write(QUEUE, [...read<Pending>(QUEUE), { ...p, at: new Date().toISOString() }])
}

/** A panel change: sent now when it can be, otherwise queued (and sent later by itself). */
export async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  // keep the order: while older changes wait, a new one waits behind them
  if (offline() || read<Pending>(QUEUE).length) {
    enqueue({ path, method, body })
    if (!offline()) flush().catch(() => undefined)
    return QUEUED as unknown as T
  }
  try {
    return await api<T>(path, { method, body })
  } catch (e) {
    if (!isNetwork(e)) throw e
    enqueue({ path, method, body })
    return QUEUED as unknown as T
  }
}

/** A request whose answer is needed at once (a new item's id, an upload slot…): never queued. */
export const sendNow = <T,>(path: string, method: string, body?: unknown) => api<T>(path, { method, body })

let flushing: Promise<void> | null = null
async function sendWaiting(): Promise<void> {
  for (;;) {
    const [next, ...rest] = read<Pending>(QUEUE)
    if (!next || offline()) return
    try {
      await api(next.path, { method: next.method, body: next.body })
    } catch (e) {
      if (isNetwork(e)) return
      write(FAILED, [...read(FAILED), { ...next, error: e instanceof Error ? e.message : String(e) }])
    }
    write(QUEUE, rest)
  }
}
/** Sends the waiting changes in order; stops at the first one the network cannot carry yet. */
export function flush(): Promise<void> {
  if (flushing) return flushing
  // the reset is attached after the assignment, so a run that ends at once cannot leave it set
  flushing = sendWaiting().finally(() => { flushing = null })
  return flushing
}

/** How many changes wait to be sent, and how many the server refused; flushes when online. */
export function useOutbox() {
  const [state, setState] = useState({ waiting: 0, failed: 0 })
  useEffect(() => {
    const update = () => setState({ waiting: read(QUEUE).length, failed: read(FAILED).length })
    const go = () => { flush().catch(() => undefined).finally(update) }
    update()
    go()
    window.addEventListener(EVENT, update)
    window.addEventListener('online', go)
    const every = setInterval(go, 30_000)
    return () => {
      window.removeEventListener(EVENT, update)
      window.removeEventListener('online', go)
      clearInterval(every)
    }
  }, [])
  return { ...state, clearFailed: () => write(FAILED, []) }
}
