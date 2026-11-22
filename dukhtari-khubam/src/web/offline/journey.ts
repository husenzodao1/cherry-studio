import type { ProgressData } from '@/lib/progress'
import { lessonTest } from '@/lib/stage'

import { SCHOOL_ART, type Art } from '../art'
import type { Bundle } from './content'

/**
 * "Харитаи пешравӣ" — the learner's progress map: every course she has begun, in the schools' order,
 * its lessons in their order as stops on one winding road. A finished lesson shows how she did in its
 * test: green "олӣ" (80% or more), yellow "миёна" (50–79%), red "бад" (below 50%); finished with no
 * test, green. The first lesson not yet finished is the next stop; the rest wait.
 */

export type Grade = 'good' | 'fair' | 'weak'
export const gradeOf = (score: number | null): Grade => (score === null || score >= 80 ? 'good' : score >= 50 ? 'fair' : 'weak')

export interface Stop {
  id: string
  title: string
  /** how she did, once the lesson is finished */
  grade: Grade | null
  /** her best score in the lesson's test (0–100), if she took it */
  score: number | null
  next: boolean
}

export interface Leg {
  course: string
  title: string
  school: string
  icon?: Art | { src: string }
  stops: Stop[]
  done: number
}

const courseLessons = (c: Bundle['courses'][string]) =>
  c.modules.flatMap((m) => m.topics.flatMap((t) => t.lessons.filter((x) => !x.locked).map((x) => x.id)))

export function journeyOf(bundle: Bundle | null, progress: ProgressData) {
  const legs: Leg[] = []
  if (!bundle) return { legs, counts: { good: 0, fair: 0, weak: 0 } as Record<Grade, number> }
  const order = [...bundle.schools.map((s) => s.slug), ...Object.keys(bundle.schoolDetails)]
  const seen = new Set<string>()
  for (const slug of order) {
    if (seen.has(slug)) continue
    seen.add(slug)
    const school = bundle.schools.find((s) => s.slug === slug)
    for (const { id } of bundle.schoolDetails[slug]?.courses ?? []) {
      const course = bundle.courses[id]
      if (!course) continue
      const ids = courseLessons(course).filter((l) => bundle.lessons[l])
      // only the courses she has begun
      if (!ids.some((l) => progress.lessons[l])) continue
      let nextGiven = false
      const stops = ids.map((l): Stop => {
        const quiz = lessonTest(bundle, l)
        const score = quiz ? progress.quizzes[quiz]?.best ?? null : null
        const done = !!progress.lessons[l]?.done
        const next = !done && !nextGiven
        if (next) nextGiven = true
        return { id: l, title: bundle.lessons[l].title, grade: done ? gradeOf(score) : null, score, next }
      })
      legs.push({
        course: id, title: course.title, school: slug,
        icon: school?.icon?.url ? { src: school.icon.url } : SCHOOL_ART[slug],
        stops, done: stops.filter((s) => s.grade).length
      })
    }
  }
  const counts: Record<Grade, number> = { good: 0, fair: 0, weak: 0 }
  for (const s of legs.flatMap((l) => l.stops)) if (s.grade) counts[s.grade]++
  return { legs, counts }
}
