import type { Bundle, Course, Lesson } from './content'

/**
 * Age-limited content. A title or a text block that begins with an age tag, e.g.
 *   <синну сол>барои 16 солаҳо</синну сол>   (also written <синну сол/> at the end)
 * is shown only to learners of that age or younger. The tag itself is never shown.
 * This shapes what the app displays; it is not access control (the published catalogue is public).
 */

const TAG = /^\s*<\s*синну\s+сол\s*>([\s\S]*?)<\s*\/?\s*синну\s+сол\s*\/?\s*>\s*/iu

export function readAgeTag(text: string): { max: number | null; text: string } {
  const m = TAG.exec(text)
  if (!m) return { max: null, text }
  const n = m[1].match(/\d{1,3}/)
  return { max: n ? Number(n[0]) : null, text: text.slice(m[0].length) }
}

/** Untagged content is for everyone; tagged content needs a known age not above the limit. */
export const ageAllows = (max: number | null, age: number | null) => max === null || (age !== null && age <= max)

function title<T extends { title: string }>(item: T, age: number | null): T | null {
  const { max, text } = readAgeTag(item.title)
  if (!ageAllows(max, age)) return null
  return max === null && text === item.title ? item : { ...item, title: text }
}
const titles = <T extends { title: string }>(list: T[], age: number | null) => list.map((x) => title(x, age)).filter((x): x is T => x !== null)

/** The first piece of text in a block's content (where an age tag would be written). */
function firstText(value: unknown): { holder: Record<string, unknown>; key: string } | null {
  if (Array.isArray(value)) {
    for (const v of value) { const r = firstText(v); if (r) return r }
    return null
  }
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.text === 'string') return { holder: o, key: 'text' }
    if (typeof o.title === 'string') return { holder: o, key: 'title' }
    for (const v of Object.values(o)) { const r = firstText(v); if (r) return r }
  }
  return null
}

function gateBlocks(lesson: Lesson, age: number | null): Lesson {
  let changed = false
  const blocks = lesson.blocks.flatMap((b) => {
    const content = structuredClone(b.content)
    const spot = firstText(content)
    if (!spot) return [b]
    const { max, text } = readAgeTag(String(spot.holder[spot.key]))
    if (max === null && text === spot.holder[spot.key]) return [b]
    changed = true
    if (!ageAllows(max, age)) return []
    spot.holder[spot.key] = text
    return [{ ...b, content }]
  })
  return changed ? { ...lesson, blocks } : lesson
}

/** The catalogue as this learner should see it. */
export function filterBundleForAge(bundle: Bundle, age: number | null): Bundle {
  const courses: Record<string, Course> = {}
  const visibleLessons = new Set<string>()
  for (const [id, c] of Object.entries(bundle.courses)) {
    const ct = title(c, age)
    if (!ct) continue
    const modules = titles(ct.modules, age).map((m) => ({
      ...m,
      quizzes: titles(m.quizzes, age),
      topics: titles(m.topics, age).map((tp) => ({ ...tp, quizzes: titles(tp.quizzes, age), lessons: titles(tp.lessons, age) }))
    }))
    for (const m of modules) for (const tp of m.topics) for (const l of tp.lessons) visibleLessons.add(l.id)
    courses[id] = { ...ct, modules, quizzes: titles(ct.quizzes, age) }
  }
  const lessons: Record<string, Lesson> = {}
  for (const [id, l] of Object.entries(bundle.lessons)) {
    if (!visibleLessons.has(id)) continue
    const lt = title(l, age)
    if (!lt) continue
    const gated = gateBlocks(lt, age)
    lessons[id] = {
      ...gated,
      prev_lesson_id: gated.prev_lesson_id && visibleLessons.has(gated.prev_lesson_id) ? gated.prev_lesson_id : null,
      next_lesson_id: gated.next_lesson_id && visibleLessons.has(gated.next_lesson_id) ? gated.next_lesson_id : null
    }
  }
  const schoolDetails: Bundle['schoolDetails'] = {}
  for (const [key, s] of Object.entries(bundle.schoolDetails)) {
    schoolDetails[key] = { ...s, courses: titles(s.courses, age).filter((c) => courses[c.id] || !bundle.courses[c.id]), quizzes: titles(s.quizzes, age) }
  }
  const quizzes: Bundle['quizzes'] = {}
  for (const [id, q] of Object.entries(bundle.quizzes)) {
    const { max, text } = readAgeTag(q.quiz.title)
    if (ageAllows(max, age)) quizzes[id] = max === null ? q : { ...q, quiz: { ...q.quiz, title: text } }
  }
  const schools = bundle.schools.map((s) => ({ ...s, course_count: schoolDetails[s.slug]?.courses.length ?? s.course_count }))
  return { ...bundle, schools, schoolDetails, courses, lessons, quizzes }
}
