import type { ProgressData } from '@/lib/progress'

import { ART, type Art } from '../art'
import type { Bundle } from './content'

/**
 * "Боғи ман" — the learner's garden. Every finished lesson grows a glass flower; each school has its
 * own flower and glass tint; a finished course grows a large golden-lit bloom. Flowers are placed in
 * the order they were earned (oldest at the back) on a jittered grid, so the garden is stable between
 * visits and new flowers appear at the front.
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
  /** lesson or course this flower stands for */
  title: string
  school: string
  at: string
  big: boolean
  art: Art
  hue: number
  /** position in the scene: x across (0–100 %), depth 0 (back) … 1 (front) */
  x: number
  depth: number
  tilt: number
}

/** Small stable hash, so a flower keeps its place and lean between visits. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

export const COLUMNS = 5

export function gardenOf(bundle: Bundle | null, progress: ProgressData) {
  const schoolOfCourse = new Map<string, string>()
  for (const [slug, s] of Object.entries(bundle?.schoolDetails ?? {})) for (const c of s.courses) schoolOfCourse.set(c.id, slug)
  for (const c of Object.values(bundle?.courses ?? {})) if (c.school?.slug) schoolOfCourse.set(c.id, c.school.slug)

  const items: Omit<Bloom, 'x' | 'depth' | 'tilt'>[] = []
  for (const [id, l] of Object.entries(progress.lessons)) {
    if (!l.done) continue
    const lesson = bundle?.lessons[id]
    if (!lesson) continue
    const school = schoolOfCourse.get(lesson.context.course.id) ?? ''
    const f = SCHOOL_FLOWER[school] ?? FALLBACK
    items.push({ id, title: lesson.title, school, at: l.done, big: false, art: f.art, hue: f.hue })
  }
  // a finished course: one large bloom, dated by its last lesson
  for (const c of Object.values(bundle?.courses ?? {})) {
    const ids = c.modules.flatMap((m) => m.topics.flatMap((t) => t.lessons.filter((x) => !x.locked).map((x) => x.id)))
    if (!ids.length || !ids.every((id) => progress.lessons[id]?.done)) continue
    const at = ids.map((id) => progress.lessons[id].done!).sort().at(-1)!
    const school = schoolOfCourse.get(c.id) ?? ''
    items.push({ id: `course:${c.id}`, title: c.title, school, at, big: true, art: ART.lotus, hue: (SCHOOL_FLOWER[school] ?? FALLBACK).hue })
  }
  items.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))

  const rows = Math.max(1, Math.ceil(items.length / COLUMNS))
  const blooms: Bloom[] = items.map((it, i) => {
    const row = Math.floor(i / COLUMNS)
    const col = i % COLUMNS
    const r = hash(it.id)
    const offset = row % 2 ? 0.5 : 0
    const x = ((col + 0.5 + offset * 0.6 + (r - 0.5) * 0.5) / (COLUMNS + 0.3)) * 100
    const depth = rows === 1 ? 0.75 : row / (rows - 1)
    return { ...it, x: Math.min(94, Math.max(6, x)), depth, tilt: (hash(it.id + 't') - 0.5) * 16 }
  })

  const bySchool: Record<string, number> = {}
  for (const b of blooms) if (!b.big) bySchool[b.school] = (bySchool[b.school] ?? 0) + 1
  return { blooms, rows, bySchool, flowers: blooms.filter((b) => !b.big).length, courses: blooms.filter((b) => b.big).length }
}
