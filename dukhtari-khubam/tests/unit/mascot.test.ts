import { describe, expect, it } from 'vitest'

import { afterQuiz, duringQuiz, greeting, type Memory, nextSaying, POSES, sayingsFor, withName } from '@/lib/mascot'

describe('mascot sayings', () => {
  it('never shows the same saying twice in a row, and shows all before repeating', () => {
    let memory: Memory = { bags: {}, last: {} }
    const seen: number[] = []
    for (let i = 0; i < 50; i++) {
      const r = nextSaying('stop', 5, memory)
      memory = r.memory
      seen.push(r.index)
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
    for (let i = 0; i + 5 <= 50; i += 5) expect(new Set(seen.slice(i, i + 5)).size).toBe(5)
  })

  it('every moment has sayings in every language and a picture', () => {
    for (const locale of ['tg', 'ru', 'en', 'uz', 'tr', 'fa', 'prs']) {
      const s = sayingsFor(locale)
      for (const m of Object.keys(POSES) as (keyof typeof POSES)[]) {
        expect(s[m].length, `${locale} ${m}`).toBeGreaterThan(1)
        expect(POSES[m].length).toBeGreaterThan(0)
      }
    }
    expect(sayingsFor('tg').stop[0]).toBe('Истед, шумо пайдарпай хато мекунед. Каме оромтар хонед.')
  })

  it('puts the name in, or tidies the words when there is none', () => {
    expect(withName('{name}, рӯзи нав — дониши нав.', 'Мадина')).toBe('Мадина, рӯзи нав — дониши нав.')
    expect(withName('{name}, рӯзи нав — дониши нав.', '')).toBe('Рӯзи нав — дониши нав.')
    expect(withName('Салом, {name}! Шуморо пазмон шудем.', null)).toBe('Салом! Шуморо пазмон шудем.')
  })

  it('greets on every opening, and welcomes back after three days away', () => {
    expect(greeting('2026-11-20', '2026-11-20')).toBe('entry')
    expect(greeting('2026-11-20', null)).toBe('entry')
    expect(greeting('2026-11-20', '2026-11-19')).toBe('entry')
    expect(greeting('2026-11-20', '2026-11-17')).toBe('comeback')
  })

  it('reacts to answers in a row only once per run', () => {
    expect(duringQuiz([false])).toBeNull()
    expect(duringQuiz([true, false, false])).toBe('stop')
    expect(duringQuiz([false, false, false])).toBeNull()
    expect(duringQuiz([true, true, true])).toBe('praise')
    expect(duringQuiz([true, true, true, true])).toBeNull()
    expect(afterQuiz(100, true)).toBe('perfect')
    expect(afterQuiz(80, true)).toBe('passed')
    expect(afterQuiz(30, false)).toBe('failed')
  })
})
