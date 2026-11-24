import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { secret, serverReady } from '../aiModels'
import { geminiKeys } from '../mahliyo'
import { limitReached, onTrial, planOf, planSettings, use, useTrial, whoOf, type PlanCtx } from '../plans'
import { call } from '../util'
import { codeHash, Token } from './offline'

/**
 * ММТ: the subjects and programmes for everyone, a mock exam's questions (counted against her plan: twice on the
 * free trial, then by the month's ММТ tests), and the staff's side — subjects, the test bank, programmes with
 * last year's passing scores, and questions drawn out of a test book's text by the AI for the staff to check.
 */

const SubjectId = z.string().regex(/^[a-z0-9_]{2,40}$/)
const QuestionIn = z.strictObject({
  question: z.string().trim().min(3).max(2000), options: z.array(z.string().trim().min(1).max(500)).min(2).max(6), answer: z.number().int().min(0).max(5),
  explanation: z.string().max(2000).optional(), topic: z.string().max(120).optional(), difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  source: z.string().max(200).optional()
}).refine((q) => q.answer < q.options.length, 'answer_out_of_options')
const ProgramIn = z.strictObject({
  university: z.string().trim().min(1).max(200), specialty: z.string().trim().min(1).max(200), code: z.string().max(40).optional(),
  cluster: z.number().int().min(1).max(5), year: z.number().int().min(2000).max(2100), form: z.enum(['budget', 'contract', 'quota']).default('budget'),
  min_score: z.number().min(0).max(100_000), places: z.number().int().min(0).max(100_000).optional(), city: z.string().max(80).optional()
})

/** the AI that reads a test book: the careful model first */
const EXTRACT_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest']
const EXTRACT_RULES = `You read pages of an official test book of Tajikistan's national entrance exams (ММТ) and copy out its test questions EXACTLY as printed — never invent, never change a word, a number or a formula, never answer from your own knowledge.
For each complete question: "question" (its text), "options" (its answer choices in order, without the letters A/B/C/D), "answer" (the number of the right option counted from 0 — ONLY when the book marks or lists the right answer; otherwise -1), "explanation" (the book's own solution or comment, else ""), "topic" (a short topic name in the book's language), "difficulty" (1 easy, 2 middle, 3 hard — your estimate).
Skip anything that is not a full multiple-choice question. Keep the book's language. Return a JSON array.`
const EXTRACT_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, answer: { type: 'integer' },
      explanation: { type: 'string' }, topic: { type: 'string' }, difficulty: { type: 'integer' }
    },
    required: ['question', 'options', 'answer']
  }
}

export interface Extracted { question: string; options: string[]; answer: number; explanation?: string; topic?: string; difficulty?: number }
/** questions copied out of a test book's text (the staff check them before they are saved); null when no AI answered */
export async function extractQuestions(text: string, keys = geminiKeys()): Promise<Extracted[] | null> {
  for (const model of EXTRACT_MODELS) {
    for (const key of keys) {
      try {
        const r = await new GoogleGenAI({ apiKey: key, httpOptions: { retryOptions: { attempts: 1 } } }).models.generateContent({
          model, contents: text,
          config: { systemInstruction: EXTRACT_RULES, responseMimeType: 'application/json', responseJsonSchema: EXTRACT_SCHEMA, temperature: 0, httpOptions: { timeout: 120_000 } }
        })
        const out = JSON.parse(r.text ?? '[]') as unknown
        if (!Array.isArray(out)) continue
        return out.filter((q): q is Extracted => !!q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === 'number')
          .map((q) => ({ ...q, difficulty: q.difficulty === 1 || q.difficulty === 3 ? q.difficulty : 2 }))
      } catch (e) {
        console.warn('[mmt] extract', model, String(e instanceof Error ? e.message : e).slice(0, 140))
      }
    }
  }
  return null
}

export const mmtRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/mmt/catalog', access: 'public', tag: 'ММТ', summary: 'The subjects (by cluster, with their points and how many questions) and the exam\'s day', cache: 300,
    handler: async ({ sb }) => call(sb(), 'api_mmt_catalog')
  }),
  route({
    method: 'GET', path: '/mmt/programs', access: 'public', tag: 'ММТ', summary: 'The programmes of a cluster with last year\'s passing scores', cache: 600,
    query: z.object({ cluster: z.coerce.number().int().min(1).max(5) }),
    handler: async ({ sb, query }) => ({ programs: await call(sb(), 'api_mmt_programs', { p_cluster: query.cluster }) })
  }),
  route({
    method: 'POST', path: '/mmt/exam', access: 'public', tag: 'ММТ',
    summary: 'A mock exam\'s questions (each subject: `per` of each difficulty; the phone asks them adaptively), counted against her plan',
    body: z.strictObject({ token: Token, session: z.string().max(4000).optional(), subjects: z.array(SubjectId).min(1).max(8), per: z.number().int().min(2).max(20).default(10) }),
    handler: async ({ sb, body }) => {
      if (!serverReady()) throw new ApiError(503, 'not_configured', 'The tests are not available now')
      const plan = await planOf(body.session)
      const ctx: PlanCtx = { sb: sb(), who: whoOf(body.session, codeHash(body.token)), plan, ...(await planSettings(sb())) }
      if (onTrial(ctx)) { if (!(await useTrial(ctx, 'action'))) throw limitReached('action', plan) }
      else if (!(await use(ctx, 'mmt'))) throw limitReached('mmt', plan)
      const questions = await call<unknown[]>(sb(), 'api_mmt_draw', { p_proof: secret(), p_subjects: body.subjects, p_per: body.per })
      return { questions }
    }
  }),

  // ── the staff ──
  route({
    method: 'GET', path: '/admin/mmt', access: 'staff', tag: 'Admin · ММТ', summary: 'Subjects, questions by difficulty, programmes, the exam day',
    handler: async ({ sb }) => call(sb(), 'admin_mmt_overview')
  }),
  route({
    method: 'POST', path: '/admin/mmt/subject', access: 'staff', tag: 'Admin · ММТ', summary: 'A subject added or changed',
    body: z.strictObject({ id: SubjectId, name: z.string().trim().min(1).max(80), clusters: z.array(z.number().int().min(1).max(5)).max(5), max_points: z.number().int().min(1).max(1000), position: z.number().int().min(0).max(100).default(0) }),
    handler: async ({ sb, body }) => {
      await call(sb(), 'admin_mmt_subject_save', { p_id: body.id, p_name: body.name, p_clusters: [...new Set(body.clusters)].sort(), p_max_points: body.max_points, p_position: body.position })
      return { ok: true }
    }
  }),
  route({
    method: 'POST', path: '/admin/mmt/subject/remove', access: 'staff', tag: 'Admin · ММТ', summary: 'A subject taken away with its questions',
    body: z.strictObject({ id: SubjectId }),
    handler: async ({ sb, body }) => { await call(sb(), 'admin_mmt_subject_remove', { p_id: body.id }); return { ok: true } }
  }),
  route({
    method: 'POST', path: '/admin/mmt/questions/import', access: 'staff', tag: 'Admin · ММТ', summary: 'Questions added to a subject (the same question is not added twice)',
    body: z.strictObject({ subject: SubjectId, rows: z.array(QuestionIn).min(1).max(2000) }),
    handler: async ({ sb, body }) => ({ added: await call<number>(sb(), 'admin_mmt_questions_import', { p_subject: body.subject, p_list: body.rows }) })
  }),
  route({
    method: 'GET', path: '/admin/mmt/questions', access: 'staff', tag: 'Admin · ММТ', summary: 'A subject\'s questions, newest first',
    query: z.object({ subject: SubjectId, offset: z.coerce.number().int().min(0).default(0) }),
    handler: async ({ sb, query }) => ({ questions: await call(sb(), 'admin_mmt_questions', { p_subject: query.subject, p_limit: 50, p_offset: query.offset }) })
  }),
  route({
    method: 'POST', path: '/admin/mmt/questions/remove', access: 'staff', tag: 'Admin · ММТ', summary: 'A question taken away',
    body: z.strictObject({ id: z.uuid() }),
    handler: async ({ sb, body }) => { await call(sb(), 'admin_mmt_question_remove', { p_id: body.id }); return { ok: true } }
  }),
  route({
    method: 'POST', path: '/admin/mmt/extract', access: 'staff', tag: 'Admin · ММТ',
    summary: 'Questions copied out of a test book\'s text by the AI (returned for the staff to check, not saved)',
    body: z.strictObject({ text: z.string().trim().min(20).max(60_000) }),
    handler: async ({ body }) => {
      const found = await extractQuestions(body.text)
      if (found === null) throw new ApiError(503, 'unavailable', 'The AI did not answer')
      return { questions: found }
    }
  }),
  route({
    method: 'POST', path: '/admin/mmt/programs/import', access: 'staff', tag: 'Admin · ММТ', summary: 'Programmes with passing scores (a year given anew replaces that year)',
    body: z.strictObject({ rows: z.array(ProgramIn).min(1).max(5000) }),
    handler: async ({ sb, body }) => ({ added: await call<number>(sb(), 'admin_mmt_programs_import', { p_list: body.rows }) })
  }),
  route({
    method: 'GET', path: '/admin/mmt/programs', access: 'staff', tag: 'Admin · ММТ', summary: 'Programmes (searched by university or specialty)',
    query: z.object({ q: z.string().trim().max(100).optional() }),
    handler: async ({ sb, query }) => ({ programs: await call(sb(), 'admin_mmt_programs', { p_query: query.q || null }) })
  }),
  route({
    method: 'POST', path: '/admin/mmt/programs/remove', access: 'staff', tag: 'Admin · ММТ', summary: 'A programme taken away',
    body: z.strictObject({ id: z.uuid() }),
    handler: async ({ sb, body }) => { await call(sb(), 'admin_mmt_program_remove', { p_id: body.id }); return { ok: true } }
  }),
  route({
    method: 'POST', path: '/admin/books/shelf', access: 'staff', tag: 'Admin · Mahliyo AI', summary: 'A book moved to a shelf (general, ММТ, laws, grants)',
    body: z.strictObject({ book: z.uuid(), shelf: z.enum(['general', 'mmt', 'law', 'grants']) }),
    handler: async ({ sb, body }) => { await call(sb(), 'admin_book_shelf', { p_book: body.book, p_shelf: body.shelf }); return { ok: true } }
  })
]
