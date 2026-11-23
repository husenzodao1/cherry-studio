/**
 * The Markdown Mahliyo writes for documents and slides, read into plain parts the file builders draw:
 * headings, paragraphs, lists, tables, quotations, code and rules; in a line **bold**, *italic* and `code`.
 */

export interface Run { text: string; bold?: boolean; italic?: boolean; code?: boolean }
export type MdBlock =
  | { t: 'h'; level: 1 | 2 | 3; runs: Run[] }
  | { t: 'p'; runs: Run[] }
  | { t: 'list'; ordered: boolean; items: { runs: Run[]; level: number }[] }
  | { t: 'table'; head: Run[][]; rows: Run[][][] }
  | { t: 'quote'; runs: Run[] }
  | { t: 'code'; text: string }
  | { t: 'hr' }

/** A line's words with their **bold**, *italic* and `code`. */
export function runs(line: string): Run[] {
  const out: Run[] = []
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)(?<!\s)\3|`([^`]+)`/g
  let at = 0
  for (const m of line.matchAll(re)) {
    if (m.index! > at) out.push({ text: line.slice(at, m.index) })
    if (m[2] !== undefined) out.push(...runs(m[2]).map((r) => ({ ...r, bold: true })))
    else if (m[4] !== undefined) out.push(...runs(m[4]).map((r) => ({ ...r, italic: true })))
    else out.push({ text: m[5], code: true })
    at = m.index! + m[0].length
  }
  if (at < line.length) out.push({ text: line.slice(at) })
  return out.filter((r) => r.text)
}

/** the words of runs, without their marks */
export const plain = (rs: Run[]) => rs.map((r) => r.text).join('')

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => runs(c.trim()))
const isRule = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

/** Markdown read into its parts. */
export function parseMarkdown(text: string): MdBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: MdBlock[] = []
  let para: string[] = []
  const flush = () => { if (para.length) { out.push({ t: 'p', runs: runs(para.join(' ')) }); para = [] } }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) { flush(); continue }
    const fence = /^```/.exec(trimmed)
    if (fence) {
      flush()
      const body: string[] = []
      while (++i < lines.length && !/^```/.test(lines[i].trim())) body.push(lines[i])
      out.push({ t: 'code', text: body.join('\n') })
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(trimmed)
    if (h) { flush(); out.push({ t: 'h', level: Math.min(h[1].length, 3) as 1 | 2 | 3, runs: runs(h[2].replace(/\s*#+$/, '')) }); continue }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { flush(); out.push({ t: 'hr' }); continue }
    if (trimmed.startsWith('|') && i + 1 < lines.length && isRule(lines[i + 1])) {
      flush()
      const head = cells(trimmed)
      const rows: Run[][][] = []
      i++
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) rows.push(cells(lines[++i]))
      out.push({ t: 'table', head, rows })
      continue
    }
    if (trimmed.startsWith('>')) {
      flush()
      const q: string[] = [trimmed.replace(/^>\s?/, '')]
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) q.push(lines[++i].trim().replace(/^>\s?/, ''))
      out.push({ t: 'quote', runs: runs(q.join(' ')) })
      continue
    }
    const item = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (item) {
      flush()
      const ordered = /\d/.test(item[2])
      const items: { runs: Run[]; level: number }[] = []
      let j = i
      for (;;) {
        const m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[j])
        // a list of another kind at the same depth starts a list of its own
        if (!m || (items.length && !m[1] && /\d/.test(m[2]) !== ordered)) break
        items.push({ runs: runs(m[3]), level: Math.min(Math.floor(m[1].replace(/\t/g, '  ').length / 2), 3) })
        if (j + 1 >= lines.length) break
        j++
      }
      // the line after the list is read again (it was not an item)
      const last = /^(\s*)([-*+]|\d+[.)])\s+/.exec(lines[j])
      i = last && !(items.length && !last[1] && /\d/.test(last[2]) !== ordered) ? j : j - 1
      out.push({ t: 'list', ordered, items })
      continue
    }
    para.push(trimmed)
  }
  flush()
  return out
}

/** One slide: its title, the line under it, its points, a table, a picture, and the speaker's notes. */
export interface Slide {
  title: string; subtitle: string; points: { text: Run[]; level: number }[]; table: { head: string[]; rows: string[][] } | null; notes: string
  /** a real picture (from Wikipedia), written `![caption](https://…)` on a line of its own */
  image: { url: string; caption: string } | null
}
const PICTURE = /^\s*!\[([^\]\n]*)\]\((https:\/\/[^)\s]+)\)\s*$/

/** Slides written as Markdown, separated by "---" lines. */
export function parseSlides(text: string): Slide[] {
  return text.replace(/\r\n?/g, '\n').split(/\n\s*---+\s*\n/).map((whole) => {
    const slide: Slide = { title: '', subtitle: '', points: [], table: null, notes: '', image: null }
    const notes: string[] = []
    const rest: string[] = []
    // its picture (the first), taken out of its text
    const part = whole.split('\n').filter((line) => {
      const m = PICTURE.exec(line)
      if (m && !slide.image) slide.image = { caption: m[1].trim(), url: m[2] }
      return !m
    }).join('\n')
    for (const b of parseMarkdown(part)) {
      if (b.t === 'h' && !slide.title) slide.title = plain(b.runs)
      else if (b.t === 'h' || (b.t === 'p' && !slide.subtitle && !slide.points.length)) {
        if (!slide.subtitle) slide.subtitle = plain(b.runs)
        else rest.push(plain(b.runs))
      } else if (b.t === 'list') slide.points.push(...b.items.map((it) => ({ text: it.runs, level: it.level })))
      else if (b.t === 'quote') notes.push(plain(b.runs))
      else if (b.t === 'table' && !slide.table) slide.table = { head: b.head.map(plain), rows: b.rows.map((r) => r.map(plain)) }
      else if (b.t === 'p') rest.push(plain(b.runs))
      else if (b.t === 'code') rest.push(b.text)
    }
    // plain lines after the points: points too
    slide.points.push(...rest.map((r) => ({ text: [{ text: r }], level: 0 })))
    slide.notes = notes.join('\n')
    return slide
  }).filter((s) => s.title || s.points.length || s.table)
}
