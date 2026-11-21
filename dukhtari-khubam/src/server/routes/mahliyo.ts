import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { answer, configured, knowledgeOf, type Turn } from '../mahliyo'
import { call } from '../util'
import { buildBundle, Code, codeHash, Token } from './offline'

/**
 * Mahliyo AI (server/mahliyo.ts): whether she is there (the AI key is set on the server), a question to
 * her (recorded for the staff first, with the phone's limits), and the staff's list of every question.
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
      me: z.string().max(4000).optional(), now: z.iso.datetime({ offset: true }).optional(), tz: z.string().max(64).optional()
    }),
    handler: async ({ sb, body }) => {
      if (!configured()) throw new ApiError(503, 'not_configured', 'Маҳлиё ҳоло дастрас нест.')
      const turns = body.turns as Turn[]
      const id = await call<string>(sb(), 'api_mahliyo_ask', {
        p_token_hash: codeHash(body.token), p_code_hash: body.code ? codeHash(body.code) : null,
        p_name: body.name ?? null, p_question: turns[turns.length - 1].content
      })
      const k = await knowledge(sb())
      let a
      try {
        a = await answer(turns, k.app, k.text, { me: body.me, now: body.now, tz: body.tz })
      } catch (e) {
        console.error('[mahliyo] the AI failed', e instanceof Error ? e.message : String(e))
        throw new ApiError(502, 'ai_unavailable', 'Маҳлиё ҳоло ҷавоб дода наметавонад. Каме дертар кӯшиш кунед.')
      }
      await call(sb(), 'api_mahliyo_answer', { p_id: id, p_answer: a.reply, p_tajik: a.tajik }).catch(() => undefined)
      return a
    }
  }),
  route({
    method: 'GET', path: '/admin/mahliyo', access: 'staff', tag: 'Admin · support', summary: 'Every question learners asked Mahliyo AI, newest first',
    handler: async ({ sb }) => call(sb(), 'admin_mahliyo_questions')
  })
]
