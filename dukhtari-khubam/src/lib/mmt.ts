/**
 * The ММТ mock exam's arithmetic, kept apart so it can be tested:
 *   - an adaptive order: a right answer brings a harder question, a wrong one an easier one;
 *   - her ability in a subject (a Rasch model: easy, middle and hard questions at -1, 0 and +1, a gentle prior
 *     so a few answers do not jump to the ends), and the score that ability would earn on a whole test;
 *   - her chances for each programme against last year's passing score;
 *   - a study plan up to the exam's day, weakest topics first;
 *   - the staff's question and programme tables (CSV, as spreadsheets save them) read into rows.
 * These are estimates from her practice, never the official ММТ result — the app says so.
 */

export interface MmtQuestion { id: string; subject: string; topic: string | null; difficulty: 1 | 2 | 3; question: string; options: string[]; answer: number; explanation: string | null; source: string | null }
export interface MmtSubject { id: string; name: string; clusters: number[]; max_points: number; questions: number }
export interface MmtProgram { id: string; university: string; specialty: string; code: string | null; year: number; form: 'budget' | 'contract' | 'quota'; min_score: number; places: number | null; city: string | null }
export interface Answered { subject: string; topic: string | null; difficulty: 1 | 2 | 3; right: boolean }

/** an item's difficulty on the ability scale */
const B: Record<1 | 2 | 3, number> = { 1: -1, 2: 0, 3: 1 }
const p = (theta: number, b: number) => 1 / (1 + Math.exp(b - theta))

/** her ability from her answers (the most likely, with a standard normal prior); 0 when she answered nothing */
export function ability(answers: Pick<Answered, 'difficulty' | 'right'>[]): number {
  let theta = 0
  for (let i = 0; i < 30; i++) {
    let grad = -theta
    let hess = -1
    for (const a of answers) {
      const pr = p(theta, B[a.difficulty])
      grad += (a.right ? 1 : 0) - pr
      hess -= pr * (1 - pr)
    }
    const step = grad / hess
    theta -= step
    if (Math.abs(step) < 1e-6) break
  }
  return Math.max(-4, Math.min(4, theta))
}

/** the share of a whole test (easy, middle and hard alike) she would answer right with this ability */
export const expectedShare = (theta: number) => (p(theta, -1) + p(theta, 0) + p(theta, 1)) / 3

/** her estimated score in a subject (out of its points) */
export function subjectScore(answers: Pick<Answered, 'difficulty' | 'right'>[], maxPoints: number): number {
  if (!answers.length) return 0
  return Math.round(expectedShare(ability(answers)) * maxPoints * 10) / 10
}

/** The next question: the unasked one nearest the difficulty her last answer points to. */
export function nextQuestion<T extends { id: string; difficulty: 1 | 2 | 3 }>(pool: T[], asked: Set<string>, last: { difficulty: 1 | 2 | 3; right: boolean } | null): T | null {
  const want = !last ? 2 : Math.max(1, Math.min(3, last.difficulty + (last.right ? 1 : -1)))
  const left = pool.filter((q) => !asked.has(q.id))
  if (!left.length) return null
  return left.reduce((best, q) => (Math.abs(q.difficulty - want) < Math.abs(best.difficulty - want) ? q : best), left[0])
}

export type Chance = 'high' | 'mid' | 'low'
/** her chance for a programme: comfortably over last year's score, near it (±5% of the whole test), or under */
export function chanceOf(predicted: number, minScore: number, totalMax: number): Chance {
  const margin = predicted - minScore
  const band = totalMax * 0.05
  return margin >= band ? 'high' : margin >= -band ? 'mid' : 'low'
}

/** the programmes ranked for her: best chances first, then the highest passing score */
export function rankPrograms<T extends Pick<MmtProgram, 'min_score'>>(programs: T[], predicted: number, totalMax: number): (T & { chance: Chance; margin: number })[] {
  const order: Record<Chance, number> = { high: 0, mid: 1, low: 2 }
  return programs
    .map((pg) => ({ ...pg, chance: chanceOf(predicted, Number(pg.min_score), totalMax), margin: Math.round((predicted - Number(pg.min_score)) * 10) / 10 }))
    .sort((a, b) => order[a.chance] - order[b.chance] || Number(b.min_score) - Number(a.min_score))
}

export interface PlanDay { day: number; date: string; topics: { subject: string; topic: string }[]; questions: number }
/**
 * A plan up to the exam: her topics from the weakest (fewest right) to the strongest, three a day in turn, and
 * a number of practice questions a day (more as the day comes near). At most 60 days are written out.
 */
export function studyPlan(history: Answered[], subjects: string[], today: Date, examDate: string | null): { daysLeft: number | null; days: PlanDay[] } {
  const exam = examDate ? new Date(`${examDate}T00:00:00`) : null
  const daysLeft = exam ? Math.max(0, Math.ceil((exam.getTime() - new Date(today.toDateString()).getTime()) / 86_400_000)) : null
  const stats = new Map<string, { subject: string; topic: string; right: number; all: number }>()
  for (const a of history) {
    if (!subjects.includes(a.subject)) continue
    const topic = a.topic || '—'
    const key = `${a.subject}|${topic}`
    const s = stats.get(key) ?? { subject: a.subject, topic, right: 0, all: 0 }
    s.all += 1
    if (a.right) s.right += 1
    stats.set(key, s)
  }
  // a topic never tried counts as weak as one always missed
  const topics = [...stats.values()].sort((a, b) => a.right / a.all - b.right / b.all || b.all - a.all)
  const count = Math.min(daysLeft ?? 14, 60)
  const days: PlanDay[] = []
  for (let d = 0; d < count; d++) {
    const date = new Date(today.getTime() + d * 86_400_000)
    const picked = topics.length ? [0, 1, 2].map((k) => topics[(d * 3 + k) % topics.length]).filter((t, i, all) => all.indexOf(t) === i) : []
    const near = daysLeft !== null && daysLeft - d <= 7
    days.push({ day: d + 1, date: date.toISOString().slice(0, 10), topics: picked.map((t) => ({ subject: t.subject, topic: t.topic })), questions: near ? 40 : 20 })
  }
  return { daysLeft, days }
}

// ---------------------------------------------------------------- the staff's tables

/** CSV as spreadsheets save it: commas or semicolons, quotes around a cell with either or a line break */
export function parseCsv(text: string): string[][] {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const first = lines.split('\n', 1)[0]
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : (first.includes('\t') ? '\t' : ',')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i]
    if (quoted) {
      if (c === '"' && lines[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === sep) { row.push(cell.trim()); cell = '' }
    else if (c === '\n') { row.push(cell.trim()); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row) }
  return rows.filter((r) => r.some((x) => x !== ''))
}

const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f']
const CYR = ['а', 'б', 'в', 'г', 'д', 'е']
/** "B", "б", "2" → 1 (the right option counted from 0); null when it is none of the options */
export function answerIndex(v: string, options: number): number | null {
  const s = v.trim().toLowerCase()
  const i = /^\d+$/.test(s) ? Number(s) - 1 : LETTERS.includes(s) ? LETTERS.indexOf(s) : CYR.includes(s) ? CYR.indexOf(s) : -1
  return i >= 0 && i < options ? i : null
}

export interface QuestionRow { question: string; options: string[]; answer: number; explanation?: string; topic?: string; difficulty: 1 | 2 | 3; source?: string }
/**
 * Questions from a table with a header row. Columns (in any order, Tajik, Russian or English names):
 * question, A, B, C, D (E, F), answer, explanation, topic, difficulty, source. Rows it cannot read are returned
 * with their line number, so the staff see what to fix.
 */
export function questionsFromCsv(text: string): { rows: QuestionRow[]; bad: number[] } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], bad: [] }
  const head = table[0].map((h) => h.toLowerCase().replace(/[^a-zа-яёӣӯқҳҷғ]/g, ''))
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h))
  const qi = col('question', 'савол', 'вопрос')
  const ai = col('answer', 'ҷавоб', 'ответ', 'дуруст', 'правильный')
  const ei = col('explanation', 'шарҳ', 'объяснение', 'пояснение')
  const ti = col('topic', 'мавзӯъ', 'тема')
  const di = col('difficulty', 'душворӣ', 'сложность', 'дараҷа')
  const si = col('source', 'манбаъ', 'источник')
  const oi = head.map((h, i) => (/^(a|b|c|d|e|f|а|б|в|г|д|е)$/.test(h) ? i : -1)).filter((i) => i >= 0)
  const rows: QuestionRow[] = []
  const bad: number[] = []
  table.slice(1).forEach((r, n) => {
    const options = oi.map((i) => r[i] ?? '').filter(Boolean)
    const answer = ai >= 0 ? answerIndex(r[ai] ?? '', options.length) : null
    const question = (r[qi] ?? '').trim()
    const d = Number(r[di])
    if (qi < 0 || question.length < 3 || options.length < 2 || answer === null) { bad.push(n + 2); return }
    rows.push({
      question, options, answer, difficulty: d === 1 || d === 3 ? d : 2,
      ...(ei >= 0 && r[ei] ? { explanation: r[ei] } : {}), ...(ti >= 0 && r[ti] ? { topic: r[ti] } : {}), ...(si >= 0 && r[si] ? { source: r[si] } : {})
    })
  })
  return { rows, bad }
}

export interface ProgramRow { university: string; specialty: string; code?: string; cluster: number; year: number; form: 'budget' | 'contract' | 'quota'; min_score: number; places?: number; city?: string }
/** Programmes from a table: university, specialty, code, cluster, year, form, min_score, places, city. */
export function programsFromCsv(text: string): { rows: ProgramRow[]; bad: number[] } {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], bad: [] }
  const head = table[0].map((h) => h.toLowerCase().replace(/[^a-zа-яёӣӯқҳҷғ_]/g, ''))
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h))
  const c = {
    university: col('university', 'донишгоҳ', 'вуз', 'университет'), specialty: col('specialty', 'ихтисос', 'специальность'), code: col('code', 'рамз', 'код'),
    cluster: col('cluster', 'кластер'), year: col('year', 'сол', 'год'), form: col('form', 'шакл', 'форма'),
    min: col('min_score', 'minscore', 'балл', 'холи_гузариш', 'холигузариш', 'проходной', 'проходнойбалл'), places: col('places', 'ҷой', 'ҷойҳо', 'места'), city: col('city', 'шаҳр', 'город')
  }
  const FORMS: Record<string, ProgramRow['form']> = { budget: 'budget', буҷа: 'budget', буҷет: 'budget', бюджет: 'budget', ройгон: 'budget', contract: 'contract', шартнома: 'contract', контракт: 'contract', quota: 'quota', квота: 'quota' }
  const rows: ProgramRow[] = []
  const bad: number[] = []
  table.slice(1).forEach((r, n) => {
    const num = (i: number) => Number(String(r[i] ?? '').replace(',', '.'))
    const cluster = num(c.cluster), year = num(c.year), min = num(c.min)
    const form = FORMS[(r[c.form] ?? '').toLowerCase().trim()] ?? 'budget'
    if (!r[c.university] || !r[c.specialty] || !(cluster >= 1 && cluster <= 5) || !(year >= 2000 && year <= 2100) || !(min >= 0)) { bad.push(n + 2); return }
    rows.push({
      university: r[c.university], specialty: r[c.specialty], cluster, year, form, min_score: min,
      ...(c.code >= 0 && r[c.code] ? { code: r[c.code] } : {}), ...(c.places >= 0 && r[c.places] ? { places: num(c.places) } : {}), ...(c.city >= 0 && r[c.city] ? { city: r[c.city] } : {})
    })
  })
  return { rows, bad }
}
