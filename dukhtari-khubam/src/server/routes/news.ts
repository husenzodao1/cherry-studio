import { z } from 'zod'

import { ApiError } from '@/lib/http'
import { publicMediaUrl } from '@/lib/env'
import { route, type AnyRoute } from '@/lib/router'
import { unwrap } from '@/lib/supabase'

/**
 * News (the home screen's "Words of the day" block turned to "News") and the schools' Library — read by
 * everyone, written by the staff in the panel. Pictures, covers and books are files of the public 'media' bucket.
 */

const Lang = z.enum(['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs'])
const Audience = z.enum(['all', 'girls', 'boys'])
const Path = z.string().max(500).regex(/^[A-Za-z0-9/_.-]+$/)
const Id = z.uuid()
const url = (path: string | null) => (path ? publicMediaUrl('media', path) : null)
const forWhom = (audience: string | undefined) => (audience === 'boys' ? ['all', 'boys'] : audience === 'girls' ? ['all', 'girls'] : ['all', 'girls', 'boys'])

interface NewsRow { id: string; title: string; body: string; image_path: string | null; locale: string | null; audience: string; published_at: string }
interface ShelfRow { id: string; title: string; emoji: string | null; position: number }
interface BookRow { id: string; shelf_id: string; title: string; author: string | null; about: string | null; cover_path: string | null; file_path: string | null; pages: number | null; locale: string | null; audience: string; position: number; published: boolean }

const newsOut = (n: NewsRow) => ({ id: n.id, title: n.title, body: n.body, image: url(n.image_path), image_path: n.image_path, locale: n.locale, audience: n.audience, at: n.published_at })
const bookOut = (b: BookRow) => ({ ...b, cover: url(b.cover_path), file: url(b.file_path) })

const NewsBody = z.strictObject({
  title: z.string().trim().min(1).max(200), body: z.string().max(8000).default(''), image_path: Path.nullable().optional(),
  locale: Lang.nullable().optional(), audience: Audience.default('all'), published_at: z.iso.datetime({ offset: true }).optional()
})
const ShelfBody = z.strictObject({ title: z.string().trim().min(1).max(120), emoji: z.string().max(16).nullable().optional(), position: z.number().int().min(0).max(1000).default(0) })
const BookBody = z.strictObject({
  shelf_id: Id, title: z.string().trim().min(1).max(300), author: z.string().trim().max(200).nullable().optional(), about: z.string().max(4000).nullable().optional(),
  cover_path: Path.nullable().optional(), file_path: Path.nullable().optional(), pages: z.number().int().min(1).max(100000).nullable().optional(),
  locale: Lang.nullable().optional(), audience: Audience.default('all'), position: z.number().int().min(0).max(100000).default(0), published: z.boolean().default(true)
})

export const newsRoutes: AnyRoute[] = [
  route({
    method: 'GET', path: '/news', access: 'public', tag: 'News', summary: 'The newest news in her language (or for all), for her (girls, boys)', cache: 60,
    query: z.object({ locale: Lang.default('tg'), audience: Audience.optional() }),
    handler: async ({ sb, query }) => {
      const rows = await unwrap<NewsRow[]>(sb().from('news').select('*').lte('published_at', new Date().toISOString())
        .or(`locale.is.null,locale.eq.${query.locale}`).in('audience', forWhom(query.audience)).order('published_at', { ascending: false }).limit(20))
      return { items: rows.map(newsOut) }
    }
  }),
  route({
    method: 'GET', path: '/library', access: 'public', tag: 'Library', summary: 'The Library: its shelves (categories) with their books', cache: 60,
    query: z.object({ audience: Audience.optional() }),
    handler: async ({ sb, query }) => {
      const [shelves, books] = await Promise.all([
        unwrap<ShelfRow[]>(sb().from('library_shelves').select('*').order('position').order('created_at')),
        unwrap<BookRow[]>(sb().from('library_books').select('*').eq('published', true).in('audience', forWhom(query.audience)).order('position').order('created_at'))
      ])
      return { shelves: shelves.map((s) => ({ ...s, books: books.filter((b) => b.shelf_id === s.id).map(bookOut) })) }
    }
  }),

  // ── the staff ──
  route({
    method: 'GET', path: '/admin/news', access: 'staff', tag: 'Admin · news', summary: 'All news, the planned ones too',
    handler: async ({ sb }) => ({ items: (await unwrap<NewsRow[]>(sb().from('news').select('*').order('published_at', { ascending: false }).limit(200))).map(newsOut) })
  }),
  route({
    method: 'POST', path: '/admin/news', access: 'staff', tag: 'Admin · news', summary: 'News written', body: NewsBody, status: 201,
    handler: async ({ sb, body }) => newsOut(await unwrap<NewsRow>(sb().from('news').insert(body).select('*').single()))
  }),
  route({
    method: 'PATCH', path: '/admin/news/:id', access: 'staff', tag: 'Admin · news', summary: 'News changed', body: NewsBody.partial(),
    handler: async ({ sb, body, params }) => newsOut(await unwrap<NewsRow>(sb().from('news').update(body).eq('id', Id.parse(params.id)).select('*').single()))
  }),
  route({
    method: 'DELETE', path: '/admin/news/:id', access: 'staff', tag: 'Admin · news', summary: 'News taken away',
    handler: async ({ sb, params }) => {
      const gone = await unwrap<unknown[]>(sb().from('news').delete().eq('id', Id.parse(params.id)).select('id'))
      if (!gone.length) throw new ApiError(404, 'not_found', 'Ёфт нашуд.')
      return { ok: true }
    }
  }),
  route({
    method: 'GET', path: '/admin/library', access: 'staff', tag: 'Admin · library', summary: 'The shelves and every book, the hidden ones too',
    handler: async ({ sb }) => {
      const [shelves, books] = await Promise.all([
        unwrap<ShelfRow[]>(sb().from('library_shelves').select('*').order('position').order('created_at')),
        unwrap<BookRow[]>(sb().from('library_books').select('*').order('position').order('created_at'))
      ])
      return { shelves: shelves.map((s) => ({ ...s, books: books.filter((b) => b.shelf_id === s.id).map(bookOut) })) }
    }
  }),
  route({
    method: 'POST', path: '/admin/library/shelves', access: 'staff', tag: 'Admin · library', summary: 'A shelf (category) added', body: ShelfBody, status: 201,
    handler: async ({ sb, body }) => unwrap<ShelfRow>(sb().from('library_shelves').insert(body).select('*').single())
  }),
  route({
    method: 'DELETE', path: '/admin/library/shelves/:id', access: 'staff', tag: 'Admin · library', summary: 'A shelf taken away, with its books',
    handler: async ({ sb, params }) => { await unwrap(sb().from('library_shelves').delete().eq('id', Id.parse(params.id)).select('id')); return { ok: true } }
  }),
  route({
    method: 'POST', path: '/admin/library/books', access: 'staff', tag: 'Admin · library', summary: 'A book put on a shelf', body: BookBody, status: 201,
    handler: async ({ sb, body }) => bookOut(await unwrap<BookRow>(sb().from('library_books').insert(body).select('*').single()))
  }),
  route({
    method: 'PATCH', path: '/admin/library/books/:id', access: 'staff', tag: 'Admin · library', summary: 'A book changed (hidden, moved, renamed)', body: BookBody.partial(),
    handler: async ({ sb, body, params }) => bookOut(await unwrap<BookRow>(sb().from('library_books').update(body).eq('id', Id.parse(params.id)).select('*').single()))
  }),
  route({
    method: 'DELETE', path: '/admin/library/books/:id', access: 'staff', tag: 'Admin · library', summary: 'A book taken away',
    handler: async ({ sb, params }) => { await unwrap(sb().from('library_books').delete().eq('id', Id.parse(params.id)).select('id')); return { ok: true } }
  })
]
