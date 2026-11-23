import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'

import { findPlaces, findRoute } from '../navigate'
import { planSettings } from '../plans'
import { call } from '../util'

/** "Маро бубар" (Premium): places found and the way there (see ../navigate.ts). */

const Point = z.string().regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/).transform((s) => s.split(',').map(Number) as [number, number])

/** Premium (staff too), or anyone signed in while the plans are off */
async function mayNavigate(sb: Parameters<typeof call>[0]) {
  const { live } = await planSettings(sb)
  if (!live) return
  const mine = await call<{ plan?: string }>(sb, 'api_my_plan').catch(() => ({ plan: 'free' }))
  if (mine.plan !== 'premium') throw new ApiError(402, 'plan_limit', 'Premium only', { kind: 'navigate' })
}

export const navigateRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/nav/places', access: 'user', tag: 'Navigation', summary: 'Places named like her words, near her first',
    query: z.object({ q: z.string().trim().min(2).max(160), near: Point.optional(), lang: z.string().regex(/^[a-z]{2,3}$/).default('tg') }),
    handler: async ({ sb, query }) => {
      await mayNavigate(sb())
      try {
        return { places: await findPlaces(query.q, query.near ?? null, query.lang === 'prs' ? 'fa' : query.lang) }
      } catch {
        throw new ApiError(503, 'unavailable', 'The map service did not answer')
      }
    }
  }),
  route({
    method: 'GET', path: '/nav/route', access: 'user', tag: 'Navigation', summary: 'The way from here to there, on foot or by car, with every turn',
    query: z.object({ from: Point, to: Point, mode: z.enum(['foot', 'car']).default('foot') }),
    handler: async ({ sb, query }) => {
      await mayNavigate(sb())
      let found
      try {
        found = await findRoute(query.from, query.to, query.mode)
      } catch {
        throw new ApiError(503, 'unavailable', 'The route service did not answer')
      }
      if (!found) throw new ApiError(404, 'no_route', 'No way found between these places')
      return found
    }
  })
]
