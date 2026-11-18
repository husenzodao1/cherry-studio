import { z } from 'zod'

import { cleanText, Locale, SafeHref } from './blocks'

export const Uuid = z.uuid()
export const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase-latin-slug').max(80)
export const Tier = z.enum(['free', 'premium'])
export const Status = z.enum(['draft', 'in_review', 'changes_requested', 'approved', 'scheduled', 'published', 'archived'])
export const Role = z.enum(['super_admin', 'content_admin', 'author', 'editor', 'reviewer', 'media_manager', 'analytics_viewer'])
export const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

export const LocaleQuery = z.object({ locale: Locale.default('tg') })
export const Paging = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
})

const title = (max: number) => cleanText(max).pipe(z.string().min(1))
const optText = (max: number) => cleanText(max).nullable().optional()

/** Per-entity translation payloads. `ready` publishes that language independently (spec §13). */
export const TranslationSchemas = {
  schools: z.strictObject({ title: title(120), description: optText(600), ready: z.boolean().default(false) }),
  courses: z.strictObject({
    title: title(160),
    description: optText(2000),
    goals: z.array(cleanText(300)).max(20).default([]),
    ready: z.boolean().default(false)
  }),
  modules: z.strictObject({ title: title(160), description: optText(2000), ready: z.boolean().default(false) }),
  topics: z.strictObject({ title: title(160), description: optText(2000), ready: z.boolean().default(false) }),
  lessons: z.strictObject({ title: title(200), summary: optText(1000), ready: z.boolean().default(false) }),
  quizzes: z.strictObject({
    title: title(200),
    description: optText(1000),
    instructions: optText(2000),
    completion_text: optText(2000),
    ready: z.boolean().default(false)
  }),
  inspirations: z
    .strictObject({
      body: title(1000),
      author_name: optText(200),
      source_title: optText(300),
      source_url: SafeHref.nullable().optional(),
      ready: z.boolean().default(false)
    })
    .refine((v) => !v.author_name || !!v.source_title, { message: 'author needs a source', path: ['source_title'] }),
  banners: z.strictObject({ title: title(120), subtitle: optText(300), cta_label: optText(40), ready: z.boolean().default(false) }),
  pages: z.strictObject({ title: title(200), body: z.array(z.unknown()).max(300).default([]), ready: z.boolean().default(false) }),
  achievements: z.strictObject({ title: title(120), description: optText(500), ready: z.boolean().default(false) }),
  notifications: z.strictObject({ title: title(80), body: optText(300) })
} as const

const AssetRef = Uuid.nullable().optional()
const Position = z.number().int().min(0).max(100000).optional()

/** Writable fields per entity (workflow columns are never accepted here). */
export const EntityFields = {
  schools: z.strictObject({
    slug: Slug,
    position: Position,
    theme_color: HexColor.nullable().optional(),
    icon_asset_id: AssetRef,
    hero_asset_id: AssetRef,
    access_tier: Tier.optional()
  }),
  courses: z.strictObject({
    school_id: Uuid,
    slug: Slug,
    position: Position,
    level: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
    estimated_minutes: z.number().int().min(0).max(100000).nullable().optional(),
    access_tier: Tier.optional(),
    cover_asset_id: AssetRef,
    model_asset_id: AssetRef
  }),
  modules: z.strictObject({ course_id: Uuid, position: Position }),
  topics: z.strictObject({ module_id: Uuid, position: Position }),
  lessons: z.strictObject({
    topic_id: Uuid,
    position: Position,
    access_tier: Tier.optional(),
    estimated_minutes: z.number().int().min(0).max(10000).nullable().optional()
  }),
  quizzes: z.strictObject({
    slug: Slug,
    school_id: Uuid.nullable().optional(),
    course_id: Uuid.nullable().optional(),
    module_id: Uuid.nullable().optional(),
    topic_id: Uuid.nullable().optional(),
    lesson_id: Uuid.nullable().optional(),
    position: Position,
    pass_score_percent: z.number().min(0).max(100).optional(),
    time_limit_seconds: z.number().int().min(1).max(86400).nullable().optional(),
    max_attempts: z.number().int().min(1).max(1000).nullable().optional(),
    allow_retry: z.boolean().optional(),
    shuffle_questions: z.boolean().optional(),
    shuffle_options: z.boolean().optional(),
    show_correct_answers: z.enum(['never', 'after_each', 'after_submit']).optional(),
    show_explanations: z.enum(['never', 'after_each', 'after_submit']).optional(),
    access_tier: Tier.optional(),
    cover_asset_id: AssetRef
  }),
  inspirations: z.strictObject({
    image_asset_id: AssetRef,
    placement: z.enum(['home', 'lesson', 'notification']).optional()
  }),
  banners: z.strictObject({
    placement: z.enum(['home_top', 'home_card', 'school']),
    image_asset_id: AssetRef,
    link_url: SafeHref.nullable().optional(),
    deep_link: z.string().regex(/^\/[A-Za-z0-9/_?=&.-]*$/).nullable().optional(),
    position: Position,
    ends_at: z.iso.datetime({ offset: true }).nullable().optional()
  }),
  pages: z.strictObject({ slug: Slug }),
  achievements: z.strictObject({
    key: z.string().regex(/^[a-z0-9_.-]+$/).max(80),
    icon_asset_id: AssetRef,
    position: Position,
    rule: z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal('lessons_completed'), count: z.number().int().min(1) }),
      z.strictObject({ type: z.literal('quizzes_passed'), count: z.number().int().min(1) }),
      z.strictObject({ type: z.literal('quiz_passed'), quiz_id: Uuid }),
      z.strictObject({ type: z.literal('course_completed'), course_id: Uuid }),
      z.strictObject({ type: z.literal('school_completed'), school_id: Uuid })
    ])
  }),
  notifications: z.strictObject({
    audience: z
      .discriminatedUnion('type', [
        z.strictObject({ type: z.literal('all') }),
        z.strictObject({ type: z.literal('school'), school_id: Uuid }),
        z.strictObject({ type: z.literal('course'), course_id: Uuid })
      ])
      .optional(),
    deep_link: z.string().regex(/^\/[A-Za-z0-9/_?=&.-]*$/).nullable().optional()
  })
} as const

export type EntityName = keyof typeof EntityFields

export const TransitionBody = z.strictObject({
  to: Status,
  note: cleanText(500).optional(),
  publish_at: z.iso.datetime({ offset: true }).optional()
})

export const ReorderBody = z.strictObject({ ids: z.array(Uuid).min(1).max(1000) })

const OptionTranslation = z.strictObject({ text: optText(1000), feedback: optText(2000) })
const QuestionTranslation = z.strictObject({
  prompt: title(4000),
  hint: optText(1000),
  explanation_correct: optText(4000),
  explanation_incorrect: optText(4000),
  rubric: optText(4000)
})

/** One question as the author builds it (QZ-05..QZ-11). Options can be referenced by `ref` before they have ids. */
export const QuestionInput = z.strictObject({
  type: z.enum(['single_choice', 'multiple_choice', 'true_false', 'matching', 'ordering', 'short_answer', 'long_answer']).optional(),
  section_id: Uuid.nullable().optional(),
  position: Position,
  points: z.number().positive().max(1000).optional(),
  partial_credit: z.boolean().optional(),
  penalty: z.number().min(0).max(1000).optional(),
  media_asset_id: AssetRef,
  media_required: z.boolean().optional(),
  exclude_from_shuffle: z.boolean().optional(),
  required: z.boolean().optional(),
  case_sensitive: z.boolean().optional(),
  ignore_punctuation: z.boolean().optional(),
  manual_review_on_mismatch: z.boolean().optional(),
  related_lesson_id: Uuid.nullable().optional(),
  is_active: z.boolean().optional(),
  translations: z.partialRecord(Locale, QuestionTranslation.nullable()).optional(),
  options: z
    .array(
      z.strictObject({
        id: Uuid.optional(),
        ref: z.string().min(1).max(40).optional(),
        side: z.enum(['left', 'right']).nullable().optional(),
        media_asset_id: AssetRef,
        is_active: z.boolean().optional(),
        translations: z.partialRecord(Locale, OptionTranslation.nullable()).optional()
      })
    )
    .max(50)
    .optional(),
  answer_key: z
    .strictObject({
      correct: z.array(z.string().max(40)).max(50).optional(),
      order: z.array(z.string().max(40)).max(50).optional(),
      matching: z.record(z.string().max(40), z.string().max(40)).optional(),
      accepted_answers: z.partialRecord(Locale, z.array(cleanText(300)).max(50)).optional()
    })
    .optional()
})

export const AnswerValue = z.union([
  z.strictObject({ option_id: Uuid }),
  z.strictObject({ option_ids: z.array(Uuid).max(50) }),
  z.strictObject({ pairs: z.record(Uuid, Uuid) }),
  z.strictObject({ order: z.array(Uuid).max(50) }),
  z.strictObject({ text: cleanText(10000) })
])
export const Answers = z.record(Uuid, AnswerValue)

export const AssetCreate = z.strictObject({
  kind: z.enum(['image', 'video', 'audio', 'file', 'model3d']),
  bucket: z.enum(['media', 'media-protected']).default('media'),
  path: z.string().min(1).max(500).regex(/^[A-Za-z0-9/_.-]+$/).refine((p) => !p.includes('..')),
  mime_type: z.string().min(3).max(120),
  size_bytes: z.number().int().min(0).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration_seconds: z.number().min(0).optional(),
  checksum: z.string().max(128).optional(),
  focal_x: z.number().min(0).max(1).optional(),
  focal_y: z.number().min(0).max(1).optional(),
  crop: z.record(z.string(), z.number()).optional(),
  hls_path: z.string().max(500).optional(),
  poster_asset_id: AssetRef,
  folder: cleanText(120).optional(),
  tags: z.array(cleanText(40)).max(20).optional(),
  origin: z.enum(['photo', 'stock', 'model3d', 'render3d', 'illustration', 'icon', 'document', 'other']),
  author_name: optText(200),
  source_url: SafeHref.nullable().optional(),
  license: optText(200),
  license_url: SafeHref.nullable().optional(),
  provenance_notes: optText(2000),
  is_ai_generated: z.boolean().default(false)
})
export const AssetUpdate = AssetCreate.omit({ kind: true, bucket: true, path: true, mime_type: true }).partial().extend({
  status: z.enum(['active', 'archived']).optional()
})
export const AssetTranslation = z.strictObject({
  title: optText(200),
  alt_text: optText(500),
  caption: optText(1000),
  transcript: optText(200000),
  subtitles_path: z.string().max(500).nullable().optional()
})
