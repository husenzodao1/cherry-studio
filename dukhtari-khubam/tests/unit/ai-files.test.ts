import { describe, expect, it } from 'vitest'

import { fileType, safeFileName, TEXT_EXTENSIONS } from '@/lib/aiFiles'
import { cleanBlocks, cleanFileText } from '@/server/mahliyo'
import { parseMarkdown, parseSlides } from '@/web/files/markdown'

describe('files she makes', () => {
  it('knows documents, slides and more than thirty kinds of text and code', () => {
    expect(fileType('Модар.pdf')?.kind).toBe('pdf')
    expect(fileType('Модар.DOCX')?.kind).toBe('docx')
    expect(fileType('slides.ppt')?.kind).toBe('pptx')
    expect(fileType('app.py')).toMatchObject({ kind: 'text', lang: 'python' })
    expect(fileType('virus.exe')).toBeNull()
    expect(TEXT_EXTENSIONS.length).toBeGreaterThan(30)
  })

  it('makes names safe', () => {
    expect(safeFileName('../../Модар: иншо.doc')).toBe('.. .. Модар иншо.docx')
    expect(safeFileName('index.html')).toBe('index.html')
    expect(safeFileName('a.exe')).toBeNull()
  })

  it('keeps a file block without its content (written in the next step), three at most', () => {
    const raw = Array.from({ length: 5 }, (_, i) => ({ type: 'file', name: `f${i}.pdf`, title: 'T', about: 'A' }))
    const out = cleanBlocks([...raw, { type: 'file', name: 'bad.exe', title: '', about: '' }])
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ type: 'file', name: 'f0.pdf', title: 'T', about: 'A', content: '' })
  })

  it('takes away fences around the whole file', () => {
    expect(cleanFileText('```python\nprint(1)\n```')).toBe('print(1)')
    expect(cleanFileText('# A\n\n```js\nx\n```\n\nend')).toBe('# A\n\n```js\nx\n```\n\nend')
  })

  it('reads the Markdown of a document', () => {
    const blocks = parseMarkdown('# Модар\n*сарчашмаи меҳр*\n\n## Муқаддима\nМодар **азиз** аст.\n\n- як\n  - ду\n1. се\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> Биҳишт зери пои модарон аст.')
    expect(blocks.map((b) => b.t)).toEqual(['h', 'p', 'h', 'p', 'list', 'list', 'table', 'quote'])
    expect(blocks[3]).toMatchObject({ t: 'p', runs: [{ text: 'Модар ' }, { text: 'азиз', bold: true }, { text: ' аст.' }] })
    expect(blocks[4]).toMatchObject({ t: 'list', ordered: false, items: [{ level: 0 }, { level: 1 }] })
    expect(blocks[6]).toMatchObject({ t: 'table', rows: [[[{ text: '1' }], [{ text: '2' }]]] })
  })

  it('reads slides separated by ---, with their notes', () => {
    const slides = parseSlides('# Фотосинтез\nМавзӯи биология\n\n---\n\n# Чист?\n- Нур\n- Об\n> Бигӯед, ки растанӣ хӯрок месозад.')
    expect(slides).toHaveLength(2)
    expect(slides[0]).toMatchObject({ title: 'Фотосинтез', subtitle: 'Мавзӯи биология' })
    expect(slides[1].points).toHaveLength(2)
    expect(slides[1].notes).toBe('Бигӯед, ки растанӣ хӯрок месозад.')
  })
})

describe('presentation styles', () => {
  it('a hundred styles, each named once, with readable inner slides', async () => {
    const { SLIDE_STYLES, innerColours, lightness, styleIn } = await import('@/lib/slideStyles')
    expect(SLIDE_STYLES).toHaveLength(100)
    expect(new Set(SLIDE_STYLES.map((s) => s.name)).size).toBe(100)
    for (const s of SLIDE_STYLES) {
      expect(s.bg + s.fg + s.accent).toMatch(/^(#[0-9a-f]{6}){3}$/)
      const c = innerColours(s)
      const [a, b] = [lightness(c.title), lightness(c.paper)].sort((x, y) => y - x)
      expect((a + 0.05) / (b + 0.05), s.name).toBeGreaterThanOrEqual(3)
    }
    expect(styleIn('/презентатсия\nСтил: Илмӣ #s03')).toBe('s03')
  })

  it('no two styles look alike: each its own cover, pattern and font together, and many fonts', async () => {
    const { SLIDE_STYLES, SLIDE_FONTS, coverShapes, styleNote } = await import('@/lib/slideStyles')
    const looks = SLIDE_STYLES.map((s) => `${s.layout}|${s.motif}|${s.font}`)
    expect(new Set(looks).size).toBe(100)
    expect(SLIDE_FONTS.length).toBeGreaterThanOrEqual(40)
    for (const s of SLIDE_STYLES) expect(coverShapes(s).title.w).toBeGreaterThan(40)
    expect(styleNote(SLIDE_STYLES[0])).toMatch(/ADVERTISING/)
  })
})
