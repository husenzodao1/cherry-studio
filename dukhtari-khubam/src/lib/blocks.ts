import { z } from 'zod'

/**
 * Content Block schema v1 (spec §5.6, §5.7, Part II §10).
 * Rich text is structured JSON (spans with whitelisted marks and palette colours), never HTML,
 * so nothing executable can be stored or rendered. Links allow https, mailto and in-app paths only.
 */

export const LOCALES = ['tg', 'ru', 'ar'] as const
export const Locale = z.enum(LOCALES)
export type LocaleCode = z.infer<typeof Locale>

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g
export const cleanText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(CONTROL_CHARS, ''))

const Uuid = z.uuid()
export const TextColor = z.enum(['ink', 'plum', 'lavender', 'rose', 'champagne', 'sage'])
export const Highlight = z.enum(['champagne', 'lavender', 'rose', 'sage'])
export const Mark = z.enum(['bold', 'italic', 'underline', 'strike'])

export const SafeHref = z
  .string()
  .max(2000)
  .refine((v) => /^(https:\/\/[^\s]+|mailto:[^\s]+|\/(?!\/)[^\s]*)$/i.test(v), 'only https:, mailto: or in-app links')

export const Span = z.strictObject({
  text: cleanText(5000),
  marks: z.array(Mark).max(4).optional(),
  color: TextColor.optional(),
  highlight: Highlight.optional(),
  href: SafeHref.optional()
})
export const RichText = z.strictObject({
  spans: z.array(Span).max(500),
  align: z.enum(['start', 'center', 'end']).optional()
})
export type RichTextValue = z.infer<typeof RichText>

const Plain = (max = 500) => cleanText(max)
const NoProps = z.strictObject({})
const Caption = z.strictObject({ caption: Plain(1000).optional() })

/** props are language-independent; content is stored per locale. */
const BLOCKS = {
  heading: { props: z.strictObject({ level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2) }), content: RichText },
  subheading: { props: NoProps, content: RichText },
  paragraph: { props: NoProps, content: RichText },
  lead: { props: NoProps, content: RichText },
  rich_text: { props: NoProps, content: z.strictObject({ paragraphs: z.array(RichText).max(100) }) },
  ordered_list: { props: z.strictObject({ start: z.number().int().min(1).max(999).optional() }), content: z.strictObject({ items: z.array(RichText).max(200) }) },
  bullet_list: { props: NoProps, content: z.strictObject({ items: z.array(RichText).max(200) }) },
  image: {
    props: z.strictObject({
      asset_id: Uuid,
      layout: z.enum(['inline', 'full', 'side']).default('inline'),
      size: z.enum(['s', 'm', 'l']).default('l'),
      zoom: z.boolean().optional()
    }),
    content: Caption
  },
  gallery: {
    props: z.strictObject({ asset_ids: z.array(Uuid).min(1).max(30), layout: z.enum(['grid', 'carousel']).default('carousel') }),
    content: Caption
  },
  video: {
    props: z.strictObject({ asset_id: Uuid, poster_asset_id: Uuid.optional() }),
    content: z.strictObject({ title: Plain(200).optional(), caption: Plain(1000).optional() })
  },
  audio: {
    props: z.strictObject({ asset_id: Uuid, cover_asset_id: Uuid.optional() }),
    content: z.strictObject({ title: Plain(200).optional(), speaker: Plain(200).optional(), caption: Plain(1000).optional() })
  },
  quote: {
    props: z.strictObject({ style: z.enum(['elegant', 'plain']).default('elegant') }),
    content: z
      .strictObject({ text: RichText, author: Plain(200).optional(), source: Plain(300).optional() })
      .refine((c) => !c.author || !!c.source, { message: 'a quote attributed to a person needs a source', path: ['source'] })
  },
  callout: {
    props: z.strictObject({
      variant: z.enum(['important', 'warning', 'note', 'tip', 'info']),
      accent: z.enum(['champagne', 'rose', 'lavender', 'sage']).optional(),
      icon: z.enum(['info', 'alert', 'star', 'check', 'book']).optional()
    }),
    content: z.strictObject({ title: Plain(200).optional(), body: RichText })
  },
  table: {
    props: z.strictObject({ header_row: z.boolean().default(true) }),
    content: z.strictObject({ rows: z.array(z.array(RichText).max(10)).max(50), caption: Plain(500).optional() })
  },
  source: {
    props: z.strictObject({ url: SafeHref.optional() }),
    content: z.strictObject({
      title: Plain(300),
      author: Plain(200).optional(),
      publisher: Plain(200).optional(),
      year: Plain(20).optional(),
      pages: Plain(50).optional()
    })
  },
  file: { props: z.strictObject({ asset_id: Uuid }), content: z.strictObject({ label: Plain(200).optional() }) },
  practical_task: { props: NoProps, content: z.strictObject({ title: Plain(200), body: RichText }) },
  quiz: { props: z.strictObject({ quiz_id: Uuid }), content: null },
  related_lesson: { props: z.strictObject({ lesson_id: Uuid }), content: null },
  divider: { props: NoProps, content: null },
  illustration: { props: z.strictObject({ asset_id: Uuid }), content: Caption },
  full_width_media: { props: z.strictObject({ asset_id: Uuid }), content: Caption },
  side_by_side: {
    props: z.strictObject({ asset_id: Uuid, media_side: z.enum(['start', 'end']).default('start') }),
    content: z.strictObject({ text: RichText, caption: Plain(1000).optional() })
  },
  model3d: { props: z.strictObject({ asset_id: Uuid, auto_rotate: z.boolean().optional() }), content: Caption },
  caption: { props: NoProps, content: RichText },
  footnote: { props: z.strictObject({ marker: Plain(10).optional() }), content: RichText }
} as const

export type BlockType = keyof typeof BLOCKS
export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[]
export const BlockTypeSchema = z.enum(BLOCK_TYPES as [BlockType, ...BlockType[]])

export const BlockInput = z.strictObject({
  id: Uuid.optional(),
  type: BlockTypeSchema,
  schema_version: z.literal(1).default(1),
  props: z.record(z.string(), z.unknown()).default({}),
  content: z.partialRecord(Locale, z.unknown().nullable()).default({})
})
export type BlockInputValue = z.infer<typeof BlockInput>

export interface BlockIssue {
  index: number
  path: (string | number)[]
  message: string
}

/** Validate and normalise blocks. Returns clean blocks or the list of problems with their location. */
export function validateBlocks(input: unknown): { ok: true; blocks: BlockInputValue[] } | { ok: false; issues: BlockIssue[] } {
  const list = z.array(z.unknown()).max(500).safeParse(input)
  if (!list.success) return { ok: false, issues: [{ index: -1, path: [], message: 'blocks must be an array of at most 500 items' }] }
  const issues: BlockIssue[] = []
  const blocks: BlockInputValue[] = []
  list.data.forEach((raw, index) => {
    const base = BlockInput.safeParse(raw)
    if (!base.success) {
      for (const i of base.error.issues) issues.push({ index, path: i.path as (string | number)[], message: i.message })
      return
    }
    const spec = BLOCKS[base.data.type]
    const props = spec.props.safeParse(base.data.props)
    if (!props.success) {
      for (const i of props.error.issues) issues.push({ index, path: ['props', ...(i.path as (string | number)[])], message: i.message })
    }
    const content: BlockInputValue['content'] = {}
    for (const [locale, value] of Object.entries(base.data.content)) {
      if (value === null) {
        content[locale as LocaleCode] = null
        continue
      }
      if (!spec.content) {
        issues.push({ index, path: ['content', locale], message: `${base.data.type} has no text content` })
        continue
      }
      const parsed = spec.content.safeParse(value)
      if (!parsed.success) {
        for (const i of parsed.error.issues) issues.push({ index, path: ['content', locale, ...(i.path as (string | number)[])], message: i.message })
      } else {
        content[locale as LocaleCode] = parsed.data
      }
    }
    if (props.success) blocks.push({ ...base.data, props: props.data as Record<string, unknown>, content })
  })
  return issues.length ? { ok: false, issues } : { ok: true, blocks }
}

/** Plain text of a rich text value (used for previews and accessibility labels). */
export function richToPlain(value: RichTextValue | undefined | null): string {
  return value?.spans?.map((s) => s.text).join('') ?? ''
}
