import type { SupabaseClient } from '@supabase/supabase-js'

import type { AiBlock as Block } from '@/lib/aiCatalog'

import { secret, serverReady } from './aiModels'
import { call } from './util'

/**
 * Mahliyo's memory of what she said and found: an answer to a general question (the same for everyone) is kept
 * 30 days and given again at once, free; the internet's results for a question are kept a week. Nothing personal
 * is kept: only a conversation's first question, with no pictures or files, not about her (ман, мой, my…), not
 * about now (today, news, prices), and an answer made of plain blocks — her name in it is kept as {ном}.
 */

export interface Cache {
  get<T>(kind: 'answer' | 'web', key: string, days: number): Promise<T | null>
  put(kind: 'answer' | 'web', key: string, value: unknown): Promise<void>
}

export const dbCache = (sb: SupabaseClient): Cache | undefined => (serverReady() ? {
  get: <T>(kind: string, key: string, days: number) => call<T | null>(sb, 'api_cache_get', { p_proof: secret(), p_kind: kind, p_key: key, p_days: days }).catch(() => null),
  put: (kind: string, key: string, value: unknown) => call<void>(sb, 'api_cache_put', { p_proof: secret(), p_kind: kind, p_key: key, p_value: value }).then(() => undefined, () => undefined)
} : undefined)

/** a question as the cache compares it: lower case, letters and digits, Tajik letters as Russian ones */
export const normalQuestion = (q: string) => q.toLowerCase()
  .replace(/ӣ/g, 'и').replace(/ӯ/g, 'у').replace(/қ/g, 'к').replace(/ҳ/g, 'х').replace(/ҷ/g, 'ч').replace(/ғ/g, 'г').replace(/ё/g, 'е')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 240)

/** about her, about now, or a request to do something: never kept */
const PERSONAL = /(?<!\p{L})(ман|маро|манро|барои\s+ман|ба\s+ман|аз\s+ман|номам|номи\s+ман|ёдам|занг|ёдрас|я|мне|меня|мой|моя|мое|мои|напомни|позвони|i|me|my|mine|remind|call)(?!\p{L})/iu
const NOW = /(имрӯз|имруз|фардо|дирӯз|ҳозир|ҳоло|хабар|нарх|қурб|курс|сегодня|завтра|вчера|сейчас|новост|цен|today|tomorrow|yesterday|now|news|price|rate|weather|обу\s*ҳаво|погод)/iu
/** blocks that are the same for everyone */
const PLAIN = new Set(['text', 'steps', 'choices', 'callout', 'calc', 'follow', 'link', 'screen', 'sources', 'images', 'quiz'])

/** the key an answer may be kept under, or null when it must not be */
export function answerKey(turns: { role: string; content: string }[], files: number, o: { lang: string; mode?: string; gender?: string; study?: unknown }): string | null {
  if (turns.length !== 1 || files || o.study) return null
  const q = turns[0].content.trim()
  if (q.length < 6 || q.length > 300 || PERSONAL.test(q) || NOW.test(q)) return null
  const n = normalQuestion(q)
  return n.length >= 5 ? `${o.lang}|${o.mode ?? ''}|${o.gender === 'boy' ? 'b' : 'g'}|${n}` : null
}

/** an answer as it may be kept (her name as {ном}), or null when it has anything not for everyone */
export function storable<A extends { blocks: Block[]; reply: string; tajik: boolean }>(a: A, name: string): A | null {
  if (!a.blocks.length || a.blocks.some((b) => !PLAIN.has(b.type))) return null
  if (!name) return a
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<!\\p{L})${esc}(?!\\p{L})`, 'gu')
  const json = JSON.stringify(a).replace(re, '{ном}')
  // her name left in another form ("Маликаи азиз", "Маликаҷон"): not kept at all
  if (json.toLowerCase().includes(name.toLowerCase())) return null
  return JSON.parse(json) as A
}
