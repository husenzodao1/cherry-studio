import { z } from 'zod'

import { Locale } from '@/lib/blocks'
import { ApiError } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'
import { Answers, AnswerValue, LocaleQuery, Uuid } from '@/lib/schemas'
import { unwrap } from '@/lib/supabase'

import { call, withMediaUrls } from '../util'
import { uiOf } from './offline'

const idParam = (value: string, name = 'id') => {
  const parsed = Uuid.safeParse(value)
  if (!parsed.success) throw new ApiError(404, 'not_found', 'Ёфт нашуд.', { [name]: value })
  return parsed.data
}

export const readerRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/health', access: 'public', tag: 'System', summary: 'Service and database health',
    handler: async ({ sb }) => {
      const db = await call<{ status: string; time: string; schema: string }>(sb(), 'api_health')
      return { status: 'ok', api: 'v1', database: db }
    }
  }),
  route({
    method: 'GET', path: '/ui', access: 'public', tag: 'Catalog', summary: 'CMS-managed UI strings and help texts (the “!” popovers)',
    query: LocaleQuery, cache: 60,
    handler: async ({ sb, query }) => uiOf(sb(), query.locale)
  }),
  route({
    method: 'GET', path: '/schools', access: 'public', tag: 'Catalog', summary: 'The seven schools in CMS order',
    query: LocaleQuery.extend({ audience: z.enum(['girls', 'boys']).default('girls') }), cache: 60,
    handler: async ({ sb, query }) => withMediaUrls(await call(sb(), 'api_schools', { p_locale: query.locale, p_audience: query.audience }))
  }),
  route({
    method: 'GET', path: '/schools/:key', access: 'public', tag: 'Catalog', summary: 'School by id or slug, with its courses and progress',
    query: LocaleQuery, cache: 60,
    handler: async ({ sb, query, params }) =>
      withMediaUrls(await call(sb(), 'api_school', { p_key: params.key, p_locale: query.locale }))
  }),
  route({
    method: 'GET', path: '/courses/:id', access: 'public', tag: 'Catalog', summary: 'Course with modules → topics → lessons outline',
    query: LocaleQuery, cache: 60,
    handler: async ({ sb, query, params }) =>
      withMediaUrls(await call(sb(), 'api_course', { p_course: idParam(params.id), p_locale: query.locale }))
  }),
  route({
    method: 'GET', path: '/lessons/:id', access: 'public', tag: 'Catalog', summary: 'Published lesson as ordered content blocks',
    query: LocaleQuery, cache: 60,
    handler: async ({ sb, query, params }) =>
      withMediaUrls(await call(sb(), 'api_lesson', { p_lesson: idParam(params.id), p_locale: query.locale }))
  }),
  route({
    method: 'GET', path: '/search', access: 'public', tag: 'Catalog', summary: 'Search schools, courses, modules, topics and lessons',
    query: z.object({ q: z.string().max(100).default(''), locale: Locale.default('tg'), limit: z.coerce.number().int().min(1).max(50).default(20), audience: z.enum(['girls', 'boys']).default('girls') }),
    cache: 30,
    handler: async ({ sb, query }) => call(sb(), 'api_search', { p_q: query.q, p_locale: query.locale, p_limit: query.limit, p_audience: query.audience })
  }),
  route({
    method: 'GET', path: '/inspiration', access: 'public', tag: 'Catalog', summary: 'Current Daily Inspiration (null when none is published)',
    query: z.object({ locale: Locale.default('tg'), placement: z.enum(['home', 'lesson', 'notification', 'poem', 'story']).default('home') }),
    cache: 60,
    handler: async ({ sb, query }) =>
      withMediaUrls(await call(sb(), 'api_inspiration', { p_locale: query.locale, p_placement: query.placement }))
  }),
  route({
    method: 'GET', path: '/banners', access: 'public', tag: 'Catalog', summary: 'Live banners for a placement',
    query: z.object({ locale: Locale.default('tg'), placement: z.enum(['home_top', 'home_card', 'school']) }),
    cache: 60,
    handler: async ({ sb, query }) =>
      withMediaUrls(await call(sb(), 'api_banners', { p_placement: query.placement, p_locale: query.locale }))
  }),
  route({
    method: 'GET', path: '/pages/:slug', access: 'public', tag: 'Catalog', summary: 'CMS page (privacy, terms, about)',
    query: LocaleQuery, cache: 300,
    handler: async ({ sb, query, params }) =>
      withMediaUrls(await call(sb(), 'api_page', { p_slug: params.slug, p_locale: query.locale }))
  }),
  route({
    method: 'POST', path: '/media/signed-url', access: 'user', tag: 'Catalog',
    summary: 'Short-lived URL for a premium (protected) file; storage policies check the entitlement',
    body: z.strictObject({ path: z.string().min(1).max(500).regex(/^[A-Za-z0-9/_.-]+$/) }),
    handler: async ({ sb, body }) => {
      const { data, error } = await sb().storage.from('media-protected').createSignedUrl(body.path, 3600)
      if (error || !data) throw new ApiError(403, 'forbidden', 'Иҷозат нест.')
      return { url: data.signedUrl, expires_in: 3600 }
    }
  }),

  // ------------------------------------------------------------------ quizzes (reader)
  route({
    method: 'POST', path: '/quizzes/:id/attempts', access: 'user', tag: 'Quiz',
    summary: 'Start (or resume) an attempt. The answer key is never included.',
    body: z.strictObject({ locale: Locale.default('tg') }), status: 201,
    handler: async ({ sb, body, params }) =>
      withMediaUrls(await call(sb(), 'api_start_quiz_attempt', { p_quiz: idParam(params.id), p_locale: body.locale }))
  }),
  route({
    method: 'GET', path: '/quizzes/:id/attempts', access: 'user', tag: 'Quiz', summary: 'My attempts for a quiz',
    handler: async ({ sb, params }) => call(sb(), 'api_my_quiz_attempts', { p_quiz: idParam(params.id) })
  }),
  route({
    method: 'GET', path: '/attempts/:id', access: 'user', tag: 'Quiz', summary: 'Attempt result (with feedback per quiz policy)',
    handler: async ({ sb, params }) => call(sb(), 'api_get_quiz_attempt', { p_attempt: idParam(params.id) })
  }),
  route({
    method: 'POST', path: '/attempts/:id/check', access: 'user', tag: 'Quiz',
    summary: 'Check one answer immediately (only when the quiz shows feedback after each question)',
    body: z.strictObject({ question_id: Uuid, answer: AnswerValue }),
    handler: async ({ sb, body, params }) =>
      call(sb(), 'api_check_quiz_answer', { p_attempt: idParam(params.id), p_question: body.question_id, p_answer: body.answer })
  }),
  route({
    method: 'POST', path: '/attempts/:id/submit', access: 'user', tag: 'Quiz', summary: 'Submit answers; the backend grades them',
    body: z.strictObject({ answers: Answers.default({}) }),
    handler: async ({ sb, body, params }) =>
      call(sb(), 'api_submit_quiz_attempt', { p_attempt: idParam(params.id), p_answers: body.answers })
  }),

  // ------------------------------------------------------------------ me
  route({
    method: 'GET', path: '/me', access: 'user', tag: 'Me', summary: 'My profile, roles and access',
    handler: async ({ sb, userId }) => {
      const client = sb()
      const profile = await unwrap(client.from('profiles').select('*').eq('id', userId!).maybeSingle())
      const roles = await unwrap(client.from('user_roles').select('role').eq('user_id', userId!))
      const entitlements = await unwrap(
        client.from('entitlements').select('tier, starts_at, ends_at').eq('user_id', userId!)
      )
      const now = Date.now()
      const premium =
        (roles as { role: string }[]).length > 0 ||
        (entitlements as { starts_at: string; ends_at: string | null }[]).some(
          (e) => Date.parse(e.starts_at) <= now && (!e.ends_at || Date.parse(e.ends_at) > now)
        )
      return { id: userId, profile, roles: (roles as { role: string }[]).map((r) => r.role), premium }
    }
  }),
  route({
    method: 'PATCH', path: '/me', access: 'user', tag: 'Me', summary: 'Update profile and preferences',
    body: z.strictObject({
      display_name: z.string().max(80).nullable().optional(),
      locale: Locale.optional(),
      theme: z.enum(['light', 'dark', 'system']).optional(),
      reduce_motion: z.boolean().optional(),
      text_scale: z.number().min(0.8).max(1.6).optional(),
      notifications_enabled: z.boolean().optional()
    }),
    handler: async ({ sb, body, userId }) =>
      unwrap(sb().from('profiles').update(body).eq('id', userId!).select('*').single())
  }),
  route({
    method: 'GET', path: '/me/progress', access: 'user', tag: 'Me', summary: 'Learning statistics, school progress and achievements',
    query: LocaleQuery,
    handler: async ({ sb, query }) => withMediaUrls(await call(sb(), 'api_my_progress', { p_locale: query.locale }))
  }),
  route({
    method: 'GET', path: '/me/continue', access: 'user', tag: 'Me', summary: 'Lesson to continue (null when none)',
    query: LocaleQuery,
    handler: async ({ sb, query }) => call(sb(), 'api_continue_learning', { p_locale: query.locale })
  }),
  route({
    method: 'PUT', path: '/me/lessons/:id/progress', access: 'user', tag: 'Me', summary: 'Save reading progress / completion',
    body: z.strictObject({
      percent: z.number().int().min(0).max(100).optional(),
      position: z.record(z.string(), z.union([z.string().max(200), z.number()])).optional(),
      completed: z.boolean().default(false)
    }),
    handler: async ({ sb, body, params }) =>
      call(sb(), 'api_track_progress', {
        p_lesson: idParam(params.id), p_percent: body.percent ?? null, p_position: body.position ?? null, p_completed: body.completed
      })
  }),
  route({
    method: 'GET', path: '/me/bookmarks', access: 'user', tag: 'Me', summary: 'Saved lessons, optionally filtered by school',
    query: z.object({ locale: Locale.default('tg'), school: Uuid.optional() }),
    handler: async ({ sb, query }) => call(sb(), 'api_my_bookmarks', { p_locale: query.locale, p_school: query.school ?? null })
  }),
  route({
    method: 'PUT', path: '/me/bookmarks/:lessonId', access: 'user', tag: 'Me', summary: 'Save a lesson', status: 204,
    handler: async ({ sb, params, userId }) => {
      await unwrap(
        sb().from('bookmarks').upsert({ user_id: userId, lesson_id: idParam(params.lessonId, 'lessonId') }, { ignoreDuplicates: true })
      )
      return undefined
    }
  }),
  route({
    method: 'DELETE', path: '/me/bookmarks/:lessonId', access: 'user', tag: 'Me', summary: 'Remove a saved lesson', status: 204,
    handler: async ({ sb, params, userId }) => {
      await unwrap(sb().from('bookmarks').delete().eq('user_id', userId!).eq('lesson_id', idParam(params.lessonId, 'lessonId')))
      return undefined
    }
  }),
  route({
    method: 'GET', path: '/me/notifications', access: 'user', tag: 'Me', summary: 'In-app notifications',
    query: LocaleQuery,
    handler: async ({ sb, query }) => call(sb(), 'api_my_notifications', { p_locale: query.locale })
  }),
  route({
    method: 'POST', path: '/me/notifications/:id/read', access: 'user', tag: 'Me', summary: 'Mark a notification read', status: 204,
    handler: async ({ sb, params, userId }) => {
      await unwrap(
        sb().from('notification_reads').upsert({ user_id: userId, notification_id: idParam(params.id) }, { ignoreDuplicates: true })
      )
      return undefined
    }
  }),
  route({
    method: 'POST', path: '/me/devices', access: 'user', tag: 'Me', summary: 'Register a push token (Android/Web)',
    body: z.strictObject({ platform: z.enum(['android', 'web', 'ios']), token: z.string().min(10).max(4096) }), status: 201,
    handler: async ({ sb, body, userId }) =>
      unwrap(
        sb().from('push_devices').upsert({ user_id: userId, ...body, last_seen_at: new Date().toISOString() }, { onConflict: 'token' })
          .select('id, platform, created_at').single()
      )
  }),
  route({
    method: 'DELETE', path: '/me/devices/:id', access: 'user', tag: 'Me', summary: 'Remove a push token', status: 204,
    handler: async ({ sb, params }) => {
      await unwrap(sb().from('push_devices').delete().eq('id', idParam(params.id)))
      return undefined
    }
  }),
  route({
    method: 'GET', path: '/me/export', access: 'user', tag: 'Me', summary: 'Export of my personal data',
    handler: async ({ sb, userId }) => {
      const c = sb()
      const [profile, progress, bookmarks, attempts, achievements] = await Promise.all([
        unwrap(c.from('profiles').select('*').eq('id', userId!).maybeSingle()),
        unwrap(c.from('lesson_progress').select('*').eq('user_id', userId!)),
        unwrap(c.from('bookmarks').select('*').eq('user_id', userId!)),
        unwrap(c.from('quiz_attempts').select('id, quiz_id, status, score, max_score, percent, passed, started_at, submitted_at, answers').eq('user_id', userId!)),
        unwrap(c.from('user_achievements').select('*').eq('user_id', userId!))
      ])
      return { exported_at: new Date().toISOString(), profile, progress, bookmarks, attempts, achievements }
    }
  })
]
