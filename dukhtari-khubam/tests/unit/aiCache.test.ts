import { describe, expect, it } from 'vitest'

import { answerKey, normalQuestion, storable } from '@/server/aiCache'

const one = (content: string) => [{ role: 'user', content }]

describe("Mahliyo's memory: general answers kept for everyone, nothing personal", () => {
  it('a conversation\'s first general question has a key; Tajik letters and punctuation do not matter', () => {
    const a = answerKey(one('Фотосинтез чист?'), 0, { lang: 'tg' })
    expect(a).toBe(answerKey(one('фотосинтез чист'), 0, { lang: 'tg' }))
    expect(normalQuestion('Ҳуҷайра чӣ аст?!')).toBe('худжайра чи аст'.replace('дж', 'ч'))
    // the mode and a boy's answer are kept apart
    expect(answerKey(one('Фотосинтез чист?'), 0, { lang: 'tg', gender: 'boy' })).not.toBe(a)
  })

  it('never: about her, about now, a later question, pictures, the study chat', () => {
    expect(answerKey(one('Номи ман чист?'), 0, { lang: 'tg' })).toBeNull()
    expect(answerKey(one('Напомни мне про урок'), 0, { lang: 'ru' })).toBeNull()
    expect(answerKey(one('Хабарҳои имрӯз'), 0, { lang: 'tg' })).toBeNull()
    expect(answerKey(one('Курс доллара'), 0, { lang: 'ru' })).toBeNull()
    expect(answerKey([...one('Салом'), { role: 'assistant', content: 'Салом!' }, ...one('Фотосинтез чист?')], 0, { lang: 'tg' })).toBeNull()
    expect(answerKey(one('Ин расм чист?'), 1, { lang: 'tg' })).toBeNull()
    expect(answerKey(one('Фотосинтез чист?'), 0, { lang: 'tg', study: { task: 'explain' } })).toBeNull()
  })

  it('kept with her name as {ном}; an answer with a reminder, a file or a song is not kept', () => {
    const a = { tajik: true, reply: 'Малика, фотосинтез…', blocks: [{ type: 'text' as const, text: 'Малика, фотосинтез — раванди…' }] }
    expect(storable(a, 'Малика')?.blocks[0]).toEqual({ type: 'text', text: '{ном}, фотосинтез — раванди…' })
    // her name in another form: not kept at all (never given to someone else)
    expect(storable({ ...a, blocks: [{ type: 'text', text: 'Маликаи азиз' }] }, 'Малика')).toBeNull()
    expect(storable({ ...a, blocks: [{ type: 'text', text: 'Хуб' }, { type: 'reminder', at: '2026-11-25T10:00:00+05:00', title: 'x', text: 'y' }] }, '')).toBeNull()
    expect(storable({ ...a, blocks: [{ type: 'play', query: 'Ватан', title: 'Ватан' }] }, '')).toBeNull()
  })
})
