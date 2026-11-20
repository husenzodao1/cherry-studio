'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { MEDIA_TAGS, mergeCode, parseCode, TAGS, toCode, type StoredBlock } from '@/lib/codehub'

import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { MediaPicker } from './Media'
import { LocaleTabs, Note, sendNow, useAction, type Loc } from './ui'

/**
 * CodeHub: the lesson written as simple Tajik tags (lib/codehub.ts) instead of block by block. Mistakes
 * are listed with their line as you type; inside <расм>, <видео> or <аудио> a "Файлро гиред" panel
 * appears by itself to upload a file from the phone or pick one, and puts it into the tag.
 */

const SNIPPETS: { label: string; code: string }[] = [
  { label: 'Сарлавҳа', code: '<сарлавҳа>|</сарлавҳа>' },
  { label: 'Сатр', code: '<сатр>|</сатр>' },
  { label: 'Рӯйхат', code: '<рӯйхат>\n|\n</рӯйхат>' },
  { label: 'Расм', code: '<расм тавсиф="" манбаъ="">|</расм>' },
  { label: 'Видео', code: '<видео ном="" тавсиф="" манбаъ="">|</видео>' },
  { label: 'Аудио', code: '<аудио ном="" гӯянда="">|</аудио>' },
  { label: 'Иқтибос', code: '<иқтибос муаллиф="" манбаъ="">|</иқтибос>' },
  { label: 'Муҳим', code: '<муҳим сарлавҳа="">|</муҳим>' },
  { label: 'Маслиҳат', code: '<маслиҳат сарлавҳа="">|</маслиҳат>' },
  { label: 'Супориш', code: '<супориш сарлавҳа="">|</супориш>' },
  { label: 'Манбаъ', code: '<манбаъ муаллиф="" сол="" пайванд="">|</манбаъ>' },
  { label: 'Ҷудокунанда', code: '<ҷудокунанда/>|' }
]

/** The media tag the cursor stands in (its name and where its text starts and ends), if any. */
function mediaTagAt(code: string, at: number): { name: string; from: number; to: number } | null {
  const before = code.slice(0, at)
  let best: { name: string; open: number } | null = null
  for (const name of MEDIA_TAGS) {
    const i = before.lastIndexOf(`<${name}`)
    if (i >= 0 && /[\s>]/.test(before[i + name.length + 1] ?? '>') && (!best || i > best.open)) best = { name, open: i }
  }
  if (!best) return null
  const gt = code.indexOf('>', best.open)
  if (gt < 0) return null
  const close = code.slice(gt + 1).search(new RegExp(`</?${best.name}[\\s>]`))
  const to = close < 0 ? code.length : gt + 1 + close
  // the cursor is between the tag's «>» and its closing
  return at > gt && at <= to ? { name: best.name, from: gt + 1, to } : null
}

export function CodeHub({ lessonId }: { lessonId: string }) {
  const doc = useApi<{ version: number; blocks: StoredBlock[] }>(`/admin/lessons/${lessonId}/blocks`)
  const [stored, setStored] = useState<StoredBlock[] | null>(null)
  const [version, setVersion] = useState<number | null>(null)
  const [loc, setLoc] = useState<Loc>('tg')
  const [code, setCode] = useState('')
  const [cursor, setCursor] = useState(0)
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const act = useAction()

  // after a save the lesson is read again: new blocks get their ids from the server
  const refreshing = useRef(false)
  useEffect(() => {
    if (!doc.data) return
    if (stored === null) {
      setStored(doc.data.blocks)
      setVersion(doc.data.version)
      setCode(toCode(doc.data.blocks, loc))
    } else if (refreshing.current) {
      refreshing.current = false
      setStored(doc.data.blocks)
      setVersion(doc.data.version)
    }
  }, [doc.data, stored, loc])

  const parsed = useMemo(() => parseCode(code), [code])
  const media = mediaTagAt(code, cursor)

  if (doc.error) return <ErrorState error={doc.error} onRetry={doc.reload} />
  if (!stored) return <Loading />

  const lines = code.split('\n').length
  const switchLoc = (l: Loc) => {
    setLoc(l)
    setCode(toCode(stored, l))
  }
  const insert = (snippet: string) => {
    const el = area.current
    const start = el?.selectionStart ?? code.length
    const end = el?.selectionEnd ?? start
    const [head, tail] = snippet.split('|')
    const pre = start > 0 && code[start - 1] !== '\n' ? '\n' : ''
    const next = code.slice(0, start) + pre + head + (tail ?? '') + code.slice(end)
    const caret = start + pre.length + head.length
    setCode(next)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(caret, caret); setCursor(caret) })
  }
  const putFile = (id: string) => {
    if (!media) return
    const next = code.slice(0, media.from) + `медиа:${id}` + code.slice(media.to)
    setCode(next)
    const caret = media.from + `медиа:${id}`.length
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(caret, caret); setCursor(caret) })
  }
  const goTo = (line: number) => {
    const el = area.current
    if (!el) return
    const at = code.split('\n').slice(0, line - 1).join('\n').length + (line > 1 ? 1 : 0)
    el.focus()
    el.setSelectionRange(at, at)
    setCursor(at)
    el.scrollTop = Math.max(0, (line - 3) * 22)
  }
  const save = async () => {
    const blocks = mergeCode(stored, parsed.blocks, loc)
    const r = await act.run(() => sendNow<{ version: number }>(`/admin/lessons/${lessonId}/blocks`, 'PUT', {
      expected_version: version,
      blocks: blocks.map((b) => ({ ...(b.id ? { id: b.id } : {}), type: b.type, schema_version: 1, props: b.props, content: b.content }))
    }), 'Дарс сабт шуд')
    if (r && typeof r.version === 'number') {
      setVersion(r.version)
      refreshing.current = true
      doc.reload()
    }
  }

  return (
    <div className="stack codehub">
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <LocaleTabs value={loc} onChange={switchLoc} />
        <span className="muted" style={{ fontSize: '0.82em' }}>**ғафс**, *курсив* · тег бо &lt;/тег&gt; ё бо худи &lt;тег&gt; пӯшида мешавад</span>
      </div>
      <div className="codehub-tools" role="toolbar" aria-label="Тегҳо">
        {SNIPPETS.map((s) => <button key={s.label} type="button" className="chip" onClick={() => insert(s.code)}>{s.label}</button>)}
      </div>
      <div className="codehub-editor">
        <div ref={gutter} className="codehub-lines" aria-hidden="true">
          {Array.from({ length: lines }, (_, n) => <span key={n} className={parsed.errors.some((e) => e.line === n + 1) ? 'is-bad' : undefined}>{n + 1}</span>)}
        </div>
        <textarea ref={area} className="codehub-code" value={code} spellCheck={false} autoCapitalize="none" autoCorrect="off" aria-label="Коди дарс"
          onChange={(e) => { setCode(e.target.value); setCursor(e.target.selectionStart) }}
          onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
          onKeyUp={(e) => setCursor(e.currentTarget.selectionStart)}
          onClick={(e) => setCursor(e.currentTarget.selectionStart)}
          onScroll={(e) => { if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop }} />
      </div>
      {media ? (
        <div className="card card-pad stack codehub-file" style={{ gap: 8 }}>
          <b>Файлро гиред — &lt;{media.name}&gt;</b>
          <MediaPicker kind={media.name === 'расм' ? 'image' : media.name === 'видео' ? 'video' : 'audio'}
            value={code.slice(media.from, media.to).trim().match(/^медиа:(\S+)$/)?.[1]} onChange={putFile} />
          {media.name === 'видео' ? <span className="muted" style={{ fontSize: '0.82em' }}>Ё пайванди YouTube-ро дар байни теги &lt;видео&gt; гузоред.</span> : null}
        </div>
      ) : null}
      {parsed.errors.length ? (
        <ul className="codehub-errors" role="alert">
          {parsed.errors.map((e, n) => (
            <li key={n}><button type="button" onClick={() => goTo(e.line)}>Хатогӣ дар сатри {e.line}: {e.message}</button></li>
          ))}
        </ul>
      ) : <p className="codehub-ok">✓ Хатогӣ нест · {parsed.blocks.length} блок</p>}
      <button type="button" className="btn" onClick={save} disabled={act.busy || parsed.errors.length > 0}>Сабти дарс</button>
      <Note message={act.message} />
      <details className="codehub-help">
        <summary>Ҳамаи тегҳо</summary>
        <ul>{Object.entries(TAGS).filter(([n]) => n !== 'нигоҳ').map(([n, s]) => (
          <li key={n}><code>&lt;{n}{s.attrs.map((a) => ` ${a}=""`).join('')}{s.empty ? '/' : ''}&gt;</code></li>
        ))}</ul>
        <p className="muted" style={{ margin: 0 }}><code>&lt;нигоҳ id="…"/&gt;</code> — блокҳое, ки дар CodeHub навишта намешаванд (галерея, ҷадвал…), бетағйир мемонанд.</p>
      </details>
    </div>
  )
}
