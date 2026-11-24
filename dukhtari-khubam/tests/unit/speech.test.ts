import { describe, expect, it } from 'vitest'

import { hearingPrompt, transcribe } from '@/server/speech'

describe('"Эй Маҳлиё" online: speech heard by the server', () => {
  it('names her language and how Mahliyo is spelt', () => {
    expect(hearingPrompt('tg')).toContain('Tajik (written in Tajik Cyrillic')
    expect(hearingPrompt('uz')).toContain('Uzbek (Latin script)')
    expect(hearingPrompt('xx')).toContain('Tajik')
    expect(hearingPrompt('ru')).toContain('"Махлиё" in Russian')
  })

  it('without a key: nothing (the phone keeps what its own model heard)', async () => {
    expect(await transcribe('UklGRg==', 'tg', [], ['gemini-x'])).toBeNull()
  })
})
