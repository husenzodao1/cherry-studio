'use client'

import { browserSupabase } from '../supabase-browser'

/**
 * Logins, profiles and contacts (the database's api_social_* functions, called with her code as everywhere in
 * the app). Her WhatsApp, Telegram and Instagram reach only the contacts she accepted; under 16, only someone in
 * her class can send her a request.
 */

export type Network = 'whatsapp' | 'telegram' | 'instagram'
export type Links = Partial<Record<Network, string>>
export interface Me { login: string; links: Links; minor: boolean; requests: number; classes?: boolean }
export interface Profile {
  login: string; name: string; since: string; achievements: number; lessons: number
  has: Network[]; links: Links | null; status: 'none' | 'sent' | 'received' | 'contact' | 'me'; can_request: boolean
}
export interface Person { login: string; name: string; note?: string | null; at?: string; links?: Links }
export interface Requests { received: Person[]; sent: Person[]; contacts: Person[] }

export class SocialError extends Error {}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = browserSupabase()
  if (!sb) throw new SocialError('offline')
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new SocialError(/login_taken|bad_login|not_allowed|too_many|not_found|unauthorized/.exec(error.message)?.[0] ?? 'failed')
  return data as T
}

export const socialMe = (code: string) => rpc<Me>('api_social_me', { p_code: code })
export const setLogin = (code: string, login: string) => rpc<{ login: string }>('api_social_set_login', { p_code: code, p_login: login })
export const setLinks = (code: string, links: Links) => rpc<Links>('api_social_set_links', { p_code: code, p_links: links })
export const profileOf = (login: string, code?: string) => rpc<Profile>('api_social_profile', { p_login: login, p_code: code ?? null })
export const searchLogins = (q: string, code?: string) => rpc<{ login: string; name: string }[]>('api_social_search', { p_query: q, p_code: code ?? null })
export const sendRequest = (code: string, login: string, note?: string) => rpc<{ status: string }>('api_social_request', { p_code: code, p_login: login, p_note: note ?? null })
export const myRequests = (code: string) => rpc<Requests>('api_social_requests', { p_code: code })
export const answerRequest = (code: string, login: string, accept: boolean) => rpc<{ status: string }>('api_social_answer', { p_code: code, p_login: login, p_accept: accept })
export const removeContact = (code: string, login: string) => rpc<void>('api_social_remove', { p_code: code, p_login: login })
export const blockProfile = (code: string, login: string, reason?: string) => rpc<void>('api_social_block', { p_code: code, p_login: login, p_reason: reason ?? null })
export const createClass = (code: string, name: string) => rpc<{ id: string; name: string; join_code: string }>('api_class_create', { p_code: code, p_name: name })
export const joinClass = (code: string, join: string) => rpc<{ id: string; name: string }>('api_class_join', { p_code: code, p_join: join })

/** where a contact's link opens: WhatsApp, Telegram or Instagram */
export function linkUrl(network: Network, value: string): string {
  if (network === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`
  if (network === 'telegram') return `https://t.me/${encodeURIComponent(value)}`
  return `https://instagram.com/${encodeURIComponent(value)}`
}
