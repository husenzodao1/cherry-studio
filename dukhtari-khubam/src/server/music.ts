/**
 * Mahliyo's songs: made by Google's Lyria 3 through the Gemini API (Interactions API). A 30-second clip by
 * default (lyria-3-clip-preview); a whole song (lyria-3.5) when asked for and allowed. The key is
 * LYRIA_API_KEY, else the Gemini keys (GEMINI_API_KEY…); the model may be changed with LYRIA_MODEL /
 * LYRIA_MODEL_LONG. Without a key the song's words and plan are still written by Mahliyo, and the app says
 * that the music will come once the service is connected.
 */
import { ApiError } from '@/lib/http'

import { geminiKeys } from './mahliyo'

const URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const CLIP = () => process.env.LYRIA_MODEL?.trim() || 'lyria-3-clip-preview'
const LONG = () => process.env.LYRIA_MODEL_LONG?.trim() || 'lyria-3.5'
const keys = () => [process.env.LYRIA_API_KEY, ...geminiKeys()].map((k) => k?.trim()).filter((k): k is string => !!k)

export const musicReady = () => keys().length > 0

export interface SongAsk {
  title: string
  /** what it should sound like: genre, style, mood, instruments, tempo, voice */
  prompt: string
  genre?: string
  /** the words to sing (with [Verse] / [Chorus] marks); none: she sings what fits, or plays */
  lyrics?: string
  instrumental?: boolean
  /** a whole song instead of a 30-second clip */
  long?: boolean
}
export interface Song { audio: string; mime: string; text: string; model: string }

/** What Lyria is asked: one plain prompt (the API takes the lyrics and the plan in the prompt itself). */
export function songPrompt(a: SongAsk): string {
  return [
    `Song title: "${a.title}".`,
    a.genre ? `Genre: ${a.genre}.` : '',
    a.prompt,
    a.long ? 'A complete song of about 2 minutes with intro, verses, chorus and outro.' : '',
    a.instrumental ? 'Instrumental only, no vocals.' : a.lyrics?.trim() ? `Sing exactly these lyrics:\n${a.lyrics.trim()}` : 'With vocals; write fitting, decent lyrics.',
    'Clean, family-friendly content. No imitation of any real artist.'
  ].filter(Boolean).join('\n')
}

/** The audio and the lyrics in Lyria's answer (its steps → model_output → audio / text blocks). */
export function songOf(body: unknown): { audio: string; mime: string; text: string } | null {
  const b = (body ?? {}) as Record<string, any>
  const blocks: Record<string, any>[] = []
  for (const s of Array.isArray(b.steps) ? b.steps : []) if (s?.type === 'model_output' && Array.isArray(s.content)) blocks.push(...s.content)
  if (Array.isArray(b.outputs)) blocks.push(...b.outputs)
  if (b.output_audio) blocks.push({ type: 'audio', ...b.output_audio })
  const audio = blocks.find((c) => c?.type === 'audio' && typeof c.data === 'string')
  if (!audio) return null
  const text = blocks.filter((c) => c?.type === 'text' && typeof c.text === 'string').map((c) => c.text).join('\n').trim() || (typeof b.output_text === 'string' ? b.output_text : '')
  return { audio: audio.data, mime: typeof audio.mime_type === 'string' ? audio.mime_type : 'audio/mpeg', text }
}

/** Makes the song: each key in turn (each has its own quota); a refusal by its safety filter is said plainly. */
export async function makeSong(a: SongAsk): Promise<Song> {
  const all = keys()
  if (!all.length) throw new ApiError(503, 'not_configured', 'Хизмати мусиқӣ ҳанӯз пайваст нашудааст.')
  const model = a.long ? LONG() : CLIP()
  let last = ''
  for (const key of all) {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json', 'api-revision': '2026-05-20' },
      body: JSON.stringify({ model, input: songPrompt(a) }),
      signal: AbortSignal.timeout(170_000)
    }).catch((e: unknown) => { last = e instanceof Error ? e.message : String(e); return null })
    if (!res) continue
    if (res.status === 429 || res.status === 401 || res.status === 403) { last = `HTTP ${res.status}`; continue }
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      last = `HTTP ${res.status}`
      if (res.status === 400) throw new ApiError(422, 'song_refused', 'Ин сурудро сохтан нашуд (матн ё дархост қабул нашуд). Тавсифро дигар кунед.')
      continue
    }
    const song = songOf(body)
    if (song) return { ...song, model }
    last = 'no audio'
  }
  console.warn('[music] failed:', last)
  throw new ApiError(502, 'provider_error', 'Мусиқӣ ҳоло сохта нашуд. Каме баъд боз кӯшиш кунед.')
}
