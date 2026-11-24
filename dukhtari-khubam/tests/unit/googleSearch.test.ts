import { describe, expect, it } from 'vitest'

import { sourcesOf, wantsFresh } from '@/server/googleSearch'

describe('fresh facts from Google Search', () => {
  it('knows a question about what is happening now', () => {
    expect(wantsFresh('Хабарҳои имрӯзаи Тоҷикистон')).toBe(true)
    expect(wantsFresh('Курс доллара сегодня')).toBe(true)
    expect(wantsFresh('Эълонҳои кор дар Душанбе')).toBe(true)
    expect(wantsFresh('Фотосинтез чист?')).toBe(false)
  })

  it('her sources: the pages Google used (one per site), the summary with the first, and Google\'s own search', () => {
    const s = sourcesOf({
      text: '- 24.11.2026: Бонки миллӣ қурби 1 USD = 9,22 сомонӣ муқаррар кард.',
      candidates: [{ groundingMetadata: { webSearchQueries: ['қурби доллар имрӯз'], groundingChunks: [
        { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/a', title: 'nbt.tj' } },
        { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/b', title: 'nbt.tj' } },
        { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/c', title: 'asiaplustj.info' } }
      ] } }]
    })
    expect(s.map((x) => x.site)).toEqual(['nbt.tj', 'asiaplustj.info', 'google.com'])
    expect(s[0].text).toContain('9,22')
    expect(s[2].url).toBe('https://www.google.com/search?q=%D2%9B%D1%83%D1%80%D0%B1%D0%B8%20%D0%B4%D0%BE%D0%BB%D0%BB%D0%B0%D1%80%20%D0%B8%D0%BC%D1%80%D3%AF%D0%B7')
    expect(sourcesOf({ text: '' })).toEqual([])
  })
})
