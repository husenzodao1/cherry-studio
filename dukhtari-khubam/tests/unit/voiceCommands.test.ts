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
