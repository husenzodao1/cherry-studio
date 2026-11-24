import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, type World } from './fixtures'
import { as, createDb, expectError, type Db } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
})

describe('news and the Library', () => {
  it('the staff write news; everyone reads what is published, not what is to come', async () => {
    await as(db, w.admin, async (tx) => {
      await tx.query("insert into public.news (title, body, image_path) values ('Олимпиада', 'Сабти ном то 1 декабр.', 'image/2026/11/a.webp')")
      await tx.query("insert into public.news (title, body, published_at) values ('Фардо', 'Баъдтар', now() + interval '1 day')")
    })
    const seen = await as(db, null, (tx) => tx.query<{ title: string }>('select title from public.news order by published_at desc'))
    expect(seen.rows.map((r) => r.title)).toEqual(['Олимпиада'])
    // a learner cannot write news
    await expectError(as(db, w.reader, (tx) => tx.query("insert into public.news (title) values ('x')")), /row-level security/)
  })

  it('shelves and their books: written by the staff, unpublished books hidden from learners', async () => {
    await as(db, w.admin, async (tx) => {
      const { rows } = await tx.query<{ id: string }>("insert into public.library_shelves (title, emoji) values ('Адабиёт', '📚') returning id")
      await tx.query("insert into public.library_books (shelf_id, title, author, cover_path, file_path) values ($1, 'Шоҳнома', 'Фирдавсӣ', 'image/c.webp', 'file/b.pdf')", [rows[0].id])
      await tx.query("insert into public.library_books (shelf_id, title, published) values ($1, 'Нашр нашуда', false)", [rows[0].id])
    })
    const books = await as(db, w.reader, (tx) => tx.query<{ title: string }>('select title from public.library_books'))
    expect(books.rows.map((r) => r.title)).toEqual(['Шоҳнома'])
    await expectError(as(db, w.reader, (tx) => tx.query("insert into public.library_shelves (title) values ('x')")), /row-level security/)
    const all = await as(db, w.admin, (tx) => tx.query('select title from public.library_books'))
    expect(all.rows).toHaveLength(2)
  })
})
