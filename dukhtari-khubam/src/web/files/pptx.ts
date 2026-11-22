/**
 * A PowerPoint presentation from Mahliyo's slides, in the style she chose (slideStyles.ts): the cover in
 * the style's own layout and colours, then the inner slides with its bar, title colour and soft circle,
 * the points (or a table), the speaker's notes and the slide number.
 */
import PptxGenJS from 'pptxgenjs'

import { innerColours, lightness, slideStyle, type SlideStyle } from '@/lib/slideStyles'

import type { FileSpec } from './build'
import { parseSlides } from './markdown'

const hex = (c: string) => c.replace('#', '').toUpperCase()
const FONT = 'Arial'
const W = 13.333
const H = 7.5
const none = { type: 'none' as const }

type Slide = ReturnType<PptxGenJS['addSlide']>

/** The cover in the style's layout. */
function cover(pres: PptxGenJS, slide: Slide, st: SlideStyle, title: string, sub: string) {
  const S = pres.ShapeType
  slide.background = { color: hex(st.bg) }
  let box = { x: 0.9, y: 2.6, w: W - 3, align: 'left' as 'left' | 'center' }
  let fg = st.fg
  switch (st.layout) {
    case 'circles':
      slide.addShape(S.ellipse, { x: W - 4.6, y: -1.6, w: 6.2, h: 6.2, fill: { color: hex(st.accent), transparency: 45 }, line: none })
      slide.addShape(S.ellipse, { x: -1.4, y: H - 2.6, w: 3.6, h: 3.6, fill: { color: hex(st.fg), transparency: 86 }, line: none })
      break
    case 'band':
      // a band of the accent on the left, the title on the colour beside it
      slide.addShape(S.rect, { x: 0, y: 0, w: 4.2, h: H, fill: { color: hex(st.accent) }, line: none })
      slide.addShape(S.ellipse, { x: 2.6, y: H / 2 - 1.6, w: 3.2, h: 3.2, fill: { color: hex(st.bg) }, line: { color: hex(st.fg), width: 2 } })
      box = { x: 6.2, y: 2.6, w: W - 7, align: 'left' }
      break
    case 'split':
      // the top in the colour, the bottom light: the title on the line between
      slide.background = { color: lightness(st.bg) < 0.5 ? 'FFFFFF' : '111111' }
      slide.addShape(S.rect, { x: 0, y: 0, w: W, h: H * 0.62, fill: { color: hex(st.bg) }, line: none })
      slide.addShape(S.rect, { x: 0, y: H * 0.62, w: W, h: 0.12, fill: { color: hex(st.accent) }, line: none })
      box = { x: 0.9, y: 1.6, w: W - 1.8, align: 'left' }
      break
    case 'frame':
      slide.addShape(S.rect, { x: 0.45, y: 0.45, w: W - 0.9, h: H - 0.9, fill: { type: 'none' } as never, line: { color: hex(st.accent), width: 2.5 } })
      slide.addShape(S.rect, { x: 0.65, y: 0.65, w: W - 1.3, h: H - 1.3, fill: { type: 'none' } as never, line: { color: hex(st.accent), width: 0.75 } })
      box = { x: 1.5, y: 2.5, w: W - 3, align: 'center' }
      break
    case 'bar':
      slide.addShape(S.rect, { x: 0, y: H - 1.1, w: W, h: 1.1, fill: { color: hex(st.accent) }, line: none })
      slide.addShape(S.rect, { x: 0.9, y: 2.3, w: 1.6, h: 0.14, fill: { color: hex(st.accent) }, line: none })
      break
    case 'dots':
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        slide.addShape(S.ellipse, { x: W - 4 + c * 0.55, y: 0.6 + r * 0.55, w: 0.14, h: 0.14, fill: { color: hex(st.accent), transparency: 20 + r * 10 }, line: none })
      }
      slide.addShape(S.ellipse, { x: -1.2, y: H - 2.2, w: 3, h: 3, fill: { color: hex(st.accent), transparency: 70 }, line: none })
      break
    case 'minimal':
      slide.addShape(S.rect, { x: 0.9, y: H - 1.2, w: W - 1.8, h: 0.03, fill: { color: hex(st.accent) }, line: none })
      break
  }
  if (st.layout === 'split') fg = st.fg
  slide.addText(title, { x: box.x, y: box.y, w: box.w, h: 1.9, fontFace: FONT, fontSize: 44, bold: true, color: hex(fg), valign: st.layout === 'split' ? 'bottom' : 'top', align: box.align, fit: 'shrink' })
  if (sub) {
    const below = st.layout === 'split' ? { y: H * 0.62 + 0.4, color: lightness(st.bg) < 0.5 ? '334155' : 'E5E7EB' } : { y: box.y + 2.05, color: hex(fg) }
    slide.addText(sub, { x: box.x, y: below.y, w: box.w, h: 1, fontFace: FONT, fontSize: 20, color: below.color, valign: 'top', align: box.align, fit: 'shrink', transparency: st.layout === 'split' ? 0 : 15 })
  }
}

export async function makePptx(f: FileSpec & { style?: string }): Promise<Blob> {
  const slides = parseSlides(f.content)
  const st = slideStyle(f.style)
  const c = innerColours(st)
  const soft = lightness(c.paper) > 0.5 ? 'F3F0FA' : '2A2A3A'
  const muted = lightness(c.paper) > 0.5 ? '6B6480' : 'B8B5C8'
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = slides[0]?.title || f.title
  pres.author = 'Mahliyo AI'

  slides.forEach((s, i) => {
    const slide = pres.addSlide()
    if (s.notes) slide.addNotes(s.notes)
    if (i === 0) {
      cover(pres, slide, st, s.title || f.title, s.subtitle || s.points.map((p) => p.text.map((r) => r.text).join('')).join(' · '))
      return
    }
    slide.background = { color: hex(c.paper) }
    slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: hex(c.mark) }, line: none })
    slide.addShape(pres.ShapeType.ellipse, { x: W - 1.9, y: -0.9, w: 2.6, h: 2.6, fill: { color: hex(st.accent), transparency: 82 }, line: none })
    slide.addText(s.title, { x: 0.75, y: 0.45, w: W - 2.6, h: 1, fontFace: FONT, fontSize: 30, bold: true, color: hex(c.title), valign: 'middle', fit: 'shrink' })
    slide.addShape(pres.ShapeType.rect, { x: 0.78, y: 1.48, w: 0.7, h: 0.06, fill: { color: hex(st.accent) }, line: none })
    let y = 1.8
    if (s.subtitle) {
      slide.addText(s.subtitle, { x: 0.75, y, w: W - 1.6, h: 0.6, fontFace: FONT, fontSize: 18, italic: true, color: muted, fit: 'shrink' })
      y += 0.65
    }
    const room = H - y - 0.7
    if (s.table) {
      const rows = [s.table.head.map((h) => ({ text: h, options: { bold: true, color: hex(c.title), fill: { color: soft } } })), ...s.table.rows.map((r) => r.map((t) => ({ text: t })))]
      slide.addTable(rows, { x: 0.75, y, w: W - 1.6, fontFace: FONT, fontSize: 14, color: hex(c.ink), border: { type: 'solid', pt: 0.75, color: soft }, autoPage: false })
      y += Math.min(room, 0.45 * rows.length) + 0.2
    }
    if (s.points.length) {
      // one run a point: the maker starts a new paragraph at every run that has a bullet
      slide.addText(s.points.map((p, n) => ({
        text: p.text.map((r) => r.text).join(''),
        options: {
          bullet: p.level ? { characterCode: '25E6', indent: 22 } : { characterCode: '25CF', indent: 22 },
          indentLevel: p.level,
          paraSpaceBefore: n ? 6 : 0,
          bold: p.text.length > 0 && p.text.every((r) => r.bold),
          color: p.level ? muted : hex(c.ink),
          fontSize: p.level ? 17 : 20
        }
      })), { x: 0.75, y, w: W - 1.6, h: Math.max(1, H - y - 0.7), fontFace: FONT, valign: 'top', fit: 'shrink', lineSpacingMultiple: 1.12 })
    }
    slide.addText(`${i + 1}`, { x: W - 1.1, y: H - 0.6, w: 0.6, h: 0.35, fontFace: FONT, fontSize: 11, color: muted, align: 'right' })
  })
  if (!slides.length) cover(pres, pres.addSlide(), st, f.title, '')
  return (await pres.write({ outputType: 'blob' })) as Blob
}
