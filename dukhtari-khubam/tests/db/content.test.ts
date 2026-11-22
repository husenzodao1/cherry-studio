import { beforeAll, describe, expect, it } from 'vitest'

import { buildWorld, span, type World } from './fixtures'
import { as, createDb, createUser, expectError, rpc, type Db } from './harness'

let db: Db
let w: World

beforeAll(async () => {
  db = await createDb()
  w = await buildWorld(db)
})

async function createLesson(owner: string, title: string): Promise<string> {
  return as(db, owner, async (tx) => {
    const id = (await tx.query<{ id: string }>('insert into public.lessons (topic_id) values ($1) returning id', [w.topic])).rows[0].id
    await tx.query("insert into public.lesson_translations (lesson_id, locale, title, ready) values ($1, 'tg', $2, true)", [id, title])
    return id
  })
}

async function publishLesson(lesson: string, note?: string) {
  await as(db, w.author, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'in_review' }))
  await as(db, w.reviewer, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'approved' }))
  return as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'published', p_note: note ?? null }))
}

describe('catalog & RBAC', () => {
  it('seeds the seven schools for anonymous readers', async () => {
    const schools = await as(db, null, (tx) => rpc(tx, 'api_schools', { p_locale: 'tg' }))
    expect(schools.map((s: any) => s.title)).toEqual([
      'Маърифати динӣ', 'Одоб ва ахлоқ', 'Фарҳанги тоҷик', 'Оила ва муносибатҳо',
      'Илм ва саломатӣ', 'Рушди шахсият', 'Зиндагии муосир'
    ])
    // the published test course has no lesson yet: it is not counted (catalogue.test.ts)
    expect(schools[0].course_count).toBe(0)
  })

  it('hides drafts from readers and lets staff see them', async () => {
    const draft = await as(db, w.author, async (tx) =>
      (await tx.query<{ id: string }>("insert into public.courses (school_id, slug) values ($1, 'draft-course') returning id", [w.school])).rows[0].id)
    const anonRows = await as(db, null, (tx) => tx.query('select id from public.courses where id = $1', [draft]))
    const readerRows = await as(db, w.reader, (tx) => tx.query('select id from public.courses where id = $1', [draft]))
    const staffRows = await as(db, w.reviewer, (tx) => tx.query('select id from public.courses where id = $1', [draft]))
    expect(anonRows.rows).toHaveLength(0)
    expect(readerRows.rows).toHaveLength(0)
    expect(staffRows.rows).toHaveLength(1)
  })

  it('lets authors edit only their own rows', async () => {
    const mine = await createLesson(w.author, 'Дарси муаллиф')
    const updated = await as(db, w.author2, (tx) =>
      tx.query('update public.lessons set estimated_minutes = 5 where id = $1 returning id', [mine]))
    expect(updated.rows).toHaveLength(0)
    await expectError(
      as(db, w.author2, (tx) => rpc(tx, 'admin_save_lesson_blocks', { p_lesson: mine, p_expected_version: null, p_blocks: [] })),
      'forbidden')
  })

  it('blocks clients from writing workflow columns directly', async () => {
    const lesson = await createLesson(w.author, 'Кӯшиши нашри мустақим')
    await expectError(
      as(db, w.author, (tx) => tx.query("update public.lessons set status = 'published' where id = $1", [lesson])),
      'protected_field')
    const forced = await as(db, w.admin, async (tx) =>
      (await tx.query<{ status: string }>("insert into public.courses (school_id, slug, status) values ($1, 'sneaky', 'published') returning status", [w.school])).rows[0])
    expect(forced.status).toBe('draft')
  })

  it('denies anonymous callers the staff RPCs', async () => {
    await expectError(as(db, null, (tx) => rpc(tx, 'admin_dashboard')), /permission denied|forbidden/)
    await expectError(as(db, w.reader, (tx) => rpc(tx, 'admin_dashboard')), 'forbidden')
    const dash = await as(db, w.admin, (tx) => rpc(tx, 'admin_dashboard'))
    expect(dash.counts.schools).toBe(7)
  })
})

describe('lesson authoring, review and publication', () => {
  let lesson: string

  it('requires review, valid assets and alt text before publishing', async () => {
    lesson = await createLesson(w.author, 'Ислом ва инсон')
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: { tg: span('Сарлавҳа') } },
      { type: 'paragraph', props: {}, content: { tg: span('Параграфи аввал') } },
      { type: 'image', props: { asset_id: w.asset, layout: 'inline' }, content: { tg: { caption: 'Тавзеҳ' } } },
      { type: 'paragraph', props: {}, content: { tg: span('Параграфи дуюм бо калимаи нодир зафаронак') } },
      { type: 'callout', props: { variant: 'important', accent: 'champagne' }, content: { tg: { title: 'Муҳим', body: span('Матн') } } }
    ]
    const saved = await as(db, w.author, (tx) => rpc(tx, 'admin_save_lesson_blocks', { p_lesson: lesson, p_expected_version: 1, p_blocks: blocks }))
    expect(saved.version).toBe(2)

    await expectError(
      as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'published' })),
      'review_required')

    const errors = await as(db, w.author, (tx) => rpc(tx, 'admin_validate', { p_entity: 'lesson', p_id: lesson }))
    expect(errors).toEqual([{ code: 'missing_alt_text', block_id: expect.any(String), asset_id: w.asset, locale: 'tg' }])

    await as(db, w.author, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'in_review' }))
    await expectError(
      as(db, w.author, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'approved' })),
      'forbidden')
    await as(db, w.reviewer, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'approved' }))
    await expectError(
      as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'published' })),
      'validation_failed')

    await as(db, w.author, (tx) => tx.query(
      "insert into public.media_asset_translations (asset_id, locale, alt_text) values ($1, 'tg', 'Расми масҷид')", [w.asset]))
    const res = await as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: lesson, p_to: 'published' }))
    expect(res.status).toBe('published')
    expect(res.revision_id).toBeTruthy()
  })

  it('serves the published snapshot to readers, image between paragraphs', async () => {
    const view = await as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: lesson, p_locale: 'ru' }))
    expect(view.locale).toBe('tg')
    expect(view.title).toBe('Ислом ва инсон')
    expect(view.blocks.map((b: any) => b.type)).toEqual(['heading', 'paragraph', 'image', 'paragraph', 'callout'])
    expect(view.assets[w.asset].path).toBe('lessons/photo-1.webp')
    expect(view.assets[w.asset].alt).toBe('Расми масҷид')
    expect(view.context.school.title).toBe('Маърифати динӣ')
  })

  it('keeps the live version unchanged while the draft is edited', async () => {
    const current = await as(db, w.author, async (tx) =>
      (await tx.query<{ version: number }>('select version from public.lessons where id = $1', [lesson])).rows[0].version)
    await as(db, w.author, (tx) => rpc(tx, 'admin_save_lesson_blocks', {
      p_lesson: lesson, p_expected_version: current,
      p_blocks: [{ type: 'paragraph', props: {}, content: { tg: span('Матни нав') } }]
    }))
    const live = await as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: lesson, p_locale: 'tg' }))
    expect(live.blocks).toHaveLength(5)

    await expectError(
      as(db, w.author, (tx) => rpc(tx, 'admin_save_lesson_blocks', { p_lesson: lesson, p_expected_version: current, p_blocks: [] })),
      'version_conflict')

    const preview = await as(db, w.reviewer, (tx) => rpc(tx, 'admin_lesson_preview', { p_lesson: lesson, p_locale: 'tg' }))
    expect(preview.blocks).toHaveLength(1)
    expect(preview.preview).toBe(true)

    await publishLesson(lesson, 'v2')
    const after = await as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: lesson, p_locale: 'tg' }))
    expect(after.blocks).toHaveLength(1)
    expect(after.blocks[0].content.spans[0].text).toBe('Матни нав')
  })

  it('records revision history and restores an earlier version', async () => {
    const revisions = await as(db, w.author, (tx) => rpc(tx, 'admin_list_revisions', { p_entity: 'lesson', p_id: lesson }))
    const kinds = revisions.map((r: any) => r.kind)
    expect(kinds).toContain('publish')
    expect(kinds).toContain('review')
    const firstPublish = revisions.filter((r: any) => r.kind === 'publish').at(-1)
    const restored = await as(db, w.author, (tx) => rpc(tx, 'admin_restore_revision', { p_revision: firstPublish.id }))
    expect(restored.backup_revision).toBeTruthy()
    const preview = await as(db, w.author, (tx) => rpc(tx, 'admin_lesson_preview', { p_lesson: lesson, p_locale: 'tg' }))
    expect(preview.blocks).toHaveLength(5)
    const history = await as(db, w.admin, (tx) => rpc(tx, 'admin_workflow_history', { p_entity: 'lesson', p_id: lesson }))
    expect(history.length).toBeGreaterThanOrEqual(6)
  })

  it('finds published lesson text through search', async () => {
    await publishLesson(lesson)
    const hits = await as(db, null, (tx) => rpc(tx, 'api_search', { p_q: 'зафаронак', p_locale: 'tg', p_limit: 10 }))
    expect(hits[0]).toMatchObject({ type: 'lesson', id: lesson })
  })

  it('replaces a media file everywhere without republishing, and refuses deleting used assets', async () => {
    await as(db, w.admin, (tx) => rpc(tx, 'admin_replace_asset', {
      p_asset: w.asset, p_bucket: 'media', p_path: 'lessons/photo-1-v2.webp', p_mime_type: 'image/webp'
    }))
    const view = await as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: lesson, p_locale: 'tg' }))
    expect(view.assets[w.asset].path).toBe('lessons/photo-1-v2.webp')
    expect(view.assets[w.asset].version).toBe(2)
    await expectError(as(db, w.admin, (tx) => tx.query('delete from public.media_assets where id = $1', [w.asset])), 'asset_in_use')
    const usage = await as(db, w.admin, (tx) => rpc(tx, 'admin_asset_usage', { p_asset: w.asset }))
    expect(usage.some((u: any) => u.entity === 'lesson_published' && u.live)).toBe(true)
  })

  it('locks premium lessons for users without an entitlement', async () => {
    const premium = await createLesson(w.author, 'Дарси Premium')
    await as(db, w.author, async (tx) => {
      await tx.query("update public.lessons set access_tier = 'premium' where id = $1", [premium])
      await rpc(tx, 'admin_save_lesson_blocks', {
        p_lesson: premium, p_expected_version: null,
        p_blocks: [{ type: 'paragraph', props: {}, content: { tg: span('Махфӣ') } }]
      })
    })
    await publishLesson(premium)
    const locked = await as(db, w.reader, (tx) => rpc(tx, 'api_lesson', { p_lesson: premium, p_locale: 'tg' }))
    expect(locked.locked).toBe(true)
    expect(locked.blocks).toEqual([])
    await expectError(as(db, w.reader, (tx) => rpc(tx, 'api_track_progress', { p_lesson: premium, p_percent: 10 })), 'premium_required')

    await as(db, w.admin, (tx) => rpc(tx, 'admin_grant_entitlement', { p_user: w.reader }))
    const open = await as(db, w.reader, (tx) => rpc(tx, 'api_lesson', { p_lesson: premium, p_locale: 'tg' }))
    expect(open.locked).toBe(false)
    expect(open.blocks).toHaveLength(1)
  })

  it('archives a lesson out of the catalog', async () => {
    const temp = await createLesson(w.author, 'Дарси муваққатӣ')
    await as(db, w.author, (tx) => rpc(tx, 'admin_save_lesson_blocks', {
      p_lesson: temp, p_expected_version: null, p_blocks: [{ type: 'divider', props: {}, content: {} }]
    }))
    await publishLesson(temp)
    await as(db, w.admin, (tx) => rpc(tx, 'admin_transition', { p_entity: 'lesson', p_id: temp, p_to: 'archived' }))
    await expectError(as(db, null, (tx) => rpc(tx, 'api_lesson', { p_lesson: temp, p_locale: 'tg' })), 'not_found')
  })
})

describe('learner features', () => {
  it('tracks progress, bookmarks and awards achievements', async () => {
    const learner = await createUser(db, 'learner@example.test')
    const lesson = (await db.query<{ id: string }>(
      "select l.id from public.lessons l join public.lesson_translations t on t.lesson_id = l.id where t.title = 'Ислом ва инсон'")).rows[0].id
    const achievement = await as(db, w.admin, async (tx) => {
      const id = (await tx.query<{ id: string }>(
        `insert into public.achievements (key, rule) values ('first-lesson', '{"type":"lessons_completed","count":1}') returning id`)).rows[0].id
      await tx.query("insert into public.achievement_translations (achievement_id, locale, title, ready) values ($1, 'tg', 'Дарси аввал', true)", [id])
      await rpc(tx, 'admin_transition', { p_entity: 'achievement', p_id: id, p_to: 'published' })
      return id
    })
    const started = await as(db, learner, (tx) => rpc(tx, 'api_track_progress', { p_lesson: lesson, p_percent: 40 }))
    expect(started.status).toBe('started')
    const cont = await as(db, learner, (tx) => rpc(tx, 'api_continue_learning', { p_locale: 'tg' }))
    expect(cont.lesson_id).toBe(lesson)
    const done = await as(db, learner, (tx) => rpc(tx, 'api_track_progress', { p_lesson: lesson, p_completed: true }))
    expect(done).toMatchObject({ status: 'completed', percent: 100, new_achievements: 1 })

    await as(db, learner, (tx) => tx.query('insert into public.bookmarks (user_id, lesson_id) values ($1, $2)', [learner, lesson]))
    const saved = await as(db, learner, (tx) => rpc(tx, 'api_my_bookmarks', { p_locale: 'tg' }))
    expect(saved[0]).toMatchObject({ lesson_id: lesson, title: 'Ислом ва инсон' })

    const progress = await as(db, learner, (tx) => rpc(tx, 'api_my_progress', { p_locale: 'tg' }))
    expect(progress.totals.lessons_completed).toBe(1)
    expect(progress.achievements.find((a: any) => a.id === achievement).awarded_at).toBeTruthy()

    const other = await as(db, w.reader, (tx) => tx.query('select * from public.lesson_progress where user_id = $1', [learner]))
    expect(other.rows).toHaveLength(0)
  })

  it('never attributes a quote to a person without a source', async () => {
    const id = await as(db, w.admin, async (tx) =>
      (await tx.query<{ id: string }>('insert into public.daily_inspirations default values returning id')).rows[0].id)
    await expectError(
      as(db, w.admin, (tx) => tx.query(
        "insert into public.daily_inspiration_translations (inspiration_id, locale, body, author_name, ready) values ($1, 'tg', 'Матн', 'Шахс', true)", [id])),
      'attribution_needs_source')
    await as(db, w.admin, async (tx) => {
      await tx.query(
        "insert into public.daily_inspiration_translations (inspiration_id, locale, body, author_name, source_title, ready) values ($1, 'tg', 'Матни иқтибос', 'Муаллиф', 'Китоб, саҳ. 12', true)", [id])
      await rpc(tx, 'admin_transition', { p_entity: 'inspiration', p_id: id, p_to: 'published' })
    })
    const today = await as(db, null, (tx) => rpc(tx, 'api_inspiration', { p_locale: 'tg' }))
    expect(today).toMatchObject({ body: 'Матни иқтибос', source_title: 'Китоб, саҳ. 12' })
    const words = await as(db, null, (tx) => rpc(tx, 'api_inspirations', { p_locale: 'ru' }))
    expect(words).toEqual([expect.objectContaining({ body: 'Матни иқтибос', author_name: 'Муаллиф' })])
  })

  it('serves CMS-managed UI strings and help texts', async () => {
    const bundle = await as(db, null, (tx) => rpc(tx, 'api_ui_bundle', { p_locale: 'ru' }))
    expect(bundle.strings['nav.home']).toBe('Асосӣ')
    expect(bundle.help['settings.notifications'].body).toBe('Барои гирифтани хабарҳои курсҳо ва ёдрасии дарсҳо.')
  })

  it('publishes scheduled content only when its time comes', async () => {
    const course = await as(db, w.admin, async (tx) => {
      const id = (await tx.query<{ id: string }>("insert into public.courses (school_id, slug) values ($1, 'later') returning id", [w.school])).rows[0].id
      await tx.query("insert into public.course_translations (course_id, locale, title, ready) values ($1, 'tg', 'Баъдтар', true)", [id])
      await rpc(tx, 'admin_transition', { p_entity: 'course', p_id: id, p_to: 'scheduled', p_publish_at: new Date(Date.now() + 3600_000).toISOString() })
      return id
    })
    await expectError(as(db, null, (tx) => rpc(tx, 'api_course', { p_course: course, p_locale: 'tg' })), 'not_found')
    await db.query("update public.courses set publish_at = now() - interval '1 minute' where id = $1", [course])
    const visible = await as(db, null, (tx) => rpc(tx, 'api_course', { p_course: course, p_locale: 'tg' }))
    expect(visible.title).toBe('Баъдтар')
    await db.query('select private.run_scheduled()')
    const { rows } = await db.query<{ status: string }>('select status from public.courses where id = $1', [course])
    expect(rows[0].status).toBe('published')
  })

  it('writes an audit trail for staff changes', async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int n from public.audit_logs where table_name = 'lessons' and actor_id = $1", [w.author])
    expect(rows[0].n).toBeGreaterThan(0)
    const asReader = await as(db, w.reader, (tx) => tx.query('select * from public.audit_logs'))
    expect(asReader.rows).toHaveLength(0)
  })
})
