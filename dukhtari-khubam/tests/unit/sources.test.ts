import { describe, expect, it } from 'vitest'

import { brandOf, frameOf, linkOf, sourceLabel } from '@/lib/sources'

describe('where a resource comes from', () => {
  it('knows the big sites by their link', () => {
    expect(brandOf('https://www.google.com/search?q=x')?.name).toBe('Google')
    expect(brandOf('https://youtu.be/abc')?.key).toBe('youtube')
    expect(brandOf('https://www.instagram.com/p/1')?.name).toBe('Instagram')
    expect(brandOf('https://t.me/channel/5')?.name).toBe('Telegram')
    expect(brandOf('https://tg.wikipedia.org/wiki/Рӯдакӣ')?.name).toBe('Wikipedia')
    expect(brandOf('https://example.tj/a')).toBeNull()
    expect(brandOf('not a link')).toBeNull()
  })

  it('a chip says the site, else the title, else the host', () => {
    expect(sourceLabel('Ҳусейнзода · https://google.com', null)).toEqual({ label: 'Google', link: 'https://google.com', brand: 'google' })
    expect(sourceLabel('Шоҳнома, Фирдавсӣ', null)).toEqual({ label: 'Шоҳнома, Фирдавсӣ', link: null, brand: null })
    expect(sourceLabel('https://ntc.tj/ru', null).label).toBe('ntc.tj')
    expect(sourceLabel(null, 'https://www.facebook.com/x').label).toBe('Facebook')
    expect(linkOf('матн', 'бе пайванд')).toBeNull()
  })

  it('pictures take a 16:9 or a 1:1 frame, whichever is nearer', () => {
    expect(frameOf(16 / 9)).toBe('16 / 9')
    expect(frameOf(4 / 3)).toBe('16 / 9')
    expect(frameOf(1)).toBe('1 / 1')
    expect(frameOf(3 / 4)).toBe('1 / 1')
    expect(frameOf(9 / 16)).toBe('1 / 1')
    expect(frameOf(null)).toBe('16 / 9')
  })
})
