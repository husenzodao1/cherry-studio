import { z } from 'zod'

import { Locale, validateBlocks } from '@/lib/blocks'
import { ApiError, fromDatabase } from '@/lib/http'
import { route, type AnyRoute } from '@/lib/router'
import {
  Answers, AssetCreate, AssetTranslation, AssetUpdate, EntityFields, type EntityName, LocaleQuery, Paging,
  QuestionInput, ReorderBody, Role, Status, TransitionBody, TranslationSchemas, Uuid
} from '@/lib/schemas'
import { unwrap } from '@/lib/supabase'

import { call, withMediaUrls } from '../util'

interface EntityConfig {
  table: string
  tr: string
  fk: string
  /** singular name used by the workflow functions; absent = no publication workflow */
  workflow?: string
  parents?: string[]
  order: string
}

const ENTITIES: Record<EntityName, EntityConfig> = {
  schools: { table: 'schools', tr: 'school_translations', fk: 'school_id', workflow: 'school', order: 'position' },
  courses: { table: 'courses', tr: 'course_translations', fk: 'course_id', workflow: 'course', parents: ['school_id'], order: 'position' },
  modules: { table: 'modules', tr: 'module_translations', fk: 'module_id', workflow: 'module', parents: ['course_id'], order: 'position' },
  topics: { table: 'topics', tr: 'topic_translations', fk: 'topic_id', workflow: 'topic', parents: ['module_id'], order: 'position' },
  lessons: { table: 'lessons', tr: 'lesson_translations', fk: 'lesson_id', workflow: 'lesson', parents: ['topic_id'], order: 'position' },
  quizzes: {
    table: 'quizzes', tr: 'quiz_translations', fk: 'quiz_id', workflow: 'quiz',
    parents: ['school_id', 'course_id', 'module_id', 'topic_id', 'lesson_id'], order: 'position'
  },
  inspirations: { table: 'daily_inspirations', tr: 'daily_inspiration_translations', fk: 'inspiration_id', workflow: 'inspiration', order: 'created_at' },
  banners: { table: 'banners', tr: 'banner_translations', fk: 'banner_id', workflow: 'banner', parents: ['placement'], order: 'position' },
  pages: { table: 'cms_pages', tr: 'cms_page_translations', fk: 'page_id', workflow: 'page', order: 'slug' },
  achievements: { table: 'achievements', tr: 'achievement_translations', fk: 'achievement_id', workflow: 'achievement', order: 'position' },
  notifications: { table: 'notifications', tr: 'notification_translations', fk: 'notification_id', order: 'created_at' }
}

const id = (value: string) => {
  const parsed = Uuid.safeParse(value)
  if (!parsed.success) throw new ApiError(404, 'not_found', 'Ёфт нашуд.')
  return parsed.data
}

function blockIssues(issues: unknown): never {
  throw new ApiError(422, 'validation_failed', 'Блокҳо нодурустанд.', issues)
}

/** CMS page bodies use the lesson block schema with a single language per translation. */
function validatePageBody(body: unknown[], locale: string) {
  const result = validateBlocks(
    body.map((b) => {
      const { content, ...rest } = (b ?? {}) as Record<string, unknown>
      return { ...rest, content: content === undefined ? {} : { [locale]: content } }
    })
  )
  if (!result.ok) blockIssues(result.issues)
  return result.blocks.map(({ content, ...rest }) => ({ ...rest, content: content[locale as 'tg'] ?? {} }))
}

function entityRoutes(name: EntityName): AnyRoute[] {
  const cfg = ENTITIES[name]
  const base = `/admin/${name}`
  const tag = `Admin · ${name}`
  const fields = EntityFields[name]
  const select = `*, translations:${cfg.tr}(*)`
  const routes: AnyRoute[] = [
    route({
      method: 'GET', path: base, access: 'staff', tag, summary: `List ${name} (all statuses) with translations`,
      query: Paging.extend({
        status: Status.optional(),
        ...(cfg.parents ? Object.fromEntries(cfg.parents.map((p) => [p, z.string().max(80).optional()])) : {})
      }),
      handler: async ({ sb, query }) => {
        let q = sb().from(cfg.table).select(select, { count: 'exact' })
        const filters = query as Record<string, unknown>
        for (const p of cfg.parents ?? []) if (typeof filters[p] === 'string') q = q.eq(p, filters[p] as string)
        if (query.status) q = q.eq('status', query.status)
        const { data, error, count } = await q
          .order(cfg.order, { ascending: cfg.order !== 'created_at' })
          .range(query.offset, query.offset + query.limit - 1)
        if (error) throw fromDatabase(error)
        return { items: withMediaUrls(data), total: count }
      }
    }),
    route({
      method: 'POST', path: base, access: 'staff', tag, summary: `Create ${name.slice(0, -1)} (starts as draft)`, status: 201,
      body: fields.extend({ translations: z.partialRecord(Locale, TranslationSchemas[name]).optional() }),
      handler: async ({ sb, body }) => {
        const { translations, ...row } = body as Record<string, unknown> & { translations?: Record<string, Record<string, unknown>> }
        const client = sb()
        const created = await unwrap<{ id: string }>(client.from(cfg.table).insert(row).select('id').single())
        for (const [locale, t] of Object.entries(translations ?? {})) {
          const value = name === 'pages' ? { ...t, body: validatePageBody((t.body as unknown[]) ?? [], locale) } : t
          await unwrap(client.from(cfg.tr).upsert({ ...value, [cfg.fk]: created.id, locale }))
        }
        return unwrap(client.from(cfg.table).select(select).eq('id', created.id).single())
      }
    }),
    route({
      method: 'GET', path: `${base}/:id`, access: 'staff', tag, summary: `Get one ${name.slice(0, -1)}`,
      handler: async ({ sb, params }) =>
        withMediaUrls(await unwrap(sb().from(cfg.table).select(select).eq('id', id(params.id)).single()))
    }),
    route({
      method: 'PATCH', path: `${base}/:id`, access: 'staff', tag, summary: `Update ${name.slice(0, -1)} fields`,
      body: fields.partial(),
      handler: async ({ sb, params, body }) =>
        unwrap(sb().from(cfg.table).update(body as Record<string, unknown>).eq('id', id(params.id)).select(select).single())
    }),
    route({
      method: 'DELETE', path: `${base}/:id`, access: 'staff', tag,
      summary: `Delete a never-published ${name.slice(0, -1)} (published items are archived instead)`, status: 204,
      handler: async ({ sb, params }) => {
        const rows = await unwrap<unknown[]>(sb().from(cfg.table).delete().eq('id', id(params.id)).select('id'))
        if (!rows.length) throw new ApiError(403, 'forbidden', 'Иҷозат нест ё аллакай нашр шудааст.')
        return undefined
      }
    }),
    route({
      method: 'PUT', path: `${base}/:id/translations/:locale`, access: 'staff', tag, summary: 'Create or update one language version',
      body: TranslationSchemas[name],
      handler: async ({ sb, params, body }) => {
        const locale = Locale.parse(params.locale)
        const value = name === 'pages'
          ? { ...(body as Record<string, unknown>), body: validatePageBody(((body as { body?: unknown[] }).body) ?? [], locale) }
          : body
        return unwrap(
          sb().from(cfg.tr).upsert({ ...(value as Record<string, unknown>), [cfg.fk]: id(params.id), locale }).select('*').single()
        )
      }
    }),
    route({
      method: 'DELETE', path: `${base}/:id/translations/:locale`, access: 'staff', tag, summary: 'Remove one language version', status: 204,
      handler: async ({ sb, params }) => {
        await unwrap(sb().from(cfg.tr).delete().eq(cfg.fk, id(params.id)).eq('locale', Locale.parse(params.locale)))
        return undefined
      }
    })
  ]
  if (cfg.order === 'position') {
    routes.push(route({
      method: 'POST', path: `${base}/reorder`, access: 'staff', tag, summary: 'Set display order (drag-and-drop or keyboard)',
      body: ReorderBody,
      handler: async ({ sb, body }) => ({ updated: await call(sb(), 'admin_reorder', { p_entity: cfg.workflow ?? name, p_ids: body.ids }) })
    }))
  }
  if (cfg.workflow) {
    routes.push(
      route({
        method: 'POST', path: `${base}/:id/transition`, access: 'staff', tag,
        summary: 'Workflow: draft → in_review → approved/changes_requested → scheduled/published → archived',
        body: TransitionBody,
        handler: async ({ sb, params, body }) =>
          call(sb(), 'admin_transition', {
            p_entity: cfg.workflow, p_id: id(params.id), p_to: body.to, p_note: body.note ?? null, p_publish_at: body.publish_at ?? null
          })
      }),
      route({
        method: 'GET', path: `${base}/:id/validate`, access: 'staff', tag, summary: 'Publish checks (empty list = ready)',
        handler: async ({ sb, params }) => ({ errors: await call(sb(), 'admin_validate', { p_entity: cfg.workflow, p_id: id(params.id) }) })
      }),
      route({
        method: 'GET', path: `${base}/:id/history`, access: 'staff', tag, summary: 'Workflow history',
        handler: async ({ sb, params }) => call(sb(), 'admin_workflow_history', { p_entity: cfg.workflow, p_id: id(params.id) })
      })
    )
  }
  return routes
}

const revisionRoutes = (['lessons', 'quizzes'] as const).flatMap((name) => {
  const entity = name === 'lessons' ? 'lesson' : 'quiz'
  return [
    route({
      method: 'GET', path: `/admin/${name}/:id/revisions`, access: 'staff', tag: 'Admin · revisions', summary: `Revision history of a ${entity}`,
      handler: async ({ sb, params }) => call(sb(), 'admin_list_revisions', { p_entity: entity, p_id: id(params.id) })
    }),
    route({
      method: 'POST', path: `/admin/${name}/:id/revisions`, access: 'staff', tag: 'Admin · revisions', summary: 'Save a named revision',
      body: z.strictObject({ note: z.string().max(500).optional() }), status: 201,
      handler: async ({ sb, params, body }) =>
        ({ id: await call(sb(), 'admin_create_revision', { p_entity: entity, p_id: id(params.id), p_note: body.note ?? null }) })
    })
  ]
})

export const adminRoutes: AnyRoute[] = [
  ...(Object.keys(ENTITIES) as EntityName[]).flatMap(entityRoutes),
  ...revisionRoutes,

  route({
    method: 'GET', path: '/admin/revisions/:id', access: 'staff', tag: 'Admin · revisions', summary: 'Full snapshot of a revision (for comparison)',
    handler: async ({ sb, params }) => call(sb(), 'admin_get_revision', { p_revision: id(params.id) })
  }),
  route({
    method: 'POST', path: '/admin/revisions/:id/restore', access: 'staff', tag: 'Admin · revisions',
    summary: 'Restore the working copy from a revision (the current state is saved first)',
    handler: async ({ sb, params }) => call(sb(), 'admin_restore_revision', { p_revision: id(params.id) })
  }),

  // ------------------------------------------------------------------ Full Text Editor
  route({
    method: 'GET', path: '/admin/lessons/:id/blocks', access: 'staff', tag: 'Admin · editor', summary: 'Working-copy blocks with every language',
    handler: async ({ sb, params }) => {
      const client = sb()
      const lesson = await unwrap<{ version: number; draft_updated_at: string; published_at: string | null }>(
        client.from('lessons').select('version, draft_updated_at, published_at').eq('id', id(params.id)).single()
      )
      const rows = await unwrap<Array<Record<string, any>>>(
        client.from('content_blocks').select('id, type, schema_version, props, position, translations:content_block_translations(locale, content)')
          .eq('lesson_id', params.id).order('position')
      )
      return {
        version: lesson.version,
        has_unpublished_changes: !lesson.published_at || Date.parse(lesson.draft_updated_at) > Date.parse(lesson.published_at),
        blocks: rows.map(({ translations, ...b }) => ({
          ...b,
          content: Object.fromEntries((translations as Array<{ locale: string; content: unknown }>).map((t) => [t.locale, t.content]))
        }))
      }
    }
  }),
  route({
    method: 'PUT', path: '/admin/lessons/:id/blocks', access: 'staff', tag: 'Admin · editor',
    summary: 'Save the whole block list (autosave). Send expected_version for conflict detection.',
    body: z.strictObject({ expected_version: z.number().int().positive().nullable().default(null), blocks: z.array(z.unknown()).max(500) }),
    handler: async ({ sb, params, body }) => {
      const checked = validateBlocks(body.blocks)
      if (!checked.ok) blockIssues(checked.issues)
      return call(sb(), 'admin_save_lesson_blocks', {
        p_lesson: id(params.id), p_expected_version: body.expected_version, p_blocks: checked.blocks
      })
    }
  }),
  route({
    method: 'POST', path: '/admin/blocks/:id/duplicate', access: 'staff', tag: 'Admin · editor', summary: 'Duplicate a block below itself',
    status: 201,
    handler: async ({ sb, params }) => ({ id: await call(sb(), 'admin_duplicate_block', { p_block: id(params.id) }) })
  }),
  route({
    method: 'GET', path: '/admin/lessons/:id/preview', access: 'staff', tag: 'Admin · editor',
    summary: 'Preview the working copy exactly as readers will see it, with publish checks',
    query: LocaleQuery,
    handler: async ({ sb, params, query }) =>
      withMediaUrls(await call(sb(), 'admin_lesson_preview', { p_lesson: id(params.id), p_locale: query.locale }))
  }),

  // ------------------------------------------------------------------ Quiz Builder
  route({
    method: 'GET', path: '/admin/quizzes/:id/questions', access: 'staff', tag: 'Admin · quiz builder',
    summary: 'Questions with translations, options and answer keys',
    handler: async ({ sb, params }) =>
      unwrap(
        sb().from('quiz_questions')
          .select('*, translations:quiz_question_translations(*), options:quiz_options(*, translations:quiz_option_translations(*)), answer_key:quiz_answer_keys(*)')
          .eq('quiz_id', id(params.id)).order('position')
      )
  }),
  route({
    method: 'POST', path: '/admin/quizzes/:id/questions', access: 'staff', tag: 'Admin · quiz builder',
    summary: 'Add a manually written question with options and answer key', body: QuestionInput, status: 201,
    handler: async ({ sb, params, body }) => {
      if (!body.type) throw new ApiError(422, 'validation_failed', 'Навъи савол лозим аст.', [{ path: 'type', message: 'required' }])
      return call(sb(), 'admin_save_quiz_question', { p_question: { ...body, quiz_id: id(params.id) } })
    }
  }),
  route({
    method: 'PUT', path: '/admin/questions/:id', access: 'staff', tag: 'Admin · quiz builder', summary: 'Update a question',
    body: QuestionInput,
    handler: async ({ sb, params, body }) => call(sb(), 'admin_save_quiz_question', { p_question: { ...body, id: id(params.id) } })
  }),
  route({
    method: 'DELETE', path: '/admin/questions/:id', access: 'staff', tag: 'Admin · quiz builder', summary: 'Delete a question', status: 204,
    handler: async ({ sb, params }) => {
      const rows = await unwrap<unknown[]>(sb().from('quiz_questions').delete().eq('id', id(params.id)).select('id'))
      if (!rows.length) throw new ApiError(404, 'not_found', 'Ёфт нашуд.')
      return undefined
    }
  }),
  route({
    method: 'POST', path: '/admin/questions/:id/duplicate', access: 'staff', tag: 'Admin · quiz builder',
    summary: 'Independent copy of a question', status: 201,
    handler: async ({ sb, params }) => ({ id: await call(sb(), 'admin_duplicate_question', { p_question: id(params.id) }) })
  }),
  route({
    method: 'POST', path: '/admin/quizzes/:id/duplicate', access: 'staff', tag: 'Admin · quiz builder', summary: 'Copy a whole quiz as a draft',
    status: 201,
    handler: async ({ sb, params }) => ({ id: await call(sb(), 'admin_duplicate_quiz', { p_quiz: id(params.id) }) })
  }),
  route({
    method: 'GET', path: '/admin/quizzes/:id/preview', access: 'staff', tag: 'Admin · quiz builder',
    summary: 'Reader view of the draft with answer key and publish checks', query: LocaleQuery,
    handler: async ({ sb, params, query }) =>
      withMediaUrls(await call(sb(), 'admin_quiz_preview', { p_quiz: id(params.id), p_locale: query.locale }))
  }),
  route({
    method: 'POST', path: '/admin/quizzes/:id/preview/grade', access: 'staff', tag: 'Admin · quiz builder',
    summary: 'Grade answers against the draft (nothing is stored)',
    body: z.strictObject({ answers: Answers.default({}), locale: Locale.default('tg') }),
    handler: async ({ sb, params, body }) =>
      call(sb(), 'admin_quiz_preview_grade', { p_quiz: id(params.id), p_answers: body.answers, p_locale: body.locale })
  }),
  route({
    method: 'GET', path: '/admin/quizzes/:id/analytics', access: 'staff', tag: 'Admin · quiz builder', summary: 'Attempt statistics (QZ-17)',
    handler: async ({ sb, params }) => call(sb(), 'admin_quiz_analytics', { p_quiz: id(params.id) })
  }),
  route({
    method: 'GET', path: '/admin/quizzes/:id/attempts', access: 'staff', tag: 'Admin · quiz builder', summary: 'Attempts (review queue)',
    query: z.object({ status: z.enum(['in_progress', 'submitted', 'pending_review', 'graded']).optional() }),
    handler: async ({ sb, params, query }) =>
      call(sb(), 'admin_quiz_attempts', { p_quiz: id(params.id), p_status: query.status ?? null })
  }),
  route({
    method: 'POST', path: '/admin/attempts/:id/review', access: 'staff', tag: 'Admin · quiz builder',
    summary: 'Score a written or unmatched answer by hand',
    body: z.strictObject({ question_id: Uuid, points: z.number().min(0), comment: z.string().max(2000).optional() }),
    handler: async ({ sb, params, body }) =>
      call(sb(), 'admin_review_answer', {
        p_attempt: id(params.id), p_question: body.question_id, p_points: body.points, p_comment: body.comment ?? null
      })
  }),

  // ------------------------------------------------------------------ Media Library
  route({
    method: 'GET', path: '/admin/media', access: 'staff', tag: 'Admin · media', summary: 'Media library with filters',
    query: Paging.extend({
      kind: z.enum(['image', 'video', 'audio', 'file', 'model3d']).optional(),
      folder: z.string().max(120).optional(),
      status: z.enum(['active', 'archived']).optional(),
      q: z.string().max(100).optional()
    }),
    handler: async ({ sb, query }) => {
      let q = sb().from('media_assets').select('*, translations:media_asset_translations(*)', { count: 'exact' })
      if (query.kind) q = q.eq('kind', query.kind)
      if (query.folder) q = q.eq('folder', query.folder)
      if (query.status) q = q.eq('status', query.status)
      if (query.q) q = q.ilike('path', `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)
      const { data, error, count } = await q.order('created_at', { ascending: false }).range(query.offset, query.offset + query.limit - 1)
      if (error) throw fromDatabase(error)
      return { items: withMediaUrls(data), total: count }
    }
  }),
  route({
    method: 'POST', path: '/admin/media/upload-url', access: 'staff', tag: 'Admin · media',
    summary: 'Signed upload URL; upload the file directly to storage, then register it with POST /admin/media',
    body: z.strictObject({
      bucket: z.enum(['media', 'media-protected']).default('media'),
      kind: z.enum(['image', 'video', 'audio', 'file', 'model3d']),
      filename: z.string().min(1).max(200)
    }),
    status: 201,
    handler: async ({ sb, body }) => {
      const now = new Date()
      const safe = body.filename.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'file'
      const path = `${body.kind}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${safe}`
      const { data, error } = await sb().storage.from(body.bucket).createSignedUploadUrl(path)
      if (error || !data) throw new ApiError(403, 'forbidden', 'Иҷозат нест.')
      return { bucket: body.bucket, path: data.path, token: data.token, signed_url: data.signedUrl }
    }
  }),
  route({
    method: 'POST', path: '/admin/media', access: 'staff', tag: 'Admin · media', summary: 'Register an uploaded file with provenance (spec §9)',
    body: AssetCreate.extend({ translations: z.partialRecord(Locale, AssetTranslation).optional() }), status: 201,
    handler: async ({ sb, body }) => {
      const { translations, ...row } = body
      const client = sb()
      const asset = await unwrap<{ id: string }>(client.from('media_assets').insert(row).select('id').single())
      for (const [locale, t] of Object.entries(translations ?? {})) {
        await unwrap(client.from('media_asset_translations').upsert({ ...t, asset_id: asset.id, locale }))
      }
      return withMediaUrls(await unwrap(client.from('media_assets').select('*, translations:media_asset_translations(*)').eq('id', asset.id).single()))
    }
  }),
  route({
    method: 'GET', path: '/admin/media/:id', access: 'staff', tag: 'Admin · media', summary: 'Asset with translations and version history',
    handler: async ({ sb, params }) =>
      withMediaUrls(await unwrap(
        sb().from('media_assets').select('*, translations:media_asset_translations(*), versions:media_asset_versions(*)').eq('id', id(params.id)).single()
      ))
  }),
  route({
    method: 'PATCH', path: '/admin/media/:id', access: 'staff', tag: 'Admin · media', summary: 'Edit metadata, focal point, crop, provenance',
    body: AssetUpdate,
    handler: async ({ sb, params, body }) =>
      withMediaUrls(await unwrap(sb().from('media_assets').update(body).eq('id', id(params.id)).select('*').single()))
  }),
  route({
    method: 'PUT', path: '/admin/media/:id/translations/:locale', access: 'staff', tag: 'Admin · media', summary: 'Alt text, caption, transcript',
    body: AssetTranslation,
    handler: async ({ sb, params, body }) =>
      unwrap(sb().from('media_asset_translations').upsert({ ...body, asset_id: id(params.id), locale: Locale.parse(params.locale) }).select('*').single())
  }),
  route({
    method: 'POST', path: '/admin/media/:id/replace', access: 'staff', tag: 'Admin · media',
    summary: 'Replace the file; all content using the asset updates without republishing or an app rebuild',
    body: z.strictObject({
      bucket: z.enum(['media', 'media-protected']), path: z.string().min(1).max(500).regex(/^[A-Za-z0-9/_.-]+$/),
      mime_type: z.string().min(3).max(120), size_bytes: z.number().int().min(0).optional(), width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(), duration_seconds: z.number().min(0).optional(), checksum: z.string().max(128).optional()
    }),
    handler: async ({ sb, params, body }) =>
      withMediaUrls(await call(sb(), 'admin_replace_asset', {
        p_asset: id(params.id), p_bucket: body.bucket, p_path: body.path, p_mime_type: body.mime_type,
        p_size_bytes: body.size_bytes ?? null, p_width: body.width ?? null, p_height: body.height ?? null,
        p_duration_seconds: body.duration_seconds ?? null, p_checksum: body.checksum ?? null
      }))
  }),
  route({
    method: 'GET', path: '/admin/media/:id/usage', access: 'staff', tag: 'Admin · media', summary: 'Where the asset is used',
    handler: async ({ sb, params }) => call(sb(), 'admin_asset_usage', { p_asset: id(params.id) })
  }),
  route({
    method: 'DELETE', path: '/admin/media/:id', access: 'staff', tag: 'Admin · media',
    summary: 'Delete an unused asset (409 asset_in_use lists where it is used)', status: 204,
    handler: async ({ sb, params }) => {
      const rows = await unwrap<unknown[]>(sb().from('media_assets').delete().eq('id', id(params.id)).select('id'))
      if (!rows.length) throw new ApiError(403, 'forbidden', 'Иҷозат нест.')
      return undefined
    }
  }),

  // ------------------------------------------------------------------ help texts & UI strings
  route({
    method: 'GET', path: '/admin/help-texts', access: 'staff', tag: 'Admin · texts', summary: 'All “!” help texts',
    handler: async ({ sb }) => unwrap(sb().from('help_texts').select('*, translations:help_text_translations(*)').order('key'))
  }),
  route({
    method: 'PUT', path: '/admin/help-texts/:key', access: 'staff', tag: 'Admin · texts', summary: 'Create or update a help text',
    body: z.strictObject({
      enabled: z.boolean().default(true),
      icon: z.enum(['info', 'alert', 'question']).default('info'),
      translations: z.partialRecord(Locale, z.strictObject({
        title: z.string().max(120).nullable().optional(), body: z.string().min(1).max(600), ready: z.boolean().default(false)
      })).default({})
    }),
    handler: async ({ sb, params, body }) => {
      const key = z.string().regex(/^[a-z0-9_.-]+$/).max(80).parse(params.key)
      const client = sb()
      await unwrap(client.from('help_texts').upsert({ key, enabled: body.enabled, icon: body.icon }))
      for (const [locale, t] of Object.entries(body.translations)) {
        await unwrap(client.from('help_text_translations').upsert({ ...t, key, locale }))
      }
      return unwrap(client.from('help_texts').select('*, translations:help_text_translations(*)').eq('key', key).single())
    }
  }),
  route({
    method: 'GET', path: '/admin/ui-strings', access: 'staff', tag: 'Admin · texts', summary: 'All managed UI strings',
    handler: async ({ sb }) => unwrap(sb().from('ui_strings').select('*').order('key'))
  }),
  route({
    method: 'PUT', path: '/admin/ui-strings/:key/:locale', access: 'staff', tag: 'Admin · texts', summary: 'Set a UI string (keep it short)',
    body: z.strictObject({ value: z.string().min(1).max(2000) }),
    handler: async ({ sb, params, body }) =>
      unwrap(sb().from('ui_strings').upsert({
        key: z.string().regex(/^[a-z0-9_.-]+$/).max(80).parse(params.key), locale: Locale.parse(params.locale), value: body.value
      }).select('*').single())
  }),

  route({
    method: 'GET', path: '/admin/welcome-stats', access: 'staff', tag: 'Admin · texts', summary: 'How learners answered the welcome questions',
    handler: async ({ sb }) => call(sb(), 'admin_welcome_stats', {})
  }),

  // ------------------------------------------------------------------ notifications
  route({
    method: 'POST', path: '/admin/notifications/:id/schedule', access: 'staff', tag: 'Admin · notifications',
    summary: 'Send now or schedule', body: z.strictObject({ send_at: z.iso.datetime({ offset: true }).optional() }),
    handler: async ({ sb, params, body }) =>
      call(sb(), 'admin_schedule_notification', { p_notification: id(params.id), p_send_at: body.send_at ?? null })
  }),
  route({
    method: 'POST', path: '/admin/notifications/:id/cancel', access: 'staff', tag: 'Admin · notifications', summary: 'Cancel', status: 204,
    handler: async ({ sb, params }) => {
      await call(sb(), 'admin_cancel_notification', { p_notification: id(params.id) })
      return undefined
    }
  }),

  // ------------------------------------------------------------------ users, roles, access
  route({
    method: 'GET', path: '/admin/users', access: 'staff', tag: 'Admin · users', summary: 'Users with roles (content admins)',
    query: Paging.extend({ q: z.string().max(100).optional() }),
    handler: async ({ sb, query }) =>
      call(sb(), 'admin_list_users', { p_query: query.q ?? null, p_limit: query.limit, p_offset: query.offset })
  }),
  route({
    method: 'POST', path: '/admin/users/:id/roles', access: 'staff', tag: 'Admin · users', summary: 'Grant a role (super admin)',
    body: z.strictObject({ role: Role }), status: 204,
    handler: async ({ sb, params, body }) => {
      await call(sb(), 'admin_grant_role', { p_user: id(params.id), p_role: body.role })
      return undefined
    }
  }),
  route({
    method: 'DELETE', path: '/admin/users/:id/roles/:role', access: 'staff', tag: 'Admin · users', summary: 'Revoke a role (super admin)',
    status: 204,
    handler: async ({ sb, params }) => {
      await call(sb(), 'admin_revoke_role', { p_user: id(params.id), p_role: Role.parse(params.role) })
      return undefined
    }
  }),
  route({
    method: 'POST', path: '/admin/users/:id/entitlements', access: 'staff', tag: 'Admin · users',
    summary: 'Grant Premium access (no payment provider is integrated yet)',
    body: z.strictObject({ ends_at: z.iso.datetime({ offset: true }).optional(), note: z.string().max(500).optional() }), status: 201,
    handler: async ({ sb, params, body }) =>
      ({ id: await call(sb(), 'admin_grant_entitlement', { p_user: id(params.id), p_ends_at: body.ends_at ?? null, p_note: body.note ?? null }) })
  }),
  route({
    method: 'DELETE', path: '/admin/entitlements/:id', access: 'staff', tag: 'Admin · users', summary: 'End a Premium entitlement', status: 204,
    handler: async ({ sb, params }) => {
      await call(sb(), 'admin_revoke_entitlement', { p_entitlement: id(params.id) })
      return undefined
    }
  }),

  // ------------------------------------------------------------------ support chat and learner logins
  route({
    method: 'GET', path: '/admin/support', access: 'staff', tag: 'Admin · support', summary: 'Support threads, open and newest first',
    handler: async ({ sb }) => call(sb(), 'admin_support_threads')
  }),
  route({
    method: 'GET', path: '/admin/support/:id', access: 'staff', tag: 'Admin · support', summary: 'One support thread (marks it read)',
    handler: async ({ sb, params }) => call(sb(), 'admin_support_thread', { p_thread: id(params.id) })
  }),
  route({
    method: 'POST', path: '/admin/support/:id/reply', access: 'staff', tag: 'Admin · support', summary: 'Answer a support thread',
    body: z.strictObject({ body: z.string().trim().min(1).max(2000) }),
    handler: async ({ sb, params, body }) => call(sb(), 'admin_support_reply', { p_thread: id(params.id), p_body: body.body })
  }),
  route({
    method: 'POST', path: '/admin/support/:id/status', access: 'staff', tag: 'Admin · support', summary: 'Close or reopen a support thread',
    body: z.strictObject({ status: z.enum(['open', 'closed']) }),
    handler: async ({ sb, params, body }) => call(sb(), 'admin_support_status', { p_thread: id(params.id), p_status: body.status })
  }),
  route({
    method: 'POST', path: '/admin/learners/reset', access: 'staff', tag: 'Admin · support',
    summary: 'Temporary password and a new code for a learner who lost both (super admin)',
    body: z.strictObject({ username: z.string().trim().min(3).max(32) }),
    handler: async ({ sb, body }) => call(sb(), 'admin_profile_reset', { p_username: body.username })
  }),

  // ------------------------------------------------------------------ dashboard, search, audit
  route({
    method: 'GET', path: '/admin/dashboard', access: 'staff', tag: 'Admin · system', summary: 'Counts, statuses, storage and recent activity',
    handler: async ({ sb }) => call(sb(), 'admin_dashboard')
  }),
  route({
    method: 'GET', path: '/admin/search', access: 'staff', tag: 'Admin · system', summary: 'Global search including drafts',
    query: z.object({ q: z.string().max(100).default(''), limit: z.coerce.number().int().min(1).max(200).default(50) }),
    handler: async ({ sb, query }) => call(sb(), 'admin_search', { p_q: query.q, p_limit: query.limit })
  }),
  route({
    method: 'GET', path: '/admin/audit', access: 'staff', tag: 'Admin · system', summary: 'Audit log (content admins)',
    query: Paging.extend({ table: z.string().max(80).optional(), entity_id: z.string().max(80).optional() }),
    handler: async ({ sb, query }) => {
      let q = sb().from('audit_logs').select('*')
      if (query.table) q = q.eq('table_name', query.table)
      if (query.entity_id) q = q.eq('entity_id', query.entity_id)
      return unwrap(q.order('created_at', { ascending: false }).range(query.offset, query.offset + query.limit - 1))
    }
  })
]
