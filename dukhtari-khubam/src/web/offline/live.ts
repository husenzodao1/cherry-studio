'use client'

import { browserSupabase } from '../supabase-browser'

/**
 * Live content: staff changes in the panel move one stamp in the database (public.content_stamp).
 * The app reads it cheaply straight from Supabase and listens to it through Realtime, so an edit shows
 * on every open phone and browser within seconds. When the database does not offer the stamp yet,
 * `readStamp` gives null and the app falls back to asking for the content itself.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function readStamp(): Promise<string | null> {
  if (!URL_ || !KEY) return null
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/api_content_stamp`, {
      method: 'POST',
      headers: { apikey: KEY, authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: '{}',
      cache: 'no-store'
    })
    if (!res.ok) return null
    const v = await res.json()
    return typeof v === 'string' && /^[0-9T.]{1,40}$/.test(v) ? v : null
  } catch {
    return null
  }
}

/** Calls `onChange` whenever the stamp row changes (Supabase Realtime). Returns the unsubscribe. */
export function watchStamp(onChange: () => void): () => void {
  const sb = browserSupabase()
  if (!sb) return () => undefined
  const channel = sb
    .channel('content-stamp')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'content_stamp' }, () => onChange())
    .subscribe()
  return () => {
    sb.removeChannel(channel).catch(() => undefined)
  }
}
