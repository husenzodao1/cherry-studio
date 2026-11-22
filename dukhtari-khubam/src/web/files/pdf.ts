/**
 * A PDF from Mahliyo's Markdown: an A4 page with a title band, headings in the app's violet, lists,
 * tables with a tinted header, quotations with a bar, and page numbers. Roboto (it has every Tajik letter).
 */
// @ts-expect-error pdfmake's browser build has no types of its own
import pdfMakeModule from 'pdfmake/build/pdfmake'
// @ts-expect-error the fonts file has no types either
import vfs from 'pdfmake/build/vfs_fonts'

import { GREY, INK, LILAC, PLUM, SOFT, type FileSpec } from './build'
import { parseMarkdown, plain, type MdBlock, type Run } from './markdown'

type Node = Record<string, unknown> | string | Node[]
interface PdfMake { addVirtualFileSystem(v: unknown): void; createPdf(def: unknown): { getBlob(): Promise<Blob> } }
const pdfMake = pdfMakeModule as PdfMake
let fonts = false

const text = (rs: Run[]): Node[] => rs.map((r) => ({ text: r.text, bold: r.bold, italics: r.italic, ...(r.code ? { background: SOFT, color: PLUM } : {}) }))

function node(b: MdBlock, first: boolean): Node | null {
  switch (b.t) {
    case 'h':
      if (b.level === 1) return first ? null : { text: text(b.runs), style: 'h1' }
      return { text: text(b.runs), style: b.level === 2 ? 'h2' : 'h3' }
    case 'p': return { text: text(b.runs), style: 'p' }
    case 'list': {
      // nested points: a list inside the item before
      const build = (from: number, level: number): [Node[], number] => {
        const out: Node[] = []
        let i = from
        while (i < b.items.length && b.items[i].level >= level) {
          if (b.items[i].level > level) {
            const [inner, next] = build(i, b.items[i].level)
            out.push(b.ordered ? { ol: inner } : { ul: inner, markerColor: LILAC })
            i = next
          } else {
            out.push({ text: text(b.items[i].runs), margin: [0, 1, 0, 2] })
            i++
          }
        }
        return [out, i]
      }
      const [items] = build(0, b.items[0]?.level ?? 0)
      return b.ordered ? { ol: items, style: 'list' } : { ul: items, style: 'list', markerColor: LILAC }
    }
    case 'table': {
      const width = Math.max(b.head.length, ...b.rows.map((r) => r.length))
      const pad = (r: Run[][]) => [...r, ...Array(Math.max(0, width - r.length)).fill([])]
      return {
        style: 'table',
        table: {
          headerRows: 1,
          widths: Array(width).fill('*'),
          body: [pad(b.head).map((c) => ({ text: text(c), bold: true, color: PLUM, fillColor: SOFT })), ...b.rows.map((r) => pad(r).map((c) => ({ text: text(c) })))]
        },
        layout: { hLineColor: () => '#e3dcf5', vLineColor: () => '#e3dcf5', hLineWidth: () => 0.6, vLineWidth: () => 0.6, paddingTop: () => 5, paddingBottom: () => 5, paddingLeft: () => 7, paddingRight: () => 7 }
      }
    }
    case 'quote':
      return {
        style: 'quote',
        table: { widths: [3, '*'], body: [[{ text: '', fillColor: LILAC }, { text: text(b.runs), italics: true, color: '#4a4360', margin: [8, 4, 4, 4] }]] },
        layout: 'noBorders'
      }
    case 'code':
      return { table: { widths: ['*'], body: [[{ text: b.text, fontSize: 9.5, color: INK, fillColor: '#f6f4fb', margin: [8, 6, 8, 6] }]] }, layout: 'noBorders', margin: [0, 4, 0, 10] }
    case 'hr':
      return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 0.6, lineColor: '#e3dcf5' }], margin: [0, 8, 0, 12] }
  }
}

export async function makePdf(f: FileSpec): Promise<Blob> {
  if (!fonts) { pdfMake.addVirtualFileSystem(vfs); fonts = true }
  const blocks = parseMarkdown(f.content)
  // the first heading is the title (at the top, in its band), the line in italics after it its subtitle
  const top = blocks[0]?.t === 'h' && blocks[0].level === 1 ? plain(blocks[0].runs) : f.title
  const second = blocks[top === f.title && blocks[0]?.t !== 'h' ? 0 : 1]
  const subtitle = second?.t === 'p' && second.runs.every((r) => r.italic) ? plain(second.runs) : ''
  const body = blocks.map((b, i) => (subtitle && b === second ? null : node(b, i === 0))).filter((n): n is Node => n !== null)
  const def = {
    pageSize: 'A4',
    pageMargins: [56, 60, 56, 64],
    info: { title: top, creator: 'Mahliyo AI' },
    defaultStyle: { font: 'Roboto', fontSize: 11.5, lineHeight: 1.38, color: INK },
    content: [
      { canvas: [{ type: 'rect', x: 0, y: 0, w: 483, h: 4, r: 2, color: LILAC }], margin: [0, 0, 0, 18] },
      { text: top, style: 'title' },
      subtitle ? { text: subtitle, style: 'subtitle' } : null,
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 70, y2: 0, lineWidth: 2, lineColor: PLUM }], margin: [0, 6, 0, 18] },
      ...body
    ].filter(Boolean),
    footer: (page: number, pages: number) => ({
      columns: [{ text: top, color: GREY, fontSize: 8.5 }, { text: `${page} / ${pages}`, alignment: 'right', color: GREY, fontSize: 8.5 }],
      margin: [56, 24, 56, 0]
    }),
    styles: {
      title: { fontSize: 25, bold: true, color: PLUM, lineHeight: 1.15 },
      subtitle: { fontSize: 13, italics: true, color: GREY, margin: [0, 6, 0, 0] },
      h1: { fontSize: 19, bold: true, color: PLUM, margin: [0, 16, 0, 8] },
      h2: { fontSize: 15.5, bold: true, color: PLUM, margin: [0, 14, 0, 6] },
      h3: { fontSize: 12.5, bold: true, color: INK, margin: [0, 10, 0, 4] },
      p: { margin: [0, 0, 0, 9], alignment: 'justify' },
      list: { margin: [6, 0, 0, 10] },
      table: { fontSize: 10.5, margin: [0, 4, 0, 12] },
      quote: { margin: [0, 4, 0, 12] }
    }
  }
  return pdfMake.createPdf(def).getBlob()
}
