import { describe, expect, it } from 'vitest'

import { ageAllows, filterBundleForAge, readAgeTag } from '@/web/offline/age'
import type { Bundle } from '@/web/offline/content'

describe('age tag', () => {
  it('reads the limit and strips the tag in both closing forms', () => {
    expect(readAgeTag('<синну сол>барои 16 солаҳо</синну сол> Мавзӯъ')).toEqual({ max: 16, text: 'Мавзӯъ' })
    expect(readAgeTag('<синну сол> барои 16 солаҳо<синну сол/>Матн')).toEqual({ max: 16, text: 'Матн' })
    expect(readAgeTag('  <Синну Сол>12</синну сол>  x')).toEqual({ max: 12, text: 'x' })
    expect(readAgeTag('Бе барчасп')).toEqual({ max: null, text: 'Бе барчасп' })
  })

  it('shows tagged content to that age or younger', () => {
    expect(ageAllows(16, 16)).toBe(true)
    expect(ageAllows(16, 14)).toBe(true)
    expect(ageAllows(16, 17)).toBe(false)
    expect(ageAllows(16, null)).toBe(false)
    expect(ageAllows(null, 40)).toBe(true)
  })
})

describe('catalogue filtered by age', () => {
  const rich = (text: string) => ({ spans: [{ text }] })
  const bundle = {
    v: 1, locale: 'tg', version: 'x', generated_at: '',
    schools: [{ id: 's', slug: 'school', title: 'Мактаб', course_count: 1 }],
    schoolDetails: { school: { id: 's', slug: 'school', title: 'Мактаб', course_count: 1, courses: [{ id: 'c', title: 'Курс', locked: false, module_count: 1 }], quizzes: [] } },
    courses: {
      c: {
        id: 'c', title: 'Курс', goals: [], locked: false, prerequisites: [], quizzes: [],
        modules: [{ id: 'm', title: 'Модул', quizzes: [], topics: [
          { id: 't1', title: 'Мавзӯи умумӣ', quizzes: [], lessons: [{ id: 'l1', title: 'Дарси 1', locked: false }] },
          { id: 't2', title: '<синну сол>барои 16 солаҳо</синну сол>Мавзӯи наврасон', quizzes: [], lessons: [{ id: 'l2', title: 'Дарси 2', locked: false }] }
        ] }]
      }
    },
    lessons: {
      l1: {
        id: 'l1', title: 'Дарси 1', locked: false, locale: 'tg', context: { school: { title: 'Мактаб' }, course: { id: 'c', title: 'Курс' } },
        blocks: [
          { id: 'b1', type: 'paragraph', props: {}, content: rich('Барои ҳама') },
          { id: 'b2', type: 'paragraph', props: {}, content: rich('<синну сол>16</синну сол>Барои наврасон') }
        ],
        assets: {}, position: { index: 1, total: 2 }, prev_lesson_id: null, next_lesson_id: 'l2'
      },
      l2: {
        id: 'l2', title: 'Дарси 2', locked: false, locale: 'tg', context: { school: { title: 'Мактаб' }, course: { id: 'c', title: 'Курс' } },
        blocks: [], assets: {}, position: { index: 2, total: 2 }, prev_lesson_id: 'l1', next_lesson_id: null
      }
    },
    quizzes: {}, pages: {}, ui: {}, inspiration: null, achievements: []
  } as unknown as Bundle

  it('keeps tagged topics, lessons and blocks for younger learners, without the tag', () => {
    const b = filterBundleForAge(bundle, 15)
    const topics = b.courses.c.modules[0].topics
    expect(topics.map((t) => t.title)).toEqual(['Мавзӯи умумӣ', 'Мавзӯи наврасон'])
    expect(Object.keys(b.lessons)).toEqual(['l1', 'l2'])
    expect((b.lessons.l1.blocks[1].content as { spans: { text: string }[] }).spans[0].text).toBe('Барои наврасон')
  })

  it('hides them from older learners and unlinks hidden lessons', () => {
    const b = filterBundleForAge(bundle, 30)
    expect(b.courses.c.modules[0].topics.map((t) => t.id)).toEqual(['t1'])
    expect(Object.keys(b.lessons)).toEqual(['l1'])
    expect(b.lessons.l1.blocks.map((x) => x.id)).toEqual(['b1'])
    expect(b.lessons.l1.next_lesson_id).toBeNull()
    // the original catalogue is left untouched
    expect((bundle.lessons.l1.blocks[1].content as { spans: { text: string }[] }).spans[0].text).toContain('синну')
  })
})
