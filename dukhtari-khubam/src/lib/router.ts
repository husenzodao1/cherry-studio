import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { env } from './env'
import { ApiError, errorResponse, json } from './http'
import { bearerToken, supabaseFor, tokenSubject } from './supabase'

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
/** public: anyone · user: signed-in user · staff: signed-in, roles enforced by the database */
export type Access = 'public' | 'user' | 'staff'

export interface Ctx<Q, B> {
  req: Request
  params: Record<string, string>
  query: Q
  body: B
  token: string | null
  userId: string | null
  sb: () => SupabaseClient
}

export interface RouteDef<Q extends z.ZodType = z.ZodType, B extends z.ZodType = z.ZodType> {
  method: Method
  path: string
  access: Access
  tag: string
  summary: string
  query?: Q
  body?: B
  status?: number
  /** seconds of shared caching for anonymous GET responses */
  cache?: number
  handler: (ctx: Ctx<z.output<Q>, z.output<B>>) => Promise<unknown>
}

export type AnyRoute = RouteDef<any, any>

export function route<Q extends z.ZodType = z.ZodObject<{}>, B extends z.ZodType = z.ZodUnknown>(def: RouteDef<Q, B>): AnyRoute {
  return def as AnyRoute
}

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean)
  const b = path.split('/').filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      try {
        params[a[i].slice(1)] = decodeURIComponent(b[i])
      } catch {
        return null
      }
    } else if (a[i] !== b[i]) return null
  }
  return params
}

export function findRoute(routes: AnyRoute[], method: string, path: string) {
  let pathMatched = false
  for (const r of routes) {
    const params = match(r.path, path)
    if (!params) continue
    pathMatched = true
    if (r.method === method) return { route: r, params }
  }
  return pathMatched ? 'method_not_allowed' : null
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !env.corsOrigins.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type',
    'access-control-max-age': '600',
    vary: 'origin'
  }
}

function zodIssues(error: z.ZodError) {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
}

const MAX_BODY = 2 * 1024 * 1024

export async function dispatch(routes: AnyRoute[], req: Request, path: string): Promise<Response> {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const response = await handle(routes, req, path)
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v)
  response.headers.set('x-content-type-options', 'nosniff')
  return response
}

async function handle(routes: AnyRoute[], req: Request, path: string): Promise<Response> {
  try {
    const found = findRoute(routes, req.method, path)
    if (found === null) throw new ApiError(404, 'not_found', 'Ёфт нашуд.')
    if (found === 'method_not_allowed') throw new ApiError(405, 'method_not_allowed', 'Метод иҷозат нест.')
    const { route: r, params } = found

    const token = bearerToken(req)
    if (r.access !== 'public' && !token) throw new ApiError(401, 'auth_required', 'Ворид шавед.')

    const url = new URL(req.url)
    const rawQuery = Object.fromEntries(url.searchParams.entries())
    const query = r.query ? r.query.safeParse(rawQuery) : { success: true as const, data: rawQuery }
    if (!query.success) throw new ApiError(422, 'validation_failed', 'Маълумот нодуруст аст.', zodIssues(query.error))

    let body: unknown = undefined
    if (r.body) {
      const text = await req.text()
      if (text.length > MAX_BODY) throw new ApiError(413, 'payload_too_large', 'Ҳаҷм аз ҳад зиёд аст.')
      let raw: unknown = {}
      if (text) {
        try {
          raw = JSON.parse(text)
        } catch {
          throw new ApiError(400, 'bad_json', 'JSON нодуруст аст.')
        }
      }
      const parsed = r.body.safeParse(raw)
      if (!parsed.success) throw new ApiError(422, 'validation_failed', 'Маълумот нодуруст аст.', zodIssues(parsed.error))
      body = parsed.data
    }

    let client: SupabaseClient | null = null
    const ctx: Ctx<unknown, unknown> = {
      req,
      params,
      query: query.data,
      body,
      token,
      userId: tokenSubject(token),
      sb: () => (client ??= supabaseFor(token))
    }
    const result = await r.handler(ctx)
    if (result instanceof Response) return result
    const cache =
      req.method === 'GET' && !token && r.cache ? `public, s-maxage=${r.cache}, stale-while-revalidate=${r.cache * 5}` : 'private, no-store'
    if (result === undefined && (r.status ?? 200) === 204) return new Response(null, { status: 204 })
    return json(result, { status: r.status ?? 200, cache })
  } catch (error) {
    return errorResponse(error)
  }
}
