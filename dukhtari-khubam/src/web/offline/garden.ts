import type { ProgressData } from '@/lib/progress'

import { ART, SCHOOL_ART, type Art } from '../art'
import type { Bundle } from './content'

/**
 * "Боғи ман" — the learner's garden, laid out as glass shelves: one shelf per school, in the schools'
 * order. Every finished lesson is one glass flower in the school's own flower and tint; every finished
 * course is a large bloom at the front of its shelf. Within a shelf flowers stand in the order earned.
 */

export interface SchoolFlower { art: Art; hue: number }

export const SCHOOL_FLOWER: Record<string, SchoolFlower> = {
  'marifati-dini': { art: ART.lotus, hue: 0 },
  'odob-va-akhloq': { art: ART.tulip, hue: 0 },
  'farhangi-tojik': { art: ART.flowerSide, hue: 320 },
  'oila-va-munosibatho': { art: ART.tulip, hue: 40 },
  'ilm-va-salomati': { art: ART.flower, hue: 200 },
  'rushdi-shakhsiyat': { art: ART.flowerSide, hue: 300 },
  'zindagii-muosir': { art: ART.lotus, hue: 160 }
}
const FALLBACK: SchoolFlower = { art: ART.flower, hue: 0 }

export interface Bloom {
  id: string
  /** the lesson or course this flower stands for */
  title: string
  at: string
  big: boolean
  art: Art
  hue: number
}

export interface Bed {
  school: string
  title: string
  icon?: Art | { src: string }
  blooms: Bloom[]
  lessons: number
  courses: number
}

const courseLessons = (c: Bundle['courses'][string]) =>
  c.modules.flatMap((m) => m.topics.flatMap((t) => t.lessons.filter((x) => !x.locked).map((x) => x.id)))

export function gardenOf(bundle: Bundle | null, progress: ProgressData) {
  const schoolOfCourse = new Map<string, string>()
  for (const [slug, s] of Object.entries(bundle?.schoolDetails ?? {})) for (const c of s.courses) schoolOfCourse.set(c.id, slug)
  for (const c of Object.values(bundle?.courses ?? {})) if (c.school?.slug) schoolOfCourse.set(c.id, c.school.slug)

  const bySchool = new Map<string, { lessons: Bloom[]; courses: Bloom[] }>()
  const shelf = (slug: string) => {
    if (!bySchool.has(slug)) bySchool.set(slug, { lessons: [], courses: [] })
    return bySchool.get(slug)!
  }
  for (const [id, l] of Object.entries(progress.lessons)) {
    if (!l.done) continue
    const lesson = bundle?.lessons[id]
    if (!lesson) continue
    const slug = schoolOfCourse.get(lesson.context.course.id) ?? ''
    const f = SCHOOL_FLOWER[slug] ?? FALLBACK
    shelf(slug).lessons.push({ id, title: lesson.title, at: l.done, big: false, art: f.art, hue: f.hue })
  }
  for (const c of Object.values(bundle?.courses ?? {})) {
    const ids = courseLessons(c)
    if (!ids.length || !ids.every((id) => progress.lessons[id]?.done)) continue
    const slug = schoolOfCourse.get(c.id) ?? ''
    const at = ids.map((id) => progress.lessons[id].done!).sort().at(-1)!
    shelf(slug).courses.push({ id: `course:${c.id}`, title: c.title, at, big: true, art: ART.lotus, hue: (SCHOOL_FLOWER[slug] ?? FALLBACK).hue })
  }

  const order = (bundle?.schools ?? []).map((s) => s.slug)
  const byDate = (a: Bloom, b: Bloom) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)
  const beds: Bed[] = [...bySchool.entries()]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([slug, s]) => {
      const school = bundle?.schools.find((x) => x.slug === slug)
      return {
        school: slug,
        title: school?.title ?? '',
        icon: school?.icon?.url ? { src: school.icon.url } : SCHOOL_ART[slug],
        blooms: [...s.courses.sort(byDate), ...s.lessons.sort(byDate)],
        lessons: s.lessons.length,
        courses: s.courses.length
      }
    })
  return { beds, flowers: beds.reduce((n, b) => n + b.lessons, 0), courses: beds.reduce((n, b) => n + b.courses, 0) }
}
