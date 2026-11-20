import { describe, expect, it } from 'vitest'

import { DEFAULT_STRINGS, LOCALES } from '@/web/i18n'

const tg = DEFAULT_STRINGS.tg as Record<string, string>
// the set of placeholders (lists of variants, one per line, may use one several times)
const holes = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort()

describe('every interface language is complete', () => {
  for (const locale of LOCALES) {
    it(`${locale}: every text is translated, with the same placeholders`, () => {
      const d = DEFAULT_STRINGS[locale] as Record<string, string>
      const missing = Object.keys(tg).filter((k) => tg[k] && !d[k])
      expect(missing).toEqual([])
      const broken = Object.keys(tg).filter((k) => tg[k] && d[k] && holes(d[k]).join() !== holes(tg[k]).join())
      expect(broken).toEqual([])
    })
  }
})
