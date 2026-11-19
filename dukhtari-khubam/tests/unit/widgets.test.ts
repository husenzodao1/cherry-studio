import { describe, expect, it } from 'vitest'

import { emptyProgress, localDay } from '@/lib/progress'
import { widgetPath } from '@/web/components/WidgetBridge'
import { widgetSummary } from '@/web/offline/widgets'

const texts = { brand: 'Духтари хубам', streak: 'рӯз', done: 'дарс', continueFallback: 'Оғоз', words: 'Суханҳои рӯз', quote: 'Дониш нур аст.' }
const day = (now: Date, back: number) => localDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back))

describe('home-screen widgets', () => {
  it('summarises streak, the week and the words of the day', () => {
    const now = new Date(2026, 10, 19, 12) // a Thursday
    const p = { ...emptyProgress(), days: [day(now, 0), day(now, 1), day(now, 2), day(now, 5)], lessons: { a: { p: 100, at: '2026-11-18T10:00:00Z', done: '2026-11-18T10:00:00Z' } } }
    const bundle = { lessons: { a: {}, b: {}, c: {}, d: {} }, inspirations: [{ id: '1', body: 'Якум', author_name: 'Рӯдакӣ' }] } as never
    const s = widgetSummary(bundle, p, texts, 'tg', now)
    expect(s.streak).toBe(3)
    expect(s.week).toEqual([false, true, false, false, true, true, true])
    expect(s.weekLabels.at(-1)).toBe('Па')
    expect(s.done).toBe(1)
    expect(s.percent).toBe(25)
    expect(s.nextPath).toBe('/schools')
    expect(s.quote).toBe('Якум')
    expect(s.author).toBe('— Рӯдакӣ')
    expect(s.wordsLabel).toBe('СУХАНҲОИ РӮЗ')
  })

  it('falls back to the app line without inspirations', () => {
    expect(widgetSummary(null, emptyProgress(), texts, 'tg').quote).toBe('Дониш нур аст.')
  })

  it('reads widget links and refuses anything else', () => {
    expect(widgetPath('tj.dukhtarikhubam.app://open/review')).toBe('/review')
    expect(widgetPath('tj.dukhtarikhubam.app://open')).toBe('/')
    expect(widgetPath('tj.dukhtarikhubam.app://open/lesson?id=abc-1')).toBe('/lesson?id=abc-1')
    expect(widgetPath('https://evil.example/x')).toBeNull()
    expect(widgetPath('tj.dukhtarikhubam.app://open/<script>')).toBe('/')
  })
})
