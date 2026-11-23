/**
 * A book's or a lecture's text, read here on the phone or in the browser (PDF, Word, text), and cut into
 * passages for the search: the staff's official books and a student's own Workspace materials.
 */

/** a book's passages: about a thousand characters each, cut at a sentence, a little of the one before kept */
const PASSAGE = 1100
const OVERLAP = 150
export function passagesOf(pages: string[]): { n: number; page: number | null; text: string }[] {
  const out: { n: number; page: number | null; text: string }[] = []
  pages.forEach((raw, p) => {
    const text = raw.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    let at = 0
    while (at < text.length) {
      let end = Math.min(text.length, at + PASSAGE)
      if (end < text.length) {
        const stop = Math.max(text.lastIndexOf('. ', end), text.lastIndexOf('\n', end), text.lastIndexOf('! ', end), text.lastIndexOf('? ', end))
        if (stop > at + PASSAGE / 2) end = stop + 1
      }
      const piece = text.slice(at, end).trim()
      if (piece.length > 20) out.push({ n: out.length, page: pages.length > 1 ? p + 1 : null, text: piece })
      if (end >= text.length) break
      at = Math.max(end - OVERLAP, at + 1)
    }
  })
  return out
}

/** a book's text, page by page, read here in the browser (PDF, Word, text) */
export async function pagesOf(file: File): Promise<string[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent()
      pages.push(content.items.map((it) => ('str' in it ? `${it.str}${it.hasEOL ? '\n' : ' '}` : '')).join(''))
    }
    return pages
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    return [r.value]
  }
  return [await file.text()]
}

