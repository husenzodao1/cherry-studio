/**
 * A PowerPoint presentation from Mahliyo's slides, in the style she chose (slideStyles.ts): the cover drawn
 * from the same shapes as its preview, with the style's own font; the inner slides hold their title the
 * style's way (a bar, a band, a line, centred), a piece of its pattern in the corner, the points (or a
 * table), the speaker's notes and the slide number. (The fonts are Google's: they show as they are in
 * Google Slides and wherever they are installed; elsewhere PowerPoint puts a near one.)
 */
import PptxGenJS from 'pptxgenjs'

import { bodyFont, coverShapes, innerColours, innerHeader, innerShapes, lightness, lookStyle, paint, slideStyle, type Shape, type SlideStyle } from '@/lib/slideStyles'

import type { FileSpec } from './build'
import { parseSlides } from './markdown'

const hex = (c: string) => c.replace('#', '').toUpperCase()
const W = 13.333
const H = 7.5
/** the drawing's unit (a 160 × 90 box) in inches, and its type size in points */
const U = W / 160
const PT = 6

type Slide = ReturnType<PptxGenJS['addSlide']>

function draw(pres: PptxGenJS, slide: Slide, shapes: Shape[], st: SlideStyle) {
  const S = pres.ShapeType
  for (const sh of shapes) {
    const at = { x: sh.x * U, y: sh.y * U, w: sh.w * U, h: sh.h * U, ...(sh.r ? { rotate: sh.r } : {}) }
    const colour = hex(paint(sh.c, st))
    const transparency = Math.round((1 - (sh.o ?? 1)) * 100)
    if (sh.k === 'ring' || sh.k === 'box') {
      slide.addShape(sh.k === 'ring' ? S.ellipse : S.rect, { ...at, fill: { color: colour, transparency: 100 }, line: { color: colour, width: (sh.line ?? 0.5) * PT, transparency } })
      continue
    }
    const kind = sh.k === 'rect' ? S.rect : sh.k === 'ellipse' ? S.ellipse : sh.k === 'tri' ? S.triangle : S.rtTriangle
    slide.addShape(kind, { ...at, ...(sh.flip ? { flipH: true } : {}), fill: { color: colour, transparency }, line: { type: 'none' } })
  }
}

/** The cover in the style's layout, font and colours. */
function cover(pres: PptxGenJS, slide: Slide, st: SlideStyle, title: string, sub: string) {
  const c = coverShapes(st)
  slide.background = { color: hex(paint(c.back, st)) }
  draw(pres, slide, c.shapes, st)
  const t = c.title
  const box = { x: t.x * U, w: t.w * U, align: t.align }
  slide.addText([
    { text: title, options: { fontFace: st.font, fontSize: t.size * PT, bold: true, color: hex(paint(t.c, st)), breakLine: !!sub } },
    ...(sub ? [{ text: sub, options: { fontFace: bodyFont(st), fontSize: Math.round(t.size * PT * 0.42), color: hex(paint(t.sub, st)), paraSpaceBefore: 10 } }] : [])
  ], { ...box, y: t.y * U, h: t.h * U, valign: t.valign, fit: 'shrink', lineSpacingMultiple: 1.05 })
}

export async function makePptx(f: FileSpec): Promise<Blob> {
  const slides = parseSlides(f.content)
  // the look read from her sample picture, else one of the hundred styles
  const st = f.look ? lookStyle(f.look) : slideStyle(f.style)
  const c = innerColours(st)
  const light = lightness(c.paper) > 0.5
  const soft = light ? 'F3F0FA' : '2A2A3A'
  const muted = light ? '6B6480' : 'B8B5C8'
  const head = innerHeader(st)
  const body = bodyFont(st)
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
    draw(pres, slide, innerShapes(st), st)
    // the title, held the style's way
    let titleBox = { x: 0.75, y: 0.45, w: W - 2.9, h: 1, align: 'left' as 'left' | 'center', color: hex(c.title) }
    if (head === 'bar') slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: hex(c.mark) }, line: { type: 'none' } })
    if (head === 'top') {
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 1.35, fill: { color: hex(st.bg) }, line: { type: 'none' } })
      slide.addShape(pres.ShapeType.rect, { x: 0, y: 1.35, w: W, h: 0.06, fill: { color: hex(st.accent) }, line: { type: 'none' } })
      titleBox = { ...titleBox, y: 0.2, color: hex(st.fg) }
    }
    if (head === 'center') titleBox = { ...titleBox, x: 1.2, w: W - 2.4, align: 'center' }
    slide.addText(s.title, { x: titleBox.x, y: titleBox.y, w: titleBox.w, h: titleBox.h, align: titleBox.align, fontFace: st.font, fontSize: 30, bold: true, color: titleBox.color, valign: 'middle', fit: 'shrink' })
    if (head === 'under' || head === 'bar') slide.addShape(pres.ShapeType.rect, { x: 0.78, y: 1.48, w: head === 'under' ? 1.6 : 0.7, h: 0.06, fill: { color: hex(st.accent) }, line: { type: 'none' } })
    if (head === 'center') slide.addShape(pres.ShapeType.ellipse, { x: W / 2 - 0.07, y: 1.5, w: 0.14, h: 0.14, fill: { color: hex(st.accent) }, line: { type: 'none' } })
    let y = 1.85
    if (s.subtitle) {
      slide.addText(s.subtitle, { x: 0.75, y, w: W - 1.6, h: 0.6, fontFace: body, fontSize: 18, italic: true, color: muted, fit: 'shrink', align: titleBox.align })
      y += 0.65
    }
    const room = H - y - 0.7
    if (s.table) {
      const rows = [s.table.head.map((h) => ({ text: h, options: { bold: true, color: hex(c.title), fill: { color: soft } } })), ...s.table.rows.map((r) => r.map((t) => ({ text: t })))]
      slide.addTable(rows, { x: 0.75, y, w: W - 1.6, fontFace: body, fontSize: 14, color: hex(c.ink), border: { type: 'solid', pt: 0.75, color: soft }, autoPage: false })
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
      })), { x: 0.75, y, w: W - 1.6, h: Math.max(1, H - y - 0.7), fontFace: body, valign: 'top', fit: 'shrink', lineSpacingMultiple: 1.12 })
    }
    slide.addText(`${i + 1}`, { x: W - 1.1, y: H - 0.6, w: 0.6, h: 0.35, fontFace: body, fontSize: 11, color: muted, align: 'right' })
  })
  if (!slides.length) cover(pres, pres.addSlide(), st, f.title, '')
  return (await pres.write({ outputType: 'blob' })) as Blob
}
