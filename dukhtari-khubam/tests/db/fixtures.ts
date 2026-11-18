import { as, createUser, rpc, type Db } from './harness'

export interface World {
  admin: string
  author: string
  author2: string
  reviewer: string
  reader: string
  school: string
  course: string
  module: string
  topic: string
  asset: string
}

/** Users with roles plus a published school → course → module → topic chain. */
export async function buildWorld(db: Db): Promise<World> {
  const admin = await createUser(db, 'admin@example.test', ['content_admin'])
  const author = await createUser(db, 'author@example.test', ['author'])
  const author2 = await createUser(db, 'author2@example.test', ['author'])
  const reviewer = await createUser(db, 'reviewer@example.test', ['reviewer'])
  const reader = await createUser(db, 'reader@example.test')
  const school = (await db.query<{ id: string }>("select id from public.schools where slug = 'marifati-dini'")).rows[0].id

  const ids = await as(db, admin, async (tx) => {
    const course = (await tx.query<{ id: string }>(
      "insert into public.courses (school_id, slug) values ($1, 'test-course') returning id", [school])).rows[0].id
    await tx.query("insert into public.course_translations (course_id, locale, title, ready) values ($1, 'tg', 'Курси санҷишӣ', true)", [course])
    const module = (await tx.query<{ id: string }>('insert into public.modules (course_id) values ($1) returning id', [course])).rows[0].id
    await tx.query("insert into public.module_translations (module_id, locale, title, ready) values ($1, 'tg', 'Модули 1', true)", [module])
    const topic = (await tx.query<{ id: string }>('insert into public.topics (module_id) values ($1) returning id', [module])).rows[0].id
    await tx.query("insert into public.topic_translations (topic_id, locale, title, ready) values ($1, 'tg', 'Мавзӯи 1', true)", [topic])
    for (const [entity, id] of [['course', course], ['module', module], ['topic', topic]] as const) {
      await rpc(tx, 'admin_transition', { p_entity: entity, p_id: id, p_to: 'published' })
    }
    const asset = (await tx.query<{ id: string }>(
      `insert into public.media_assets (kind, bucket, path, mime_type, origin, license, width, height)
       values ('image', 'media', 'lessons/photo-1.webp', 'image/webp', 'photo', 'CC BY 4.0', 1200, 800) returning id`)).rows[0].id
    return { course, module, topic, asset }
  })
  return { admin, author, author2, reviewer, reader, school, ...ids }
}

export const span = (text: string) => ({ spans: [{ text }] })
