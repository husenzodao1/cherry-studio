import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { findSongs, youtubeReady } from '../youtube'

/** Songs found on YouTube for her words (see ../youtube.ts), to play in the app. */
export const musicFindRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/music/find', access: 'public', tag: 'Music', summary: 'Songs on YouTube for her words (kept a week for everyone)', cache: 3600,
    query: z.object({ q: z.string().trim().min(2).max(200), lang: z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']).default('tg') }),
    handler: async ({ sb, query }) => {
      if (!youtubeReady()) throw new ApiError(503, 'not_configured', 'YouTube is not connected')
      try {
        return { songs: await findSongs(sb(), query.q, query.lang) }
      } catch (e) {
        console.warn('[music] youtube failed:', String(e instanceof Error ? e.message : e).slice(0, 200))
        throw new ApiError(503, 'unavailable', 'YouTube did not answer')
      }
    }
  })
]
