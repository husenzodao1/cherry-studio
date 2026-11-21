import { apiUrl } from './base'

/**
 * Support chat client. A thread belongs to this phone through a random token kept here (the server
 * stores only its hash), so a learner who lost both code and password can still write.
 */

const KEY = 'dk.support'

/**
 * `kind`: 'text' a message (hers or a consultant's), 'bot' Mahliyo's answer at once while no consultant
 * is there, 'joined' a consultant has opened the conversation (the body is her name).
 */
export interface SupportMessage { id: string; from_staff: boolean; kind: 'text' | 'bot' | 'joined'; body: string; at: string }
/** `needs_rating`: the conversation is closed and she has not rated its consultant yet. */
export interface SupportThread { id: string; status: 'open' | 'closed'; messages: SupportMessage[]; needs_rating?: boolean }

/** This phone's token, created on first use. */
export function supportToken(create = true): string | null {
  try {
    let token = localStorage.getItem(KEY)
    if (!token && create) {
      token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(KEY, token)
    }
    return token
  } catch {
    return null
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(String(res.status))
  return (await res.json()) as T
}

export const loadThread = (token: string) => post<{ thread: SupportThread | null }>('/support/thread', { token }).then((r) => r.thread)
export const sendMessage = (token: string, body: string, who: { name?: string; username?: string }) =>
  post<SupportThread>('/support/send', { token, body, ...who })
export const unreadReplies = (token: string) => post<{ unread: number }>('/support/unread', { token }).then((r) => r.unread)
export const rateThread = (token: string, rating: number, note?: string) => post<SupportThread>('/support/rate', { token, rating, note })

/** Whether her account is a consultant's, and how many conversations wait for an answer. */
export const consultant = (code: string) => post<{ consultant: boolean; waiting?: number }>('/consultant', { code })
