import { describe, expect, it } from 'vitest'

import { commandOf, durationOf, withoutName } from '@/lib/voiceCommands'

describe('"Эй Маҳлиё": what she said, as what to do', () => {
  it('takes her name off the front, as the Tajik speech model writes it', () => {
    expect(withoutName('эй маҳлиё соат чанд')).toBe('соат чанд')
    expect(withoutName('Маҳлиё, обу ҳаво чӣ гуна?')).toBe('обу ҳаво чӣ гуна')
    expect(withoutName('ҳей махлиё таймер')).toBe('таймер')
  })

  it('reads durations said in words: Tajik (with "-у" joining and "ним"), Russian, English, digits', () => {
    expect(durationOf('панҷ дақиқа')).toBe(300)
    expect(durationOf('бисту панҷ дақиқа')).toBe(1500)
    expect(durationOf('як соату даҳ дақиқа')).toBe(4200)
    expect(durationOf('ним соат')).toBe(1800)
    expect(durationOf('якуним соат')).toBe(5400)
    expect(durationOf('сӣ сония')).toBe(30)
    expect(durationOf('на пятнадцать минут')).toBe(900)
    expect(durationOf('полчаса')).toBe(1800)
    expect(durationOf('for 10 minutes')).toBe(600)
    expect(durationOf('соат чанд')).toBe(0)
  })

  it('knows the phone\'s own tasks in Tajik, Russian and English; the rest is a question for Mahliyo', () => {
    expect(commandOf('эй маҳлиё соат чанд')).toEqual({ kind: 'time' })
    expect(commandOf('который час')).toEqual({ kind: 'time' })
    expect(commandOf('маҳлиё имрӯз чандум аст')).toEqual({ kind: 'date' })
    expect(commandOf('таймер даҳ дақиқа')).toEqual({ kind: 'timer', seconds: 600 })
    expect(commandOf('баъди бист дақиқа')).toEqual({ kind: 'timer', seconds: 1200 })
    expect(commandOf('поставь таймер на пять минут')).toEqual({ kind: 'timer', seconds: 300 })
    expect(commandOf('секундомер')).toEqual({ kind: 'stopwatch' })
    expect(commandOf('обу ҳаво чӣ гуна')).toEqual({ kind: 'weather', when: 'now' })
    expect(commandOf('фардо ҳаво чӣ хел аст обу ҳаво')).toEqual({ kind: 'weather', when: 'tomorrow' })
    expect(commandOf('какая погода завтра')).toEqual({ kind: 'weather', when: 'tomorrow' })
    expect(commandOf('ба малика занг зан')).toEqual({ kind: 'call', name: 'малика' })
    expect(commandOf('позвони маме')).toEqual({ kind: 'call', name: 'маме' })
    expect(commandOf('маро ба донишгоҳи миллӣ бубар')).toEqual({ kind: 'navigate', place: 'донишгоҳи миллӣ' })
    expect(commandOf('проводи меня до вокзала')).toEqual({ kind: 'navigate', place: 'вокзала' })
    expect(commandOf('take me to the airport')).toEqual({ kind: 'navigate', place: 'the airport' })
    expect(commandOf('эй маҳлиё фотосинтез чист')).toEqual({ kind: 'ask', text: 'фотосинтез чист' })
  })
})

describe('calls by name or number', () => {
  it('reads a phone number said in words, group by group', async () => {
    const { phoneOf } = await import('@/lib/voiceCommands')
    expect(phoneOf('нӯҳсаду ду бисту се чилу панҷ шасту ҳафт')).toBe('902234567')
    expect(phoneOf('девятьсот два двадцать три сорок пять шестьдесят семь')).toBe('902234567')
    expect(phoneOf('нуль девять три')).toBeNull()
    expect(phoneOf('ноль девять три')).toBe('093')
    expect(phoneOf('900 11 22 33')).toBe('900112233')
    expect(phoneOf('малика')).toBeNull()
  })

  it('turns "call" with a number into the number, in several languages', () => {
    expect(commandOf('эй маҳлиё ба нӯҳсаду ду бисту се чилу панҷ шасту ҳафт занг зан')).toEqual({ kind: 'call', name: 'нӯҳсаду ду бисту се чилу панҷ шасту ҳафт', number: '902234567' })
    expect(commandOf('позвони маме')).toEqual({ kind: 'call', name: 'маме' })
    expect(commandOf('call 900 11 22 33')).toMatchObject({ kind: 'call', number: '900112233' })
    expect(commandOf("malikaga qo'ng'iroq qil")).toMatchObject({ kind: 'call', name: 'malika' })
  })

  it('finds the contact that sounds like the name: Tajik, Russian or Latin letters, endings, a typo', async () => {
    const { matchContacts } = await import('@/lib/voiceCommands')
    const book = [{ name: 'Малика Каримова' }, { name: 'Шахноза' }, { name: 'Malika Univer' }, { name: 'Мама' }, { name: 'Фаррух ака' }]
    expect(matchContacts('Маликаро', book).map((c) => c.name)).toEqual(['Малика Каримова', 'Malika Univer'])
    expect(matchContacts('Шаҳноза-ҷон', book).map((c) => c.name)).toEqual(['Шахноза'])
    expect(matchContacts('мама', book).map((c) => c.name)).toEqual(['Мама'])
    expect(matchContacts('Фарух', book).map((c) => c.name)).toEqual(['Фаррух ака'])
    expect(matchContacts('Зарина', book)).toEqual([])
  })
})
