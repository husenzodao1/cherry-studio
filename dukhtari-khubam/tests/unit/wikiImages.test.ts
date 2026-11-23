import { describe, expect, it, vi } from 'vitest'

import { parseSlides } from '@/web/files/markdown'
import { wikiPicture, withWikiPictures } from '@/server/wikiImages'

const res = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response
// as Wikipedia answers now: copies on thumb.wikimedia.org, every address with its counting tail
const UTM = '?utm_source=en.wikipedia.org&utm_campaign=api&utm_content=thumbnail'
const RUDAKI = { originalimage: { source: `https://upload.wikimedia.org/wikipedia/commons/8/87/Rudaki.jpg${UTM}`, width: 800 }, thumbnail: { source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/8/87/Rudaki.jpg/330px-Rudaki.jpg${UTM}`, width: 330 } }
const BIG = { originalimage: { source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Dushanbe.jpg/3840px-Dushanbe.jpg${UTM}`, width: 6000 }, thumbnail: { source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Dushanbe.jpg/330px-Dushanbe.jpg${UTM}`, width: 330 } }
const SVG = { originalimage: { source: `https://upload.wikimedia.org/wikipedia/commons/5/55/Photosynthesis_en.svg${UTM}`, width: 378 }, thumbnail: { source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Photosynthesis_en.svg/330px-Photosynthesis_en.svg.png${UTM}`, width: 330 } }

describe("a presentation's real pictures, from Wikipedia", () => {
  it("takes the article's lead picture: itself when small, its 960-pixel copy when big, a drawing as its PNG copy", async () => {
    const get = vi.fn(async (url: string, _init?: RequestInit) => res(url.includes('Rudaki') ? RUDAKI : url.includes('Dushanbe') ? BIG : url.includes('Photo') ? SVG : {}, !url.includes('Nowhere')))
    const f = get as unknown as typeof fetch
    expect(await wikiPicture('Rudaki', f)).toBe('https://upload.wikimedia.org/wikipedia/commons/8/87/Rudaki.jpg')
    expect(await wikiPicture('Dushanbe', f)).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Dushanbe.jpg/960px-Dushanbe.jpg')
    expect(await wikiPicture('Photosynthesis', f)).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Photosynthesis_en.svg/960px-Photosynthesis_en.svg.png')
    expect(await wikiPicture('Nowhere', f)).toBeNull()
    // the article asked by its English title, with a name for the app
    expect(get.mock.calls[0][0]).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Rudaki?redirect=true')
    expect(get.mock.calls[0][1]?.headers).toMatchObject({ 'user-agent': expect.stringContaining('LifeHub') })
  })

  it('puts the found pictures in the slides and leaves out the ones not found; the player and the file read them', async () => {
    const get = vi.fn(async (url: string) => res(url.includes('Rudaki') ? RUDAKI : {}, !url.includes('Nowhere')))
    const md = '# Рӯдакӣ\n## Падари шеър\n---\n# Ҳаёт\n- Панҷрӯд\n![Рӯдакӣ](wiki:Rudaki)\n> Дар бораи ҳаёташ\n---\n# Мерос\n- Ашъор\n![Ҳеҷ](wiki:Nowhere)'
    const out = await withWikiPictures(md, get as unknown as typeof fetch)
    expect(out).toContain('![Рӯдакӣ](https://upload.wikimedia.org/wikipedia/commons/8/87/Rudaki.jpg)')
    expect(out).not.toContain('wiki:')
    const slides = parseSlides(out)
    expect(slides[1].image).toEqual({ url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Rudaki.jpg', caption: 'Рӯдакӣ' })
    expect(slides[1].points.map((p) => p.text.map((r) => r.text).join(''))).toEqual(['Панҷрӯд'])
    expect(slides[1].notes).toBe('Дар бораи ҳаёташ')
    expect(slides[2].image).toBeNull()
  })
})
