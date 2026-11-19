import { describe, expect, it } from 'vitest'

import { emptyProgress, mergeProgress, ProgressData } from '@/lib/progress'
import { lines, variant } from '@/web/offline/notify'

describe('notification texts from the panel', () => {
  const vars = { name: 'Малика', lesson: 'Одоби сухан', streak: 5 }
  it('takes one variant per line and fills its placeholders', () => {
    const list = lines(' Мо шуморо интизорем, {name} 💜 \n\n«{lesson}» нимтамом мондааст\n{streak} рӯз пай дар пай ')
    expect(list).toHaveLength(3)
    expect(variant(list, 0, vars)).toBe('Мо шуморо интизорем, Малика 💜')
    expect(variant(list, 1, vars)).toBe('«Одоби сухан» нимтамом мондааст')
    expect(variant(list, 5, vars)).toBe('5 рӯз пай дар пай')
    expect(variant(list, -1, vars)).toBe('5 рӯз пай дар пай')
  })
  it('tidies a line whose name is empty', () => {
    expect(variant(['Мо шуморо интизорем, {name}!'], 0, { ...vars, name: '' })).toBe('Мо шуморо интизорем!')
  })
})

describe('welcome answers in the progress backup', () => {
  it('are kept, validated and merged by their time', () => {
    const a = { ...emptyProgress(), about: { time: '1 соат', at: '2026-11-21T10:00:00Z' } }
    const b = { ...emptyProgress(), about: { time: '2 соат', schools: ['odob-va-akhloq'], at: '2026-11-21T11:00:00Z' } }
    expect(mergeProgress(a, b).about?.time).toBe('2 соат')
    expect(mergeProgress(b, a)).toEqual(mergeProgress(a, b))
    expect(ProgressData.safeParse({ ...b, about: { ...b.about, extra: 1 } }).success).toBe(false)
  })
})

describe('birthday', () => {
  it('reads dd.mm.yyyy, puts the dots in and rejects impossible dates', async () => {
    const { birthdayMask, parseBirthday } = await import('@/lib/progress')
    const today = new Date(2026, 10, 19)
    expect(birthdayMask('01032008')).toBe('01.03.2008')
    expect(birthdayMask('0103')).toBe('01.03')
    expect(birthdayMask('01.0')).toBe('01.0')
    expect(parseBirthday('01.03.2008', today)).toBe('2008-03-01')
    expect(parseBirthday('31.02.2008', today)).toBeNull()
    expect(parseBirthday('01.03.2024', today)).toBeNull()
    expect(parseBirthday('1.3.2008', today)).toBeNull()
  })
  it('greets at 00:01 on the next birthday', async () => {
    const { nextBirthday } = await import('@/web/offline/notify')
    const now = new Date(2026, 10, 19, 12, 0)
    expect(nextBirthday('2008-11-20', now)).toEqual(new Date(2026, 10, 20, 0, 1))
    expect(nextBirthday('2008-03-01', now)).toEqual(new Date(2027, 2, 1, 0, 1))
    expect(nextBirthday('2008-11-19', new Date(2026, 10, 19, 0, 0, 30))).toEqual(new Date(2026, 10, 19, 0, 1))
  })
  it('is kept in the backup', () => {
    const a = { ...emptyProgress(), birthday: '2008-03-01', born: 2008 }
    expect(mergeProgress(emptyProgress(), a).birthday).toBe('2008-03-01')
    expect(ProgressData.safeParse({ ...a, birthday: '1.3.2008' }).success).toBe(false)
  })
})
