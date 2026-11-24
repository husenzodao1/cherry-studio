import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { geminiKeys } from '../mahliyo'
import { checkNotebook } from '../notebook'
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
  })
]
