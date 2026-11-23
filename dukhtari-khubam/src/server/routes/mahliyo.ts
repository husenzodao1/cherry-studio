import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { z } from 'zod'

import { PROVIDER_IDS, providerOf, type ProviderId } from '@/lib/aiProviders'
import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'
import { supabaseFor } from '@/lib/supabase'

import { answer, ATTACHMENT_MIMES, premiumLive, configured, knowledgePartsOf, knowledgeText, type Attachment, type Knowledge, type Learner, type RedReply, type Turn } from '../mahliyo'
import { activeModel, bookPassages, forgetActive, hasBooks, sealKey, serverReady } from '../aiModels'
import { call } from '../util'
import { buildBundle, Code, codeHash, Token } from './offline'

/**
 * Mahliyo AI (server/mahliyo.ts): whether she is there (the AI key is set on the server), a question to
 * her (recorded for the staff first, with the phone's limits), and the staff's list of every question.
 * In the background (the app's way): the question's id comes back at once, she answers after the reply
 * is sent, and the phone asks for her answer by the id — so it waits for her even when the learner left
 * the chat or closed the app; the learner can stop a question.
 */

/**
 * The course material she reads: the published Tajik catalogue (every lesson, block and test the staff
 * published), built again as soon as the live content stamp changes — so what the panel publishes is in
 * her next answer. Without a stamp (it could not be read), rebuilt at most every 15 minutes.
 */
interface Known { at: number; stamp: string | null; parts: Knowledge; app: string }
let known: Known | null = null
let building: Promise<Known> | null = null
async function knowledge(sb: SupabaseClient): Promise<Known> {
  const stamp = await call<string>(sb, 'api_content_stamp', {}).then(String).catch(() => null)
  if (known && (stamp ? known.stamp === stamp : Date.now() - known.at < 15 * 60_000)) return known
  building ??= buildBundle(sb, 'tg').then((bundle) => {
    const k: Known = { at: Date.now(), stamp, parts: knowledgePartsOf(bundle), app: String((bundle.ui as Record<string, string> | undefined)?.['app.name'] ?? 'LifeHub') }
    known = k
    return k
  }).finally(() => { building = null })
  return building
}
/** what she reads for this conversation: the material nearest her recent questions, when it is all too much */
const materialFor = (k: Knowledge, turns: Turn[]) => knowledgeText(k, turns.filter((t) => t.role === 'user').slice(-3).map((t) => t.content).join(' '))

/** a question may be long (a whole problem pasted in); the staff's list keeps its first 990 characters */
const QUESTION_CAP = 4000
// her own answers come back as she gave them (plain text of her blocks), so they may be longer
const Turns = z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(6000) }))
  .min(1).max(40)
  .refine((t) => t[0].role === 'user' && t[t.length - 1].role === 'user', 'turns must start and end with the learner')
  .refine((t) => t[t.length - 1].content.length <= QUESTION_CAP, 'a question is at most 4000 characters')

/** Her answer to a recorded question, kept with it (or why there is none). */
/** what the server adds to a question: the staff's chosen model, and their books' passages for it */
/** the chosen model, and — for a Premium learner only — the passages of the official books near her question */
/** the staff's red replies (the panel's "Ҷавобҳои сурх"), read again at most every minute */
let redReplies: { at: number; list: RedReply[] } | null = null
/** what is kept in app_settings.ai_warnings: {word, reply} pairs (once, plain texts: replies without a word) */
export function redRepliesOf(value: unknown): RedReply[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((v): RedReply[] => {
    if (typeof v === 'string') return v.trim() ? [{ word: '', reply: v }] : []
    if (v && typeof v === 'object' && typeof (v as RedReply).reply === 'string') {
      const r = v as RedReply
      const more = Array.isArray(r.more) ? r.more.filter((m): m is string => typeof m === 'string' && !!m.trim()) : []
      return [{ word: typeof r.word === 'string' ? r.word : '', reply: r.reply, ...(more.length ? { more } : {}) }]
    }
    return []
  })
}
async function warningsOf(sb: SupabaseClient): Promise<RedReply[]> {
  if (redReplies && Date.now() - redReplies.at < 60_000) return redReplies.list
  const settings = await call<Record<string, unknown>>(sb, 'api_app_settings').catch(() => ({} as Record<string, unknown>))
  const list = redRepliesOf(settings.ai_warnings)
  redReplies = { at: Date.now(), list }
  return list
}
async function extraFor(sb: SupabaseClient, turns: Turn[], premium = false) {
  // before Premium is sold, the books answer everyone (as they always did)
  const [active, books, warnings] = await Promise.all([activeModel(sb), premium || !premiumLive() ? bookPassages(sb, turns[turns.length - 1].content) : Promise.resolve([]), warningsOf(sb)])
  return { active, books, warnings }
}
/** whether the learner who asks has Premium (her session, checked by the database; never what the phone says) */
async function premiumOf(session: string | undefined): Promise<boolean> {
  if (!session) return false
  try {
    return !!(await call<{ premium?: boolean }>(supabaseFor(session), 'api_my_premium')).premium
  } catch {
    return false
  }
}
/** how much of the conversation she reads: a free learner's last 12 turns, a Premium learner's last 40 */
const FREE_TURNS = 12
export function turnsFor(turns: Turn[], premium: boolean): Turn[] {
  if (premium) return turns
  let recent = turns.slice(-FREE_TURNS)
  while (recent.length > 1 && recent[0].role !== 'user') recent = recent.slice(1)
  return recent
}
/** at most this many red replies are kept */
const RED_REPLIES_MAX = 1000
/** whether anyone can answer: the staff chose a model, or the server has a key of its own */
const anyone = async (sb: SupabaseClient) => configured() || !!(await activeModel(sb))

async function answerInto(sb: SupabaseClient, id: string, turns: Turn[], me: Learner, files: Attachment[]) {
  try {
    const [k, extra] = await Promise.all([knowledge(sb), extraFor(sb, turns, !!me.premium)])
    const a = await answer(turns, k.app, materialFor(k.parts, turns), me, files, extra)
    await call(sb, 'api_mahliyo_answer', { p_id: id, p_answer: a.reply, p_tajik: a.tajik, p_blocks: a.blocks })
  } catch (e) {
    console.error('[mahliyo] the AI failed', e instanceof Error ? e.message : String(e))
    await call(sb, 'api_mahliyo_fail', { p_id: id, p_reason: 'busy' }).catch(() => undefined)
  }
}

const Asked = z.strictObject({ token: Token, id: z.uuid() })

/** Pictures and files with the question: at most three, about 3 MB in all (the request's own limit is 4.5 MB). */
const FILES_CAP = 4_300_000
const Files = z.array(z.strictObject({ mime: z.enum(ATTACHMENT_MIMES), name: z.string().trim().min(1).max(120), data: z.base64().min(1) }))
  .max(3)
  .refine((f) => f.reduce((n, x) => n + x.data.length, 0) <= FILES_CAP, 'files_too_big')

export const mahliyoRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/admin/ai/warnings', access: 'staff', tag: 'Admin · Mahliyo',
    summary: "Mahliyo's red replies: a word in the learner's message and her exact answer to it (no word: a general warning)",
    handler: async ({ sb }) => {
      const settings = await call<Record<string, unknown>>(sb(), 'api_app_settings')
      return { items: redRepliesOf(settings.ai_warnings) }
    }
  }),
  route({
    method: 'POST', path: '/admin/ai/warnings', access: 'staff', tag: 'Admin · Mahliyo', summary: "Saves Mahliyo's red replies",
    body: z.strictObject({ items: z.array(z.strictObject({ word: z.string().trim().max(100), reply: z.string().trim().max(400), more: z.array(z.string().trim().max(400)).max(12).optional() })).max(RED_REPLIES_MAX) }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_set_setting', { p_key: 'ai_warnings', p_value: body.items.filter((r) => r.reply).map((r) => (r.more?.some(Boolean) ? { ...r, more: r.more.filter(Boolean) } : { word: r.word, reply: r.reply })) })
      redReplies = null
      return { ok: true }
    }
  }),
  route({
    method: 'GET', path: '/mahliyo/status', access: 'public', tag: 'Mahliyo AI', cache: 300,
    summary: 'Whether Mahliyo AI can answer (the AI is set up on the server)',
    handler: async ({ sb }) => ({ ready: await anyone(sb()) })
  }),
  route({
    method: 'POST', path: '/mahliyo/ask', access: 'public', tag: 'Mahliyo AI',
    summary: "A question to Mahliyo AI (the conversation so far, ending with the learner's question); returns her answer",
    body: z.strictObject({
      token: Token, code: Code.optional(), name: z.string().max(80).optional(), turns: Turns,
      // what the phone knows about the learner (her lessons, results, weak points) and her clock
      me: z.string().max(4000).optional(), now: z.iso.datetime({ offset: true }).optional(), tz: z.string().max(64).optional(),
      // the app's way: { id } at once, her answer from /mahliyo/answer (without it: her answer in the reply)
      background: z.boolean().optional(),
      files: Files.optional(),
      // her sign-in (when she has an account): Premium is checked with it
      session: z.string().max(4000).optional(),
      // her rough place, only when she allowed it ("38.6, 68.8": one decimal, about 10 km)
      place: z.string().regex(/^-?\d{1,2}(\.\d)?, -?\d{1,3}(\.\d)?$/).optional(),
      // the way she asked to be answered (the attach sheet's modes)
      mode: z.enum(['precise', 'science', 'friendly', 'girly', 'exam', 'mmt', 'facts']).optional(),
      // a girl or a boy (the app's mode): a boy is spoken to as a young man
      gender: z.enum(['girl', 'boy']).optional()
    }),
    handler: async ({ sb, body, req }) => {
      if (!(await anyone(sb()))) throw new ApiError(503, 'not_configured', 'Маҳлиё ҳоло дастрас нест.')
      const premium = await premiumOf(body.session)
      const turns = turnsFor(body.turns as Turn[], premium)
      const files = (body.files ?? []) as Attachment[]
      const question = turns[turns.length - 1].content
      const id = await call<string>(sb(), 'api_mahliyo_ask', {
        p_token_hash: codeHash(body.token), p_code_hash: body.code ? codeHash(body.code) : null, p_name: body.name ?? null,
        // the staff see that pictures or files came with it
        p_question: `${question.length > 990 ? `${question.slice(0, 989)}…` : question}${files.length ? ` 📎${files.length}` : ''}`
      })
      // where she is: her rough place if she allowed it; her country and city as her connection shows them
      const ipPlace = [req.headers.get('x-vercel-ip-city'), req.headers.get('x-vercel-ip-country')].filter(Boolean).map((v) => decodeURIComponent(v!)).join(', ')
      const me = { me: body.me, now: body.now, tz: body.tz, premium, place: body.place, region: ipPlace || undefined, mode: body.mode, gender: body.gender }
      if (body.background) {
        const client = sb()
        after(() => answerInto(client, id, turns, me, files))
        // the staff gave her books: when her answer takes a while, the app says she searches them
        return { id, books: (premium || !premiumLive()) && await hasBooks(client) }
      }
      const [k, extra] = await Promise.all([knowledge(sb()), extraFor(sb(), turns, premium)])
      let a
      try {
        a = await answer(turns, k.app, materialFor(k.parts, turns), me, files, extra)
      } catch (e) {
        console.error('[mahliyo] the AI failed', e instanceof Error ? e.message : String(e))
        throw new ApiError(502, 'ai_unavailable', 'Маҳлиё ҳоло ҷавоб дода наметавонад. Каме дертар кӯшиш кунед.')
      }
      await call(sb(), 'api_mahliyo_answer', { p_id: id, p_answer: a.reply, p_tajik: a.tajik, p_blocks: a.blocks }).catch(() => undefined)
      return a
    }
  }),
  route({
    method: 'POST', path: '/mahliyo/answer', access: 'public', tag: 'Mahliyo AI',
    summary: "Her answer to a question asked in the background: { status: 'pending' } while she thinks, 'done' with her answer, or 'failed'",
    body: Asked,
    handler: async ({ sb, body }) => call(sb(), 'api_mahliyo_result', { p_id: body.id, p_token_hash: codeHash(body.token) })
  }),
  route({
    method: 'POST', path: '/mahliyo/stop', access: 'public', tag: 'Mahliyo AI', summary: 'The learner stops a question she asked (a late answer is not kept)',
    body: Asked,
    handler: async ({ sb, body }) => {
      await call(sb(), 'api_mahliyo_stop', { p_id: body.id, p_token_hash: codeHash(body.token) })
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/mahliyo/rate', access: 'public', tag: 'Mahliyo AI', summary: 'The learner marks her answer 👍 (1), 👎 (-1) or takes it back (null)',
    body: Asked.extend({ rating: z.union([z.literal(1), z.literal(-1), z.null()]) }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'api_mahliyo_rate', { p_id: body.id, p_token_hash: codeHash(body.token), p_rating: body.rating })
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/mahliyo/share', access: 'public', tag: 'Mahliyo AI', summary: 'A chat shared as a read-only link (its words only)',
    body: z.strictObject({
      token: Token, title: z.string().trim().min(1).max(200),
      turns: z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().max(QUESTION_CAP > 6000 ? QUESTION_CAP : 6000), blocks: z.array(z.record(z.string(), z.unknown())).max(16).optional() })).min(1).max(60)
    }),
    handler: async ({ sb, body }) => ({ id: await call<string>(sb(), 'api_mahliyo_share', { p_token_hash: codeHash(body.token), p_title: body.title, p_turns: body.turns }) })
  }),
  route({
    method: 'GET', path: '/mahliyo/shared', access: 'public', tag: 'Mahliyo AI', summary: 'A shared chat, by its link', cache: 300,
    query: z.object({ id: z.uuid() }),
    handler: async ({ sb, query }) => call(sb(), 'api_mahliyo_shared', { p_id: query.id })
  }),
  // ── the staff: who answers (provider keys, a model), and her books ──
  route({
    method: 'GET', path: '/admin/ai', access: 'staff', tag: 'Admin · Mahliyo AI', summary: 'Which providers have a key (its last characters only) and which model answers',
    handler: async ({ sb }) => ({ ...(await call<Record<string, unknown>>(sb(), 'admin_ai_settings')), server: serverReady() })
  }),
  route({
    method: 'POST', path: '/admin/ai/key', access: 'staff', tag: 'Admin · Mahliyo AI',
    summary: "A provider's key saved in a model's box (checked with the provider first, kept encrypted): that model answers from now on",
    body: z.strictObject({ provider: z.enum(PROVIDER_IDS), model: z.string().trim().min(1).max(120), key: z.string().trim().min(8).max(400) }),
    handler: async ({ sb, body }) => {
      if (!serverReady()) throw new ApiError(503, 'not_configured', 'Рамзи сервер (MAHLIYO_SERVER_SECRET) гузошта нашудааст.')
      await checkKey(body.provider, body.key)
      await call(sb(), 'admin_ai_set_key', { p_provider: body.provider, p_cipher: sealKey(body.key), p_hint: `…${body.key.slice(-4)}`, p_model: body.model })
      forgetActive()
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/ai/activate', access: 'staff', tag: 'Admin · Mahliyo AI', summary: "Another model of a provider whose key is saved answers (provider null: the app's default)",
    body: z.strictObject({ provider: z.enum(PROVIDER_IDS).nullable(), model: z.string().trim().min(1).max(120).nullable() }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_ai_activate', { p_provider: body.provider, p_model: body.model })
      forgetActive()
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/ai/forget', access: 'staff', tag: 'Admin · Mahliyo AI', summary: "A provider's key forgotten",
    body: z.strictObject({ provider: z.enum(PROVIDER_IDS) }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_ai_forget_key', { p_provider: body.provider })
      forgetActive()
      return { ok: true }
    }
  }),
  route({
    method: 'GET', path: '/admin/books', access: 'staff', tag: 'Admin · Mahliyo AI', summary: 'The books Mahliyo learnt from',
    handler: async ({ sb }) => call(sb(), 'admin_books')
  }),
  route({
    method: 'POST', path: '/admin/books/start', access: 'staff', tag: 'Admin · Mahliyo AI', summary: 'A new book (its text follows in pieces)',
    body: z.strictObject({ title: z.string().trim().min(1).max(300), file: z.string().max(300).optional(), pages: z.number().int().min(0).max(100_000).optional() }),
    handler: async ({ sb, body }) => ({ id: await call<string>(sb(), 'admin_book_start', { p_title: body.title, p_file: body.file ?? null, p_pages: body.pages ?? null }) })
  }),
  route({
    method: 'POST', path: '/admin/books/chunks', access: 'staff', tag: 'Admin · Mahliyo AI', summary: "A batch of a book's passages",
    body: z.strictObject({ book: z.uuid(), chunks: z.array(z.strictObject({ n: z.number().int().min(0), page: z.number().int().min(0).nullable(), text: z.string().max(4000) })).min(1).max(400) }),
    handler: async ({ sb, body }) => ({ saved: await call<number>(sb(), 'admin_book_chunks', { p_book: body.book, p_chunks: body.chunks }) })
  }),
  route({
    method: 'POST', path: '/admin/books/done', access: 'staff', tag: 'Admin · Mahliyo AI', summary: 'A book is all there: she answers from it',
    body: z.strictObject({ book: z.uuid() }),
    handler: async ({ sb, body }) => { await call(sb(), 'admin_book_done', { p_book: body.book }); return { ok: true } }
  }),
  route({
    method: 'POST', path: '/admin/books/remove', access: 'staff', tag: 'Admin · Mahliyo AI', summary: 'A book taken away (she no longer answers from it)',
    body: z.strictObject({ book: z.uuid() }),
    handler: async ({ sb, body }) => { await call(sb(), 'admin_book_remove', { p_book: body.book }); return { ok: true } }
  }),
  route({
    method: 'GET', path: '/admin/mahliyo', access: 'staff', tag: 'Admin · support', summary: 'Every question learners asked Mahliyo AI, newest first',
    handler: async ({ sb }) => call(sb(), 'admin_mahliyo_questions')
  })
]

/** A key is tried with its provider before it is kept (its list of models): a wrong key is said at once. */
async function checkKey(provider: ProviderId, key: string) {
  const info = providerOf(provider)!
  const req = provider === 'anthropic'
    ? fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(10_000) })
    : provider === 'google'
      ? fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(10_000) })
      : fetch(`${info.base}/models`, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) })
  let res: Response
  try {
    res = await req
  } catch {
    throw new ApiError(502, 'provider_unreachable', `${info.name} ҷавоб надод. Каме дертар кӯшиш кунед.`)
  }
  if (res.status === 401 || res.status === 403) throw new ApiError(400, 'bad_key', `${info.name} ин калидро қабул накард.`)
  if (!res.ok && res.status !== 429) throw new ApiError(502, 'provider_error', `${info.name}: хатои ${res.status}.`)
}
