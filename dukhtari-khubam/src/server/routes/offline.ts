import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { emptyProgress, isCode, mergeProgress, ProgressData } from '@/lib/progress'
import { route, type AnyRoute } from '@/lib/router'
import { LocaleQuery } from '@/lib/schemas'

import { call, withMediaUrls } from '../util'

/**
 * Offline app endpoints.
 * - GET /bundle: the whole published catalogue in one document. The app stores it on the phone and
 *   refreshes it whenever it is online (ETag), so it works without a connection.
 * - POST /profile/sync and /profile/restore: progress backup under sha256(15-digit code).
 * - Login and password (when the code is lost): /profile/username, /profile/login-set, /profile/login.
 *   The phone sends the code encrypted with a key derived from the password; the server keeps that
 *   and a bcrypt hash of the password, never the code itself.
 * - Support chat without an account: a thread belongs to sha256 of a random token kept on the phone.
 */

type Json = Record<string, any>

/** Runs `fn` over `items` with limited concurrency. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  }))
  return out
}

const optional = async <T>(p: Promise<T>): Promise<T | null> => p.catch(() => null)

export async function buildBundle(sb: SupabaseClient, locale: string) {
  const L = { p_locale: locale }
  const [schools, ui, inspiration, inspirations, achievements] = await Promise.all([
    call<Json[]>(sb, 'api_schools', L),
    call<Json>(sb, 'api_ui_bundle', L),
    optional(call<Json | null>(sb, 'api_inspiration', L)),
    optional(call<Json[]>(sb, 'api_inspirations', L)),
    optional(call<Json[]>(sb, 'api_achievements', L))
  ])
  const schoolDetails = (await pool(schools, 6, (s) => optional(call<Json>(sb, 'api_school', { p_key: s.slug, ...L })))).filter(Boolean) as Json[]
  const courseIds = schoolDetails.flatMap((s) => (s.courses ?? []).map((c: Json) => c.id as string))
  const courses = (await pool(courseIds, 6, (id) => optional(call<Json>(sb, 'api_course', { p_course: id, ...L })))).filter(Boolean) as Json[]
  const lessonIds = courses.flatMap((c) => (c.modules ?? []).flatMap((m: Json) => (m.topics ?? []).flatMap((t: Json) =>
    (t.lessons ?? []).filter((l: Json) => !l.locked).map((l: Json) => l.id as string))))
  const lessons = (await pool(lessonIds, 8, (id) => optional(call<Json>(sb, 'api_lesson', { p_lesson: id, ...L })))).filter(Boolean) as Json[]

  const quizIds = new Set<string>()
  const addQuizzes = (list?: Json[]) => list?.forEach((q) => q?.id && quizIds.add(q.id))
  schoolDetails.forEach((s) => addQuizzes(s.quizzes))
  courses.forEach((c) => {
    addQuizzes(c.quizzes)
    c.modules?.forEach((m: Json) => { addQuizzes(m.quizzes); m.topics?.forEach((t: Json) => addQuizzes(t.quizzes)) })
  })
  lessons.forEach((l) => l.blocks?.forEach((b: Json) => b.type === 'quiz' && b.ref?.id && quizIds.add(b.ref.id)))
  const quizzes = (await pool([...quizIds], 6, (id) => optional(call<Json | null>(sb, 'api_offline_quiz', { p_quiz: id, ...L })))).filter(Boolean) as Json[]
  const pages = (await pool(['about', 'privacy', 'terms'], 3, async (slug) => {
    const page = await optional(call<Json>(sb, 'api_page', { p_slug: slug, ...L }))
    return page ? { ...page, slug } : null
  })).filter(Boolean) as Json[]

  const content = withMediaUrls({
    schools,
    schoolDetails: Object.fromEntries(schoolDetails.map((s) => [s.slug, s])),
    courses: Object.fromEntries(courses.map((c) => [c.id, c])),
    lessons: Object.fromEntries(lessons.map((l) => [l.id, l])),
    quizzes: Object.fromEntries(quizzes.map((q) => [q.quiz.id, q])),
    pages: Object.fromEntries(pages.map((p) => [p.slug, p])),
    ui,
    inspiration,
    inspirations: inspirations ?? [],
    achievements: achievements ?? []
  })
  const version = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16)
  return { v: 1, locale, version, generated_at: new Date().toISOString(), ...content }
}

const codeHash = (code: string) => createHash('sha256').update(code).digest('hex')
const Code = z.string().refine(isCode, 'invalid_code')
const Username = z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,32}$/, 'invalid_username')
const Password = z.string().min(6).max(72)
const Token = z.string().regex(/^[0-9a-f]{64}$/, 'invalid_token')

interface Stored { name: string; data: unknown; updated_at: string }

export const offlineRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/bundle', access: 'public', tag: 'Offline app',
    summary: 'Whole published catalogue for offline use (lessons, quizzes with answer keys, texts); send If-None-Match',
    query: LocaleQuery, cache: 300,
    handler: async ({ sb, query, req }) => {
      const bundle = await buildBundle(sb(), query.locale)
      const etag = `"${bundle.version}"`
      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: { etag, 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1500' } })
      }
      return new Response(JSON.stringify(bundle), {
        headers: { 'content-type': 'application/json; charset=utf-8', etag, 'cache-control': 'public, s-maxage=300, stale-while-revalidate=1500' }
      })
    }
  }),
  route({
    method: 'POST', path: '/profile/sync', access: 'public', tag: 'Offline app',
    summary: 'Back up progress under the learner code; returns the merged progress (phone and backup combined)',
    body: z.strictObject({ code: Code, name: z.string().trim().min(1).max(80), data: ProgressData }),
    handler: async ({ sb, body }) => {
      const client = sb()
      const hash = codeHash(body.code)
      const stored = await call<Stored | null>(client, 'api_profile_load', { p_code_hash: hash })
      const previous = stored ? ProgressData.safeParse(stored.data) : null
      const merged = previous?.success ? mergeProgress(previous.data, body.data) : body.data
      const updatedAt = await call<string>(client, 'api_profile_save', { p_code_hash: hash, p_name: body.name, p_data: merged })
      return { name: body.name, data: merged, updated_at: updatedAt }
    }
  }),
  route({
    method: 'POST', path: '/profile/restore', access: 'public', tag: 'Offline app',
    summary: 'Restore name and progress with the learner code (after reinstalling or on a new phone)',
    body: z.strictObject({ code: Code }),
    handler: async ({ sb, body }) => {
      const stored = await call<Stored | null>(sb(), 'api_profile_load', { p_code_hash: codeHash(body.code) })
      if (!stored) throw new ApiError(404, 'not_found', 'Ин код ёфт нашуд.')
      const data = ProgressData.safeParse(stored.data)
      return { name: stored.name, data: data.success ? data.data : emptyProgress(), updated_at: stored.updated_at }
    }
  }),
  route({
    method: 'GET', path: '/profile/username', access: 'public', tag: 'Offline app',
    summary: 'Whether a login is free to take',
    query: z.strictObject({ username: z.string().max(64) }),
    handler: async ({ sb, query }) => ({ free: await call<boolean>(sb(), 'api_profile_username_free', { p_username: query.username }) })
  }),
  route({
    method: 'POST', path: '/profile/login-set', access: 'public', tag: 'Offline app',
    summary: 'Set or change the login and password of the profile whose code is given',
    body: z.strictObject({ code: Code, username: Username, password: Password, code_enc: z.string().min(1).max(500) }),
    handler: async ({ sb, body }) => call(sb(), 'api_profile_set_login', {
      p_code_hash: codeHash(body.code), p_username: body.username, p_password: body.password, p_code_enc: body.code_enc
    })
  }),
  route({
    method: 'POST', path: '/profile/login', access: 'public', tag: 'Offline app',
    summary: 'Sign in with login and password: name, progress and the encrypted code (or a new code issued by staff)',
    body: z.strictObject({ username: z.string().max(64), password: z.string().max(200) }),
    handler: async ({ sb, body }) => {
      const r = await call<Json>(sb(), 'api_profile_login', { p_username: body.username, p_password: body.password })
      if (r.error === 'locked') throw new ApiError(429, 'locked', 'Логин барои 15 дақиқа баста шуд.')
      if (r.error) throw new ApiError(401, 'invalid_login', 'Логин ё парол нодуруст аст.')
      const data = ProgressData.safeParse(r.data)
      return { ...r, data: data.success ? data.data : emptyProgress() }
    }
  }),
  route({
    method: 'POST', path: '/support/send', access: 'public', tag: 'Support',
    summary: 'Write to support from this phone (no account needed); returns the thread',
    body: z.strictObject({ token: Token, name: z.string().max(80).optional(), username: z.string().max(40).optional(), body: z.string().trim().min(1).max(2000) }),
    handler: async ({ sb, body }) => call(sb(), 'api_support_send', {
      p_token_hash: codeHash(body.token), p_name: body.name ?? null, p_username: body.username ?? null, p_body: body.body
    })
  }),
  route({
    method: 'POST', path: '/support/thread', access: 'public', tag: 'Support',
    summary: "This phone's support thread (marks staff replies as read)",
    body: z.strictObject({ token: Token }),
    handler: async ({ sb, body }) => ({ thread: await call(sb(), 'api_support_thread', { p_token_hash: codeHash(body.token) }) })
  }),
  route({
    method: 'POST', path: '/support/unread', access: 'public', tag: 'Support',
    summary: 'Number of unread staff replies for this phone',
    body: z.strictObject({ token: Token }),
    handler: async ({ sb, body }) => ({ unread: await call<number>(sb(), 'api_support_unread', { p_token_hash: codeHash(body.token) }) })
  })
]
