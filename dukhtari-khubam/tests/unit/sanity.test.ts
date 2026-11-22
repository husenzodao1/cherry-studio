import { describe, expect, it } from 'vitest'

import { hoursOk, isMeaningful } from '@/lib/sanity'

describe('meaningful text', () => {
  it('takes real comments in Tajik, Russian, English and Persian', () => {
    for (const ok of ['', 'Олӣ', 'Барнома хеле зебо аст!', 'Очень понравилось, спасибо', 'Great app', 'برنامه خوبی است', 'Дарсҳо 👍']) expect(isMeaningful(ok), ok).toBe(true)
  })
  it('refuses mashing, repeats, no vowels and rude words', () => {
    for (const bad of ['asdfgh', 'фывапро', 'ааааааа', 'ббббб', 'кпрстнвк', '!!!???', 'хххх', 'бляди', 'ту сука', 'qwerty123', 'вмвмвмвмвмвмвмвмвмвмвмвмвмвмвм']) expect(isMeaningful(bad), bad).toBe(false)
  })
})

describe('study hours', () => {
  it('takes 1 to 6 hours, refuses 7 and more or no number', () => {
    expect(hoursOk('5')).toBe(true)
    expect(hoursOk('1,5')).toBe(true)
    expect(hoursOk('7')).toBe(false)
    expect(hoursOk('24')).toBe(false)
    expect(hoursOk('0')).toBe(false)
    expect(hoursOk('бисёр')).toBe(false)
  })
})
