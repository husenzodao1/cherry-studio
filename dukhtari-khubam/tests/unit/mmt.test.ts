import { describe, expect, it } from 'vitest'

import { ability, answerIndex, chanceOf, expectedShare, nextQuestion, parseCsv, programsFromCsv, questionsFromCsv, rankPrograms, studyPlan, subjectScore } from '@/lib/mmt'

const a = (difficulty: 1 | 2 | 3, right: boolean) => ({ difficulty, right })

describe('the ММТ mock exam arithmetic', () => {
  it('ability: more right and harder right is higher; few answers stay near the middle; no answers is 0', () => {
    expect(ability([])).toBe(0)
    const strong = ability([a(2, true), a(3, true), a(3, true), a(3, false)])
    const weak = ability([a(2, false), a(1, true), a(1, false), a(1, false)])
    expect(strong).toBeGreaterThan(0.5)
    expect(weak).toBeLessThan(-0.5)
    // one right answer is not a perfect score
    expect(expectedShare(ability([a(3, true)]))).toBeLessThan(0.8)
    expect(Math.abs(ability([a(2, true), a(2, false)]))).toBeLessThan(1e-6)
  })

  it('the score of a subject out of its points, rising with ability', () => {
    expect(subjectScore([], 120)).toBe(0)
    const all = Array.from({ length: 20 }, () => a(3, true))
    const none = Array.from({ length: 20 }, () => a(1, false))
    expect(subjectScore(all, 120)).toBeGreaterThan(100)
    expect(subjectScore(none, 120)).toBeLessThan(20)
    expect(subjectScore([a(2, true), a(2, false)], 100)).toBe(Math.round(expectedShare(0) * 1000) / 10)
  })

  it('adaptive: starts in the middle; right → harder, wrong → easier; never repeats', () => {
    const pool = [{ id: 'e', difficulty: 1 as const }, { id: 'm', difficulty: 2 as const }, { id: 'h', difficulty: 3 as const }, { id: 'm2', difficulty: 2 as const }]
    expect(nextQuestion(pool, new Set(), null)?.id).toBe('m')
    expect(nextQuestion(pool, new Set(['m']), a(2, true))?.id).toBe('h')
    expect(nextQuestion(pool, new Set(['m']), a(2, false))?.id).toBe('e')
    expect(nextQuestion(pool, new Set(['m', 'h']), a(3, true))?.id).toBe('m2')
    expect(nextQuestion(pool, new Set(['e', 'm', 'h', 'm2']), null)).toBeNull()
  })

  it('chances against last year\'s passing score (±5% of the whole test is "near")', () => {
    expect(chanceOf(520, 480, 500)).toBe('high')
    expect(chanceOf(470, 480, 500)).toBe('mid')
    expect(chanceOf(440, 480, 500)).toBe('low')
    const ranked = rankPrograms([{ id: '1', min_score: 300 }, { id: '2', min_score: 600 }, { id: '3', min_score: 450 }], 470, 500)
    expect(ranked.map((r) => [r.id, r.chance, r.margin])).toEqual([['1', 'high', 170], ['3', 'mid', 20], ['2', 'low', -130]])
  })

  it('a study plan to the exam: the weakest topics first, more questions in the last week', () => {
    const history = [
      { subject: 'math', topic: 'Логарифм', difficulty: 2 as const, right: false },
      { subject: 'math', topic: 'Логарифм', difficulty: 2 as const, right: false },
      { subject: 'math', topic: 'Касрҳо', difficulty: 1 as const, right: true },
      { subject: 'math', topic: 'Геометрия', difficulty: 2 as const, right: true },
      { subject: 'math', topic: 'Геометрия', difficulty: 3 as const, right: false },
      { subject: 'chem', topic: 'Кислота', difficulty: 2 as const, right: false }
    ]
    const plan = studyPlan(history, ['math'], new Date('2026-11-24T09:00:00'), '2026-12-04')
    expect(plan.daysLeft).toBe(10)
    expect(plan.days).toHaveLength(10)
    expect(plan.days[0].topics.map((t) => t.topic)).toEqual(['Логарифм', 'Геометрия', 'Касрҳо'])
    expect(plan.days[0].questions).toBe(20)
    expect(plan.days[9].questions).toBe(40)
    expect(studyPlan([], ['math'], new Date('2026-11-24'), null)).toMatchObject({ daysLeft: null })
  })

  it('CSV as spreadsheets save it: semicolons, quotes, line breaks inside a cell', () => {
    expect(parseCsv('a;b\n"x; y";"line\none"\n')).toEqual([['a', 'b'], ['x; y', 'line\none']])
    expect(parseCsv('﻿a,b\r\n1,"2 ""q"""')).toEqual([['a', 'b'], ['1', '2 "q"']])
    expect(answerIndex('B', 4)).toBe(1)
    expect(answerIndex('в', 4)).toBe(2)
    expect(answerIndex('4', 4)).toBe(3)
    expect(answerIndex('E', 4)).toBeNull()
  })

  it('questions from the staff\'s table, in Tajik headers; unreadable rows named by line', () => {
    const csv = 'Савол;А;Б;В;Г;Ҷавоб;Шарҳ;Мавзӯъ;Душворӣ\n2+2=?;3;4;5;6;Б;Ду ва ду чор;Ҳисоб;1\nБе ҷавоб;1;2;3;4;Ж;;;\n'
    const r = questionsFromCsv(csv)
    expect(r.rows).toEqual([{ question: '2+2=?', options: ['3', '4', '5', '6'], answer: 1, difficulty: 1, explanation: 'Ду ва ду чор', topic: 'Ҳисоб' }])
    expect(r.bad).toEqual([3])
  })

  it('programmes from the staff\'s table', () => {
    const csv = 'Донишгоҳ,Ихтисос,Кластер,Сол,Шакл,Балл,Ҷойҳо\nДМТ,Информатика,1,2026,буҷа,"512,5",25\nДМТ,Иқтисод,9,2026,,400,\n'
    const r = programsFromCsv(csv)
    expect(r.rows).toEqual([{ university: 'ДМТ', specialty: 'Информатика', cluster: 1, year: 2026, form: 'budget', min_score: 512.5, places: 25 }])
    expect(r.bad).toEqual([3])
  })
})
