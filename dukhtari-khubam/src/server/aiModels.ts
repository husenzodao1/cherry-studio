import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { providerOf, type ProviderId } from '@/lib/aiProviders'

import { call } from './util'

/**
 * The model the staff chose for Mahliyo (panel → "Моделҳо") and the books they taught her (→ "Китобҳо").
 * Provider keys are kept encrypted (AES-256-GCM) with MAHLIYO_SERVER_SECRET, which only the server has;
 * the database gives the encrypted key and the books' passages only to a caller that proves it is the
 * server (the same secret). Without the secret, she answers as before (the keys of the environment).
 */

const secret = () => process.env.MAHLIYO_SERVER_SECRET?.trim() || ''
export const serverReady = () => secret().length >= 32
const keyOf = () => createHash('sha256').update(`${secret()}:mahliyo-keys`).digest()

/** a provider key, encrypted for the database: iv.tag.data (base64url) */
export function sealKey(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', keyOf(), iv)
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.')
}
export function openKey(sealed: string): string {
  const [iv, tag, data] = sealed.split('.').map((p) => Buffer.from(p, 'base64url'))
  const d = createDecipheriv('aes-256-gcm', keyOf(), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(data), d.final()]).toString('utf8')
}

export interface ActiveModel { provider: ProviderId; model: string; key: string }

/** the chosen model, looked at again at most every half minute (a key saved in the panel answers soon) */
let active: { at: number; value: ActiveModel | null } | null = null
export async function activeModel(sb: SupabaseClient): Promise<ActiveModel | null> {
  if (!serverReady()) return null
  if (active && Date.now() - active.at < 30_000) return active.value
  let value: ActiveModel | null = null
  try {
    const r = await call<{ provider: ProviderId; model: string; cipher: string } | null>(sb, 'api_ai_active', { p_proof: secret() })
    if (r?.cipher && providerOf(r.provider)) value = { provider: r.provider, model: r.model, key: openKey(r.cipher) }
  } catch (e) {
    console.warn('[mahliyo] the chosen model could not be read:', e instanceof Error ? e.message : String(e))
  }
  active = { at: Date.now(), value }
  return value
}
/** forgets the chosen model at once (after the panel changed it) */
export const forgetActive = () => { active = null }

export interface BookPassage { book: string; page: number | null; text: string }

/** the words of a question as the books' search wants them: each word's beginning (Tajik letters as Russian ones) */
export function bookQuery(question: string): string {
  const words = (question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])
    .map((w) => w.replace(/ӣ/g, 'и').replace(/ӯ/g, 'у').replace(/қ/g, 'к').replace(/ҳ/g, 'х').replace(/ҷ/g, 'ч').replace(/ғ/g, 'г').replace(/ё/g, 'е'))
    .filter((w) => !STOP.has(w))
    .map((w) => w.slice(0, 6))
  return [...new Set(words)].slice(0, 12).map((w) => `${w}:*`).join(' | ')
}
/** words every question has (written with Russian letters, as above) */
const STOP = new Set(['чист', 'кист', 'барои', 'дар', 'бораи', 'аст', 'мебошад', 'чанд', 'кадом', 'ман', 'шумо', 'мумкин', 'метавонам', 'лутфан', 'бигуед', 'гуед', 'чи', 'что', 'как', 'для', 'это', 'про', 'the', 'what', 'how', 'and', 'for', 'who'])

/** the passages of the staff's books nearest a question (a few milliseconds; nothing when there are none) */
export async function bookPassages(sb: SupabaseClient, question: string, limit = 4): Promise<BookPassage[]> {
  const q = bookQuery(question)
  if (!serverReady() || !q) return []
  try {
    return await call<BookPassage[]>(sb, 'api_books_search', { p_proof: secret(), p_query: q, p_limit: limit })
  } catch (e) {
    console.warn('[mahliyo] the books could not be searched:', e instanceof Error ? e.message : String(e))
    return []
  }
}

/** whether the staff gave her any books (the app then says, when an answer takes a while, that she searches them) */
let booksCount: { at: number; n: number } | null = null
export async function hasBooks(sb: SupabaseClient): Promise<boolean> {
  if (booksCount && Date.now() - booksCount.at < 60_000) return booksCount.n > 0
  const n = await call<number>(sb, 'api_books_count', {}).catch(() => 0)
  booksCount = { at: Date.now(), n }
  return n > 0
}

/**
 * An OpenAI-compatible chat (OpenAI, DeepSeek, xAI, Mistral): the answer as JSON text. Pictures go to the
 * providers that see them (OpenAI, xAI); PDFs only as their names.
 */
export async function askCompatible(m: ActiveModel, system: string, turns: { role: 'user' | 'assistant'; content: string }[],
  files: { mime: string; name: string; data: string }[], timeoutMs = 60_000): Promise<string | null> {
  const base = providerOf(m.provider)?.base
  if (!base) throw new Error(`no chat API for ${m.provider}`)
  const seesPictures = m.provider === 'openai' || m.provider === 'xai'
  const messages = [
    { role: 'system', content: system },
    ...turns.map((t, i) => {
      if (i !== turns.length - 1 || !files.length) return { role: t.role, content: t.content }
      const parts: unknown[] = []
      for (const f of files) {
        if (f.mime.startsWith('image/') && seesPictures) parts.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } })
        else if (f.mime === 'text/plain') parts.push({ type: 'text', text: `Файл «${f.name}»:\n${Buffer.from(f.data, 'base64').toString('utf8').slice(0, 20_000)}` })
        else parts.push({ type: 'text', text: `[Файл «${f.name}» (${f.mime}) — ин модел онро дида наметавонад]` })
      }
      parts.push({ type: 'text', text: t.content })
      return { role: t.role, content: parts }
    })
  ]
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${m.key}` },
    body: JSON.stringify({ model: m.model, messages, response_format: { type: 'json_object' }, max_tokens: 6000 }),
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new Error(`${m.provider} ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string; refusal?: string | null }; finish_reason?: string }[] }
  const choice = data.choices?.[0]
  if (!choice || choice.message?.refusal || choice.finish_reason === 'content_filter') return null
  return choice.message?.content ?? ''
}
