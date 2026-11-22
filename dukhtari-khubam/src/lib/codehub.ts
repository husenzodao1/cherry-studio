/**
 * CodeHub: a lesson written as simple Tajik tags, turned into the lesson's blocks and back.
 *
 *   <сарлавҳа>Одоби сухан</сарлавҳа>
 *   <сатр>Сухани нек калиди **дилҳост**.</сатр>
 *   <рӯйхат>
 *   Салом диҳед
 *   Бо меҳр гӯед
 *   </рӯйхат>
 *   <видео ном="Дарс" тавсиф="Шарҳи кӯтоҳ" манбаъ="https://youtube.com">https://youtu.be/abc123def45</видео>
 *   <аудио ном="Шеър" гӯянда="Нигина">медиа:1b2c…</аудио>
 *
 * A tag closes with </тег> or with the same <тег> again. Text outside tags becomes paragraphs.
 * **ғафс** and *курсив* work inside text, and <синну сол>16</синну сол> at the start of a text keeps it
 * for that age and younger (as in the block editor). Mistakes come back with their line:
 * "Хатогӣ дар сатри 4: …".
 */

export interface CodeError { line: number; message: string }
interface Rich { spans: { text: string; marks?: string[] }[] }
/** One block as written in code: its type, layout props and the text of the language being edited. */
export interface CodeBlock { type: string; props: Record<string, unknown>; content: Record<string, unknown> | Rich; line: number; keep?: string }

interface TagSpec {
  /** what the block is; 'keep' leaves a block CodeHub cannot write untouched */
  type: string
  attrs: string[]
  /** no text inside (<ҷудокунанда/>, <нигоҳ id="…"/>) */
  empty?: boolean
  props?: Record<string, unknown>
}

const CALLOUT = (variant: string): TagSpec => ({ type: 'callout', attrs: ['сарлавҳа'], props: { variant } })

/** Every tag, by its Tajik name. */
export const TAGS: Record<string, TagSpec> = {
  'сарлавҳа': { type: 'heading', attrs: ['дараҷа'], props: { level: 2 } },
  'зерсарлавҳа': { type: 'heading', attrs: [], props: { level: 3 } },
  'муқаддима': { type: 'lead', attrs: [] },
  'сатр': { type: 'paragraph', attrs: [] },
  'матн': { type: 'paragraph', attrs: [] },
  'рӯйхати рақамдор': { type: 'ordered_list', attrs: [] },
  'рӯйхат': { type: 'bullet_list', attrs: [] },
  'иқтибос': { type: 'quote', attrs: ['муаллиф', 'манбаъ'], props: { style: 'elegant' } },
  'муҳим': CALLOUT('important'),
  'огоҳӣ': CALLOUT('warning'),
  'қайд': CALLOUT('note'),
  'маслиҳат': CALLOUT('tip'),
  'маълумот': CALLOUT('info'),
  'супориш': { type: 'practical_task', attrs: ['сарлавҳа'] },
  'манбаъ': { type: 'source', attrs: ['муаллиф', 'сол', 'пайванд'] },
  'расм': { type: 'image', attrs: ['тавсиф', 'манбаъ'] },
  'видео': { type: 'video', attrs: ['ном', 'тавсиф', 'манбаъ'] },
  'аудио': { type: 'audio', attrs: ['ном', 'гӯянда', 'манбаъ'] },
  'ҷудокунанда': { type: 'divider', attrs: [], empty: true },
  'нигоҳ': { type: 'keep', attrs: ['id'], empty: true }
}
const NAMES = Object.keys(TAGS).sort((a, b) => b.length - a.length)
/** Tags written inside a text and kept as they are (the age limit). */
const INLINE = ['синну сол']
/** Tags whose text holds a file or a link, not words. */
export const MEDIA_TAGS = ['расм', 'видео', 'аудио']

const MEDIA_REF = /^медиа:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** The 11-character id of a YouTube link, or null. */
export function youtubeIdOf(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^(www\.|m\.)/, '')
    if (host === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)?.[1] ?? null
      return v && /^[\w-]{11}$/.test(v) ? v : null
    }
  } catch { /* not a link */ }
  return null
}

const isUrl = (s: string) => {
  try { return /^https?:$/.test(new URL(s).protocol) } catch { return false }
}

export function toRich(text: string): Rich {
  const spans: Rich['spans'] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) spans.push({ text: text.slice(last, m.index) })
    const bold = m[0].startsWith('**')
    spans.push({ text: m[0].slice(bold ? 2 : 1, bold ? -2 : -1), marks: [bold ? 'bold' : 'italic'] })
    last = m.index! + m[0].length
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return { spans: spans.length ? spans : [{ text: '' }] }
}

export function fromRich(value: unknown): string {
  const spans = (value as Rich | null)?.spans ?? []
  return spans.map((s) => (s.marks?.includes('bold') ? `**${s.text}**` : s.marks?.includes('italic') ? `*${s.text}*` : s.text)).join('')
}

const lineAt = (src: string, i: number) => src.slice(0, i).split('\n').length
const known = Object.keys(TAGS).map((n) => `<${n}>`).join(', ')

/** Reads `ном="…" тавсиф="…"` (commas between them allowed). */
function readAttrs(raw: string, tag: string, line: number, errors: CodeError[]): Record<string, string> {
  const out: Record<string, string> = {}
  let rest = raw.trim()
  while (rest) {
    rest = rest.replace(/^[,\s]+/, '')
    if (!rest) break
    const m = rest.match(/^([\p{L}_]+)\s*=\s*(?:"([^"]*)"|«([^»]*)»|'([^']*)')/u)
    if (!m) {
      const word = rest.match(/^[^\s=,]+/u)?.[0] ?? rest.slice(0, 12)
      errors.push({ line, message: /=/.test(rest.slice(0, 40)) && !/=\s*["«']/.test(rest.slice(0, 40))
        ? `қимати «${word}» дар нохунак нест: ${word}="…" нависед`
        : `дар теги <${tag}> «${word}» нофаҳмо аст: ном="…" нависед` })
      break
    }
    const name = m[1]
    if (!TAGS[tag].attrs.includes(name)) {
      errors.push({ line, message: TAGS[tag].attrs.length
        ? `атрибути «${name}» барои <${tag}> нест (дастрас: ${TAGS[tag].attrs.join(', ')})`
        : `теги <${tag}> атрибут надорад («${name}» нолозим аст)` })
    } else out[name] = (m[2] ?? m[3] ?? m[4] ?? '').trim()
    rest = rest.slice(m[0].length)
  }
  return out
}

/** Turns written code into blocks, or says what is wrong and on which line. */
export function parseCode(src: string): { blocks: CodeBlock[]; errors: CodeError[] } {
  const blocks: CodeBlock[] = []
  const errors: CodeError[] = []
  let open: { name: string; attrs: Record<string, string>; line: number; start: number } | null = null
  let i = 0
  let loose = { start: 0 }

  const freeText = (from: number, to: number) => {
    const text = src.slice(from, to)
    let offset = from
    for (const chunk of text.split(/\n\s*\n/)) {
      const t = chunk.trim()
      if (t) blocks.push({ type: 'paragraph', props: {}, content: toRich(t.replace(/\s*\n\s*/g, ' ')), line: lineAt(src, offset + chunk.indexOf(t)) })
      offset += chunk.length + 2
    }
  }

  while (i < src.length) {
    const lt = src.indexOf('<', i)
    if (lt < 0) break
    const after = src.slice(lt + 1)
    const closing = after.startsWith('/')
    const body = closing ? after.slice(1) : after
    const inline = INLINE.find((n) => body.startsWith(n) && /^[\s>/]/.test(body.slice(n.length)))
    if (inline) {
      // the age tag belongs to the text it starts: skip over it
      const end = src.indexOf('>', lt)
      i = end < 0 ? src.length : end + 1
      continue
    }
    const name = NAMES.find((n) => body.startsWith(n) && /^[\s>/,]/.test(body.slice(n.length)))
    const gt = src.indexOf('>', lt)
    const line = lineAt(src, lt)
    if (!name) {
      const word = body.match(/^[^\s>/]*/u)?.[0] ?? ''
      if (/^\p{L}/u.test(word)) {
        errors.push({ line, message: `теги <${word}> маълум нест. Тегҳои дастрас: ${known}` })
        i = gt < 0 ? src.length : gt + 1
      } else i = lt + 1
      continue
    }
    if (gt < 0) {
      errors.push({ line, message: `теги <${name} … ба «>» нарасидааст` })
      break
    }
    // what is written between the tag's name and its «>» (its attributes)
    const inner = src.slice(lt + 1 + (closing ? 1 : 0) + name.length, gt)
    const selfClosing = /\/\s*$/.test(inner)
    const spec = TAGS[name]

    if (!open) {
      if (closing) {
        errors.push({ line, message: `</${name}> омад, аммо <${name}> кушода нашуда буд` })
        i = gt + 1
        continue
      }
      freeText(loose.start, lt)
      const attrs = readAttrs(inner.replace(/\/\s*$/, ''), name, line, errors)
      if (spec.empty || selfClosing) {
        if (!spec.empty) errors.push({ line, message: `<${name}/> холӣ аст: матнро байни <${name}> ва </${name}> нависед` })
        else if (spec.type === 'keep') blocks.push({ type: 'keep', props: {}, content: {}, line, keep: attrs.id })
        else blocks.push({ type: spec.type, props: {}, content: {}, line })
        i = gt + 1
        loose = { start: i }
        continue
      }
      open = { name, attrs, line, start: gt + 1 }
      i = gt + 1
      continue
    }

    // inside a tag: only its own closing (</тег> or <тег> again) may come
    if (name === open.name) {
      const text = src.slice(open.start, lt)
      const made = build(open.name, open.attrs, text, open.line, errors)
      if (made) blocks.push(made)
      open = null
      i = gt + 1
      loose = { start: i }
      continue
    }
    errors.push({ line, message: closing
      ? `</${name}> омад, аммо <${open.name}> (сатри ${open.line}) кушода буд — аввал онро пӯшед`
      : `теги <${name}> дар дохили <${open.name}> (сатри ${open.line}) истода наметавонад — аввал <${open.name}>-ро пӯшед` })
    i = gt + 1
  }
  if (open) errors.push({ line: open.line, message: `теги <${open.name}> пӯшида нашудааст: дар охир </${open.name}> нависед` })
  else freeText(loose.start, src.length)
  return { blocks, errors }
}

function build(name: string, attrs: Record<string, string>, raw: string, line: number, errors: CodeError[]): CodeBlock | null {
  const spec = TAGS[name]
  const text = raw.trim()
  const fail = (message: string) => { errors.push({ line, message }); return null }
  const source = attrs['манбаъ'] || undefined
  if (source && /^https?:/i.test(source) && !isUrl(source)) return fail(`пайванд хатост: «${source}»`)
  switch (spec.type) {
    case 'heading': {
      if (!text) return fail(`<${name}> холӣ аст: сарлавҳаро нависед`)
      const level = attrs['дараҷа'] ? Number(attrs['дараҷа']) : (spec.props?.level as number)
      if (level !== 2 && level !== 3) return fail(`дараҷаи сарлавҳа 2 ё 3 аст, на «${attrs['дараҷа']}»`)
      return { type: 'heading', props: { level }, content: toRich(text.replace(/\s*\n\s*/g, ' ')), line }
    }
    case 'lead':
    case 'paragraph':
      if (!text) return fail(`<${name}> холӣ аст`)
      return { type: spec.type, props: {}, content: toRich(text.replace(/\s*\n\s*/g, ' ')), line }
    case 'bullet_list':
    case 'ordered_list': {
      const items = text.split('\n').map((s) => s.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim()).filter(Boolean)
      if (!items.length) return fail(`<${name}> холӣ аст: ҳар банд дар сатри алоҳида`)
      return { type: spec.type, props: {}, content: { items: items.map(toRich) }, line }
    }
    case 'quote':
      if (!text) return fail(`<${name}> холӣ аст`)
      return { type: 'quote', props: { ...spec.props }, content: { text: toRich(text), ...(attrs['муаллиф'] ? { author: attrs['муаллиф'] } : {}), ...(source ? { source } : {}) }, line }
    case 'callout':
    case 'practical_task':
      if (!text) return fail(`<${name}> холӣ аст`)
      return { type: spec.type, props: { ...spec.props }, content: { ...(attrs['сарлавҳа'] ? { title: attrs['сарлавҳа'] } : {}), body: toRich(text) }, line }
    case 'source': {
      const url = attrs['пайванд']
      if (url && !isUrl(url)) return fail(`пайванд хатост: «${url}» (бо https:// оғоз мешавад)`)
      if (!text && !url) return fail(`<${name}> холӣ аст: номи манбаъ ё пайвандро нависед`)
      return { type: 'source', props: url ? { url } : {}, content: { title: text || url, ...(attrs['муаллиф'] ? { author: attrs['муаллиф'] } : {}), ...(attrs['сол'] ? { year: attrs['сол'] } : {}) }, line }
    }
    case 'image': {
      if (!text) return fail(`<${name}> холӣ аст: файлро гиред (тугмаи «Файлро гиред»)`)
      const ref = text.match(MEDIA_REF)
      if (!ref) return fail(isUrl(text) ? `пайванди расм қабул намешавад: расмро бо тугмаи «Файлро гиред» бор кунед` : `пайванд хатост: дар <${name}> файли боршуда (медиа:…) лозим аст`)
      return { type: 'image', props: { asset_id: ref[1] }, content: { ...(attrs['тавсиф'] ? { caption: attrs['тавсиф'] } : {}), ...(source ? { source } : {}) }, line }
    }
    case 'video': {
      if (!text) return fail(`<${name}> холӣ аст: пайванди YouTube ё файлро гузоред`)
      const meta = { ...(attrs['ном'] ? { title: attrs['ном'] } : {}), ...(attrs['тавсиф'] ? { caption: attrs['тавсиф'] } : {}), ...(source ? { source } : {}) }
      const ref = text.match(MEDIA_REF)
      if (ref) return { type: 'video', props: { asset_id: ref[1] }, content: meta, line }
      if (!isUrl(text)) return fail(`пайванд хатост: «${text.slice(0, 40)}»`)
      const id = youtubeIdOf(text)
      if (!id) return fail(`пайванд хатост: дар <${name}> танҳо пайванди YouTube ё файли боршуда (медиа:…) қабул мешавад`)
      return { type: 'youtube', props: { video_id: id }, content: meta, line }
    }
    case 'audio': {
      if (!text) return fail(`<${name}> холӣ аст: файлро гиред (тугмаи «Файлро гиред»)`)
      const ref = text.match(MEDIA_REF)
      if (!ref) return fail(`пайванд хатост: дар <${name}> файли боршуда (медиа:…) лозим аст`)
      return { type: 'audio', props: { asset_id: ref[1] }, content: { ...(attrs['ном'] ? { title: attrs['ном'] } : {}), ...(attrs['гӯянда'] ? { speaker: attrs['гӯянда'] } : {}), ...(source ? { source } : {}) }, line }
    }
    default:
      return null
  }
}

/** A stored block, as the lesson keeps it: props shared, text per language. */
export interface StoredBlock { id?: string; type: string; props: Record<string, unknown>; content: Record<string, unknown> }

const q = (s: unknown) => String(s ?? '').replace(/"/g, '”')
const attrs = (pairs: [string, unknown][]) => pairs.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ` ${k}="${q(v)}"`).join('')
const CALLOUT_TAG: Record<string, string> = { important: 'муҳим', warning: 'огоҳӣ', note: 'қайд', tip: 'маслиҳат', info: 'маълумот' }

/** Writes a lesson's blocks as code, in one language. Blocks CodeHub cannot write stay as <нигоҳ id="…"/>. */
export function toCode(blocks: StoredBlock[], loc: string): string {
  return blocks.map((b) => {
    const c = (b.content?.[loc] ?? {}) as Record<string, unknown>
    const p = b.props ?? {}
    switch (b.type) {
      case 'heading': return p.level === 3 ? `<зерсарлавҳа>${fromRich(c)}</зерсарлавҳа>` : `<сарлавҳа>${fromRich(c)}</сарлавҳа>`
      case 'lead': return `<муқаддима>${fromRich(c)}</муқаддима>`
      case 'paragraph': return `<сатр>${fromRich(c)}</сатр>`
      case 'bullet_list':
      case 'ordered_list': {
        const tag = b.type === 'ordered_list' ? 'рӯйхати рақамдор' : 'рӯйхат'
        return `<${tag}>\n${((c.items as unknown[]) ?? []).map(fromRich).join('\n')}\n</${tag}>`
      }
      case 'quote': return `<иқтибос${attrs([['муаллиф', c.author], ['манбаъ', c.source]])}>${fromRich(c.text)}</иқтибос>`
      case 'callout': {
        const tag = CALLOUT_TAG[p.variant as string] ?? 'қайд'
        return `<${tag}${attrs([['сарлавҳа', c.title]])}>${fromRich(c.body)}</${tag}>`
      }
      case 'practical_task': return `<супориш${attrs([['сарлавҳа', c.title]])}>${fromRich(c.body)}</супориш>`
      case 'source': return `<манбаъ${attrs([['муаллиф', c.author], ['сол', c.year], ['пайванд', p.url]])}>${c.title && c.title !== p.url ? c.title : ''}</манбаъ>`
      case 'image': return p.asset_id ? `<расм${attrs([['тавсиф', c.caption], ['манбаъ', c.source]])}>медиа:${p.asset_id}</расм>` : `<нигоҳ id="${b.id ?? ''}"/>`
      case 'youtube': return p.video_id ? `<видео${attrs([['ном', c.title], ['тавсиф', c.caption], ['манбаъ', c.source]])}>https://youtu.be/${p.video_id}</видео>` : `<нигоҳ id="${b.id ?? ''}"/>`
      case 'video': return p.asset_id ? `<видео${attrs([['ном', c.title], ['тавсиф', c.caption], ['манбаъ', c.source]])}>медиа:${p.asset_id}</видео>` : `<нигоҳ id="${b.id ?? ''}"/>`
      case 'audio': return p.asset_id ? `<аудио${attrs([['ном', c.title], ['гӯянда', c.speaker], ['манбаъ', c.source]])}>медиа:${p.asset_id}</аудио>` : `<нигоҳ id="${b.id ?? ''}"/>`
      case 'divider': return '<ҷудокунанда/>'
      default: return `<нигоҳ id="${b.id ?? ''}"/>`
    }
  }).join('\n\n')
}

/**
 * The lesson's new block list from code written in one language. A block keeps its id and the other
 * languages' text when it stays where it was with the same type; <нигоҳ id="…"/> keeps a block whole.
 */
export function mergeCode(existing: StoredBlock[], parsed: CodeBlock[], loc: string): StoredBlock[] {
  const byId = new Map(existing.filter((b) => b.id).map((b) => [b.id!, b]))
  const used = new Set<string>()
  return parsed.flatMap((nb, i) => {
    if (nb.type === 'keep') {
      const kept = nb.keep ? byId.get(nb.keep) : undefined
      if (!kept || used.has(kept.id!)) return []
      used.add(kept.id!)
      return [kept]
    }
    const old = existing[i]
    const same = old && old.id && !used.has(old.id) && old.type === nb.type ? old : null
    if (same) used.add(same.id!)
    return [{
      ...(same ? { id: same.id } : {}),
      type: nb.type,
      props: { ...(same?.props ?? {}), ...nb.props },
      content: { ...(same?.content ?? {}), [loc]: nb.content }
    }]
  })
}
