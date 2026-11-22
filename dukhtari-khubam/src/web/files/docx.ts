/**
 * A Word document from Mahliyo's Markdown: a title and subtitle, real Word headings (they make the
 * navigation pane), bullet and numbered lists, tables with a tinted header, quotations and page numbers.
 */
import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, LevelFormat, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow,
  TextRun, WidthType
} from 'docx'

import { GREY, INK, LILAC, PLUM, SOFT, type FileSpec } from './build'
import { parseMarkdown, plain, type Run } from './markdown'

const hex = (c: string) => c.replace('#', '')
const FONT = 'Arial'
const text = (rs: Run[], extra: { size?: number; color?: string; bold?: boolean; italics?: boolean } = {}) =>
  rs.map((r) => new TextRun({ text: r.text, bold: r.bold || extra.bold, italics: r.italic || extra.italics, font: r.code ? 'Consolas' : FONT, size: extra.size, color: r.code ? hex(PLUM) : extra.color, ...(r.code ? { shading: { type: ShadingType.CLEAR, fill: hex(SOFT), color: 'auto' } } : {}) }))

export async function makeDocx(f: FileSpec): Promise<Blob> {
  const blocks = parseMarkdown(f.content)
  const children: (Paragraph | Table)[] = []
  let titled = false
  let lists = 0
  const numbered: string[] = []
  for (const [i, b] of blocks.entries()) {
    if (b.t === 'h' && b.level === 1 && !titled) {
      titled = true
      children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: text(b.runs, { size: 52, bold: true, color: hex(PLUM) }), spacing: { after: 120 } }))
      const next = blocks[i + 1]
      if (!(next?.t === 'p' && next.runs.every((r) => r.italic))) children.push(rule())
      continue
    }
    if (b.t === 'p' && titled && i === 1 && b.runs.every((r) => r.italic)) {
      children.push(new Paragraph({ children: text(b.runs, { size: 26, color: hex(GREY) }), spacing: { after: 160 } }), rule())
      continue
    }
    switch (b.t) {
      case 'h':
        children.push(new Paragraph({ heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][b.level], children: text(b.runs) }))
        break
      case 'p':
        children.push(new Paragraph({ children: text(b.runs), alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 312 } }))
        break
      case 'list': {
        // every numbered list counts from one
        const ref = b.ordered ? `num-${lists++}` : 'bullets'
        if (b.ordered) numbered.push(ref)
        for (const it of b.items) children.push(new Paragraph({ children: text(it.runs), numbering: { reference: ref, level: it.level }, spacing: { after: 80, line: 300 } }))
        children.push(new Paragraph({ children: [], spacing: { after: 60 } }))
        break
      }
      case 'table': {
        const width = Math.max(b.head.length, ...b.rows.map((r) => r.length))
        const row = (cells: Run[][], head: boolean) => new TableRow({
          tableHeader: head,
          children: Array.from({ length: width }, (_, n) => new TableCell({
            children: [new Paragraph({ children: text(cells[n] ?? [], head ? { bold: true, color: hex(PLUM) } : {}) })],
            shading: head ? { type: ShadingType.CLEAR, fill: hex(SOFT), color: 'auto' } : undefined,
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }))
        })
        const line = { style: BorderStyle.SINGLE, size: 4, color: 'E3DCF5' }
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
          rows: [row(b.head, true), ...b.rows.map((r) => row(r, false))]
        }), new Paragraph({ children: [], spacing: { after: 120 } }))
        break
      }
      case 'quote':
        children.push(new Paragraph({
          children: text(b.runs, { italics: true, color: '4A4360' }),
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: hex(LILAC), space: 10 } },
          spacing: { before: 80, after: 200 }
        }))
        break
      case 'code':
        for (const l of b.text.split('\n')) children.push(new Paragraph({ children: [new TextRun({ text: l || ' ', font: 'Consolas', size: 19 })], shading: { type: ShadingType.CLEAR, fill: 'F6F4FB', color: 'auto' }, spacing: { after: 0 } }))
        children.push(new Paragraph({ children: [], spacing: { after: 120 } }))
        break
      case 'hr':
        children.push(rule())
        break
    }
  }
  if (!titled) children.unshift(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: f.title, size: 52, bold: true, color: hex(PLUM), font: FONT })] }), rule())

  const doc = new Document({
    creator: 'Mahliyo AI',
    title: plain(blocks.find((b) => b.t === 'h')?.t === 'h' ? (blocks.find((b) => b.t === 'h') as { runs: Run[] }).runs : [{ text: f.title }]),
    styles: {
      default: { document: { run: { font: FONT, size: 23, color: hex(INK) } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true, color: hex(PLUM) }, paragraph: { spacing: { before: 360, after: 140 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 28, bold: true, color: hex(PLUM) }, paragraph: { spacing: { before: 280, after: 120 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 24, bold: true, color: hex(INK) }, paragraph: { spacing: { before: 200, after: 80 } } }
      ]
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [0, 1, 2, 3].map((level) => ({ level, format: LevelFormat.BULLET, text: ['•', '◦', '▪', '•'][level], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420 + level * 360, hanging: 260 } }, run: { color: hex(LILAC) } } })) },
        ...numbered.map((reference) => ({ reference, levels: [0, 1, 2, 3].map((level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL][level], text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420 + level * 360, hanging: 300 } } } })) }))
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], size: 17, color: hex(GREY), font: FONT })] })] }) },
      children
    }]
  })
  return Packer.toBlob(doc)
}

/** a short violet line under the title */
const rule = () => new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: hex(LILAC), space: 4 } }, spacing: { after: 280 } })
