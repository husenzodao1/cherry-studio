import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { geminiKeys } from '../mahliyo'
import { checkNotebook, makeCards } from '../notebook'
import { partsOf, signedPart, voicePart, writeScript } from '../podcast'
import { serverReady } from '../aiModels'
import { limitReached, onTrial, planOf, planSettings, use, useTrial, whoOf, type PlanCtx } from '../plans'
import { codeHash, Token } from './offline'

/** The red pen (../notebook.ts): a photo of her notebook page checked, counted like exam practice. */
export const notebookRoutes: AnyRoute[] = [
  route({
    method: 'POST', path: '/study/check', access: 'public', tag: 'Study',
    summary: 'A photo of a notebook page checked with a red pen: the mistakes marked on the photo, corrections, a mark and what to practise',
    body: z.strictObject({
      token: Token, session: z.string().max(4000).optional(),
      // a JPEG or PNG made smaller on the phone (about 1600 px), as base64
      image: z.strictObject({ mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.string().min(100).max(8_000_000).regex(/^[A-Za-z0-9+/=]+$/) }),
      lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg'),
      subject: z.string().trim().max(80).optional(), task: z.string().trim().max(1000).optional()
    }),
    handler: async ({ sb, body }) => {
      if (!geminiKeys().length) throw new ApiError(503, 'not_configured', 'The checking is not connected')
      const plan = await planOf(body.session)
      const ctx: PlanCtx = { sb: sb(), who: whoOf(body.session, codeHash(body.token)), plan, ...(await planSettings(sb())) }
      if (onTrial(ctx)) { if (!(await useTrial(ctx, 'action'))) throw limitReached('action', plan) }
      else if (!(await use(ctx, 'exam'))) throw limitReached('exam', plan)
      const checked = await checkNotebook(body.image, { lang: body.lang, task: body.task, subject: body.subject })
      if (!checked) throw new ApiError(503, 'unavailable', 'The page could not be checked now')
      return checked
    }
  }),
  route({
    method: 'POST', path: '/study/cards', access: 'public', tag: 'Study',
    summary: 'Flashcards made by the AI from a text (a lesson, her notes) or a photo of a page, counted like tests',
    body: z.strictObject({
      token: Token, session: z.string().max(4000).optional(),
      text: z.string().trim().min(40).max(30_000).optional(),
      image: z.strictObject({ mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.string().min(100).max(8_000_000).regex(/^[A-Za-z0-9+/=]+$/) }).optional(),
      lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg'),
      count: z.number().int().min(3).max(40).default(15)
    }).refine((b) => b.text || b.image, 'text_or_image'),
    handler: async ({ sb, body }) => {
      if (!geminiKeys().length) throw new ApiError(503, 'not_configured', 'The cards are not connected')
      const plan = await planOf(body.session)
      const ctx: PlanCtx = { sb: sb(), who: whoOf(body.session, codeHash(body.token)), plan, ...(await planSettings(sb())) }
      if (onTrial(ctx)) { if (!(await useTrial(ctx, 'func'))) throw limitReached('func', plan) }
      else if (!(await use(ctx, 'quiz'))) throw limitReached('quiz', plan)
      const cards = await makeCards({ text: body.text, image: body.image, lang: body.lang, count: body.count })
      if (!cards) throw new ApiError(503, 'unavailable', 'The cards could not be made now')
      return { cards }
    }
  }),
  route({
    method: 'POST', path: '/study/podcast', access: 'public', tag: 'Study',
    summary: 'A podcast script from a lecture (Mahliyo explains, Sitora asks), in signed parts to be voiced; counted like a generated document',
    body: z.strictObject({
      token: Token, session: z.string().max(4000).optional(),
      text: z.string().trim().min(80).max(40_000).optional(),
      image: z.strictObject({ mime: z.enum(['image/jpeg', 'image/png', 'image/webp']), data: z.string().min(100).max(8_000_000).regex(/^[A-Za-z0-9+/=]+$/) }).optional(),
      lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg'),
      minutes: z.union([z.literal(3), z.literal(5), z.literal(8)]).default(5)
    }).refine((b) => b.text || b.image, 'text_or_image'),
    handler: async ({ sb, body }) => {
      if (!geminiKeys().length || !serverReady()) throw new ApiError(503, 'not_configured', 'The podcasts are not connected')
      const plan = await planOf(body.session)
      const ctx: PlanCtx = { sb: sb(), who: whoOf(body.session, codeHash(body.token)), plan, ...(await planSettings(sb())) }
      if (onTrial(ctx)) { if (!(await useTrial(ctx, 'gen'))) throw limitReached('gen', plan) }
      else if (!(await use(ctx, 'doc'))) throw limitReached('doc', plan)
      const script = await writeScript({ text: body.text, image: body.image, lang: body.lang, minutes: body.minutes })
      if (!script) throw new ApiError(503, 'unavailable', 'The podcast could not be written now')
      return { title: script.title, parts: partsOf(script.lines) }
    }
  }),
  route({
    method: 'POST', path: '/study/podcast/voice', access: 'public', tag: 'Study',
    summary: 'One signed part of a podcast voiced by two speakers (a WAV, base64)',
    body: z.strictObject({
      lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg'),
      part: z.strictObject({ lines: z.array(z.strictObject({ who: z.enum(['A', 'B']), text: z.string().min(1).max(600) })).min(1).max(40), exp: z.number().int(), sig: z.string().max(64) })
    }),
    handler: async ({ body }) => {
      if (!signedPart(body.part)) throw new ApiError(403, 'forbidden', 'Not a part of a podcast written here, or too old')
      const wav = await voicePart(body.part.lines, body.lang)
      if (!wav) throw new ApiError(503, 'unavailable', 'The voices are not available now')
      return { wav }
    }
  })
]
