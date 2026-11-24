import { describe, expect, it } from 'vitest'

import { nameHeard, phraseHeard, skeleton } from '@/web/offline/hey'

describe('"Эй Маҳлиё": a phrase heard by the small model is accepted by its sound, not its spelling', () => {
  it('words by their consonants', () => {
    expect(skeleton('Маҳлиё')).toBe('мхл')
    expect(skeleton('моро')).toBe(skeleton('маро'))
  })

  it('her name as the phone hears it', () => {
    expect(nameHeard('эй моҳи ва моро бо хонум бар')).toBe(true)
    expect(nameHeard('эй махлие соат чанд')).toBe(true)
    expect(nameHeard('hey mahliyo')).toBe(true)
    expect(nameHeard('салом салом')).toBe(false)
    expect(nameHeard('моҳи январ')).toBe(false)
  })

  it('the phrase from the screenshot is taken; something else is not', () => {
    expect(phraseHeard('Эй Маҳлиё, маро ба хона бубар.', 'эй моҳи ва моро бо хонум бар')).toBe(true)
    expect(phraseHeard('Эй Маҳлиё, имрӯз обу ҳаво чӣ гуна аст?', 'эй маҳлиё имрӯз обу ҳаво чӣ гуна аст')).toBe(true)
    expect(phraseHeard('Эй Маҳлиё, соат чанд шуд?', 'эй маҳлиё китоб хондам')).toBe(false)
    expect(phraseHeard('Эй Маҳлиё, имрӯз обу ҳаво чӣ гуна аст?', 'салом салом')).toBe(false)
  })
})
