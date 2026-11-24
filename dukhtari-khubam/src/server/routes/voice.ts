import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'
import { bearerToken } from '@/lib/supabase'

import { CHUNK_SECONDS, liveConfig, liveReady, liveToken } from '../live'
import { limitReached, planOf, planSettings, useLiveChunk, whoOf, type PlanCtx } from '../plans'
import { hear } from '../speech'
import { call } from '../util'

/** "Эй Маҳлиё" (Standard and Premium): what she said, heard by the server's AI (see ../speech.ts). */
export const voiceRoutes: AnyRoute[] = [
  route({
    method: 'POST', path: '/voice/hear', access: 'user', tag: 'Voice', summary: 'Her words from a short recording, in any of the app\'s languages',
    // about 20 seconds of 16 kHz mono WAV, as base64
    body: z.object({ wav: z.string().min(100).max(900_000).regex(/^[A-Za-z0-9+/=]+$/), lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg') }),
    handler: async ({ sb, body }) => {
      const { live } = await planSettings(sb())
      if (live) {
        const mine = await call<{ plan?: string }>(sb(), 'api_my_plan').catch(() => ({ plan: 'free' }))
        if (mine.plan === 'free' || !mine.plan) throw new ApiError(402, 'plan_limit', 'Standard or Premium', { kind: 'hey' })
      }
      const text = await hear(body.wav, body.lang)
      if (text === null) throw new ApiError(503, 'unavailable', 'Speech could not be heard now')
      return { text }
    }
  }),
  route({
    method: 'POST', path: '/voice/live', access: 'user', tag: 'Voice',
    summary: 'A one-use token for a two-minute part of a live voice conversation with Mahliyo (Gemini Live), counted against her minutes',
    body: z.strictObject({
      lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg'),
      mode: z.enum(['assistant', 'camera', 'coach']).default('assistant'),
      scenario: z.enum(['ielts', 'english', 'russian', 'interview']).optional(),
      name: z.string().trim().max(80).optional(),
      me: z.string().max(4000).optional(),
      now: z.string().max(40).optional(),
      boy: z.boolean().optional(),
      // going on with the same conversation (the handle Gemini gave the last part)
      handle: z.string().max(4000).optional()
    }),
    handler: async ({ sb, body, req }) => {
      if (!liveReady()) throw new ApiError(503, 'not_configured', 'Live voice is not connected')
      const session = bearerToken(req) ?? undefined
      const plan = await planOf(session)
      const settings = await planSettings(sb())
      const ctx: PlanCtx = { sb: sb(), who: whoOf(session, ''), plan, ...settings }
      const part = await useLiveChunk(ctx, CHUNK_SECONDS / 60)
      if (!part.ok) throw limitReached('live', plan)
      try {
        return { ...(await liveToken(liveConfig({ ...body }))), seconds: CHUNK_SECONDS, minutesLeft: part.left }
      } catch {
        throw new ApiError(503, 'unavailable', 'Live voice is not available now')
      }
    }
  })
]
