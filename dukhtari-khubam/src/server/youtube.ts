import type { SupabaseClient } from '@supabase/supabase-js'

import { secret } from './aiModels'
import { call } from './util'

/**
 * Songs found on YouTube (YouTube Data API v3, YOUTUBE_API_KEY): music videos that may be played inside other
 * apps, safe for her age. A search costs 100 of the day's 10,000 quota units, so each one is kept for a week for
 * everyone (in the database) and asked of YouTube only once. They play in the app's own YouTube player, on the
 * screen (YouTube does not allow playing them in the background).
 */

export interface Song { id: string; title: string; channel: string; thumb: string }

export const youtubeReady = () => !!process.env.YOUTUBE_API_KEY?.trim()

const ENTITIES: Record<string, string> = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' }
const plain = (s: string) => s.replace(/&(amp|quot|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m)

interface Found { items?: { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> } }[]; error?: { message?: string } }

export async function searchYouTube(q: string, lang: string, fetcher: typeof fetch = fetch): Promise<Song[]> {
  const params = new URLSearchParams({
    part: 'snippet', type: 'video', videoCategoryId: '10', videoEmbeddable: 'true', safeSearch: 'strict', maxResults: '6',
    q, relevanceLanguage: lang === 'prs' ? 'fa' : lang, key: process.env.YOUTUBE_API_KEY!.trim()
  })
  const res = await fetcher(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(8000) })
  const d = (await res.json()) as Found
  if (!res.ok) throw new Error(`youtube ${res.status}: ${d.error?.message ?? ''}`)
  return (d.items ?? []).flatMap((it) => {
    const id = it.id?.videoId
    if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return []
    const t = it.snippet?.thumbnails ?? {}
    return [{ id, title: plain(it.snippet?.title ?? ''), channel: plain(it.snippet?.channelTitle ?? ''), thumb: t.medium?.url ?? t.high?.url ?? t.default?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` }]
  })
}

/** songs for her words: kept ones first, else YouTube (then kept) */
export async function findSongs(sb: SupabaseClient, q: string, lang: string, fetcher: typeof fetch = fetch): Promise<Song[]> {
  const words = q.replace(/\s+/g, ' ').trim().slice(0, 200)
  const kept = await call<Song[] | null>(sb, 'api_music_cached', { p_proof: secret(), p_q: words }).catch(() => null)
  if (kept) return kept
  const songs = await searchYouTube(words, lang, fetcher)
  if (songs.length) await call(sb, 'api_music_keep', { p_proof: secret(), p_q: words, p_items: songs }).catch(() => undefined)
  return songs
}
