/**
 * The files Mahliyo can make in the chat: a document (PDF, Word), a presentation (PowerPoint), or any text
 * file (a note, Markdown, a table, code in 30-odd languages). She writes only the content — Markdown for
 * documents and slides, the file itself for text — and the app builds the file on the phone.
 */

export type FileKind = 'pdf' | 'docx' | 'pptx' | 'text'

interface TextType { mime: string; lang: string; label: string }
const T = (mime: string, lang: string, label: string): TextType => ({ mime, lang, label })

/** text files by extension: their type, the language for showing them, and a short label */
const TEXT: Record<string, TextType> = {
  txt: T('text/plain', 'text', 'Матн'), md: T('text/markdown', 'markdown', 'Markdown'), csv: T('text/csv', 'csv', 'Ҷадвал CSV'),
  tsv: T('text/tab-separated-values', 'text', 'Ҷадвал TSV'), json: T('application/json', 'json', 'JSON'), xml: T('application/xml', 'xml', 'XML'),
  yaml: T('text/yaml', 'yaml', 'YAML'), yml: T('text/yaml', 'yaml', 'YAML'), toml: T('text/plain', 'toml', 'TOML'), ini: T('text/plain', 'ini', 'INI'),
  html: T('text/html', 'html', 'HTML'), css: T('text/css', 'css', 'CSS'), js: T('text/javascript', 'javascript', 'JavaScript'),
  mjs: T('text/javascript', 'javascript', 'JavaScript'), ts: T('text/plain', 'typescript', 'TypeScript'), jsx: T('text/plain', 'jsx', 'React JSX'),
  tsx: T('text/plain', 'tsx', 'React TSX'), vue: T('text/plain', 'html', 'Vue'), py: T('text/x-python', 'python', 'Python'),
  ipynb: T('application/json', 'json', 'Jupyter'), java: T('text/plain', 'java', 'Java'), kt: T('text/plain', 'kotlin', 'Kotlin'),
  swift: T('text/plain', 'swift', 'Swift'), c: T('text/plain', 'c', 'C'), h: T('text/plain', 'c', 'C'), cpp: T('text/plain', 'cpp', 'C++'),
  hpp: T('text/plain', 'cpp', 'C++'), cs: T('text/plain', 'csharp', 'C#'), go: T('text/plain', 'go', 'Go'), rs: T('text/plain', 'rust', 'Rust'),
  php: T('text/plain', 'php', 'PHP'), rb: T('text/plain', 'ruby', 'Ruby'), dart: T('text/plain', 'dart', 'Dart'), lua: T('text/plain', 'lua', 'Lua'),
  r: T('text/plain', 'r', 'R'), scala: T('text/plain', 'scala', 'Scala'), pl: T('text/plain', 'perl', 'Perl'), sql: T('application/sql', 'sql', 'SQL'),
  sh: T('text/x-shellscript', 'bash', 'Shell'), bat: T('text/plain', 'batch', 'Batch'), ps1: T('text/plain', 'powershell', 'PowerShell'),
  tex: T('text/x-tex', 'latex', 'LaTeX'), svg: T('image/svg+xml', 'xml', 'SVG'), srt: T('text/plain', 'text', 'Субтитр'), log: T('text/plain', 'text', 'Log')
}
export const TEXT_EXTENSIONS = Object.keys(TEXT)

const DOCS: Record<Exclude<FileKind, 'text'>, { mime: string; label: string }> = {
  pdf: { mime: 'application/pdf', label: 'PDF' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word' },
  pptx: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint' }
}

/** the extension of a file name, small letters ("" none) */
export const extOf = (name: string) => (/\.([a-z0-9]{1,6})$/i.exec(name)?.[1] ?? '').toLowerCase()

/** What a file is, by its name: a document, slides or text, its type, a label, and (text) its language; null when not one she makes. */
export function fileType(name: string): { kind: FileKind; mime: string; label: string; lang: string } | null {
  const ext = extOf(name)
  if (ext === 'pdf' || ext === 'docx' || ext === 'pptx') return { kind: ext, ...DOCS[ext], lang: 'markdown' }
  if (ext === 'doc') return { kind: 'docx', ...DOCS.docx, lang: 'markdown' }
  if (ext === 'ppt') return { kind: 'pptx', ...DOCS.pptx, lang: 'markdown' }
  const t = TEXT[ext]
  return t ? { kind: 'text', ...t } : null
}

/** A safe file name: no folders or odd characters, the right extension (.doc → .docx), at most 80 letters. */
export function safeFileName(name: string): string | null {
  const type = fileType(name)
  if (!type) return null
  const ext = type.kind === 'text' ? extOf(name) : type.kind
  const stem = name.replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 72) || 'file'
  return `${stem}.${ext}`
}

/** the longest a file's content may be (about 40 pages) */
export const FILE_CAP = 120_000
/** how many files one answer may hold */
export const FILES_MAX = 3
