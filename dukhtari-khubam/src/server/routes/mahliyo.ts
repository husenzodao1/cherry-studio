import type { SupabaseClient } from '@supabase/supabase-js'
import { after } from 'next/server'
import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { answer, ATTACHMENT_MIMES, configured, knowledgeOf, type Attachment, type Learner, type Turn } from '../mahliyo'
import { call } from '../util'
import { buildBundle, Code, codeHash, Token } from './offline'

/**
 * Mahliyo AI (server/mahliyo.ts): whether she is there (the AI key is set on the server), a question to
 * her (recorded for the staff first, with the phone's limits), and the staff's list of every question.
 * In the background (the app's way): the question's id comes back at once, she answers after the reply
 * is sent, and the phone asks for her answer by the id — so it waits for her even when the learner left
 * the chat or closed the app; the learner can stop a question.
 */

/** The course material she reads, built from the published Tajik catalogue at most every 15 minutes. */
let known: { at: number; text: string; app: string } | null = null
async function knowledge(sb: SupabaseClient) {
  if (known && Date.now() - known.at < 15 * 60_000) return known
  const bundle = await buildBundle(sb, 'tg')
  known = { at: Date.now(), text: knowledgeOf(bundle), app: String((bundle.ui as Record<string, string> | undefined)?.['app.name'] ?? 'Духтари хубам') }
  return known
}

// her own answers come back as she gave them (plain text of her blocks), so they may be longer
const Turns = z.array(z.strictObject({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(6000) }))
  .min(1).max(12)
  .refine((t) => t[0].role === 'user' && t[t.length - 1].role === 'user', 'turns must start and end with the learner')
  .refine((t) => t[t.length - 1].content.length <= 1000, 'a question is at most 1000 characters')

/** Her answer to a recorded question, kept with it (or why there is none). */
async function answerInto(sb: SupabaseClient, id: string, turns: Turn[], me: Learner, files: Attachment[]) {
  try {
    const k = await knowledge(sb)
    const a = await answer(turns, k.app, k.text, me, files)
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
    method: 'GET', path: '/mahliyo/status', access: 'public', tag: 'Mahliyo AI', cache: 300,
    summary: 'Whether Mahliyo AI can answer (the AI is set up on the server)',
    handler: async () => ({ ready: configured() })
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
      files: Files.optional()
    }),
    handler: async ({ sb, body }) => {
      if (!configured()) throw new ApiError(503, 'not_configured', 'Маҳлиё ҳоло дастрас нест.')
      const turns = body.turns as Turn[]
      const files = (body.files ?? []) as Attachment[]
      const question = turns[turns.length - 1].content
      const id = await call<string>(sb(), 'api_mahliyo_ask', {
        p_token_hash: codeHash(body.token), p_code_hash: body.code ? codeHash(body.code) : null, p_name: body.name ?? null,
        // the staff see that pictures or files came with it
        p_question: files.length ? `${question.slice(0, 990)} 📎${files.length}` : question
      })
      const me = { me: body.me, now: body.now, tz: body.tz }
      if (body.background) {
        const client = sb()
        after(() => answerInto(client, id, turns, me, files))
        return { id }
      }
      const k = await knowledge(sb())
      let a
      try {
        a = await answer(turns, k.app, k.text, me, files)
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
    method: 'GET', path: '/admin/mahliyo', access: 'staff', tag: 'Admin · support', summary: 'Every question learners asked Mahliyo AI, newest first',
    handler: async ({ sb }) => call(sb(), 'admin_mahliyo_questions')
  })
]
