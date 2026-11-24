import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { planSettings } from '../plans'
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
  })
]
