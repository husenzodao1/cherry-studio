'use client'

import { useState } from 'react'

import { ErrorState, Loading } from '../components/States'
import { browserSupabase } from '../supabase-browser'
import { useApi } from '../useApi'
import { Field, Note, sendNow, useAction } from './ui'

/**
 * The home screen's news and the schools' Library: written here. A picture, a cover or a book is put straight
 * into the public media storage (a signed upload), then saved with what it belongs to.
 */

const LANGS = [['', 'Ҳамаи забонҳо'], ['tg', 'Тоҷикӣ'], ['ru', 'Русский'], ['en', 'English'], ['uz', "O'zbek"], ['tr', 'Türkçe'], ['fa', 'فارسی'], ['prs', 'دری']] as const
const AUDIENCES = [['all', 'Ҳама'], ['girls', 'Духтарон'], ['boys', 'Писарон']] as const

interface News { id: string; title: string; body: string; image: string | null; locale: string | null; audience: string; at: string }
interface Book { id: string; title: string; author: string | null; cover: string | null; file: string | null; published: boolean }
interface Shelf { id: string; title: string; emoji: string | null; books: Book[] }

/** a file into the media storage: its path there */
async function store(file: File, kind: 'image' | 'file'): Promise<string> {
  const slot = await sendNow<{ bucket: 'media'; path: string; token: string }>('/admin/media/upload-url', 'POST', { bucket: 'media', kind, filename: file.name })
  const { error } = await browserSupabase()!.storage.from(slot.bucket).uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type })
  if (error) throw error
  return slot.path
}

export function NewsLibrary() {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <NewsAdmin />
      <LibraryAdmin />
    </div>
  )
}

function NewsAdmin() {
  const list = useApi<{ items: News[] }>('/admin/news')
  const act = useAction()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [locale, setLocale] = useState('')
  const [audience, setAudience] = useState('all')
  const save = async () => {
    const ok = await act.run(async () => {
      const image_path = image ? await store(image, 'image') : null
      return sendNow('/admin/news', 'POST', { title, body, image_path, locale: locale || null, audience })
    }, 'Хабар нашр шуд')
    if (ok) { setTitle(''); setBody(''); setImage(null); list.reload() }
  }
  const remove = async (id: string) => { if (await act.run(() => sendNow(`/admin/news/${id}`, 'DELETE'), 'Хабар нест карда шуд')) list.reload() }
  return (
    <section className="card card-pad stack" style={{ gap: 10 }}>
      <h2 className="h-section" style={{ margin: 0 }}>📰 Хабарҳо (дар саҳифаи асосӣ)</h2>
      <Field label="Сарлавҳа"><input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} /></Field>
      <Field label="Матн"><textarea className="input" rows={5} value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} /></Field>
      <Field label="Расм (ихтиёрӣ)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImage(e.target.files?.[0] ?? null)} /></Field>
      <div className="row" style={{ gap: 8 }}>
        <select className="input" value={locale} onChange={(e) => setLocale(e.target.value)}>{LANGS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
        <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>{AUDIENCES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>
      </div>
      <button type="button" className="btn" disabled={act.busy || !title.trim()} onClick={() => void save()}>Нашр кардан</button>
      <Note message={act.message} />
      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : (
        <div className="stack" style={{ gap: 6 }}>
          {list.data.items.map((n) => (
            <div key={n.id} className="row admin-news-row" style={{ gap: 10, alignItems: 'center' }}>
              {n.image ? <img src={n.image} alt="" width={48} height={48} style={{ objectFit: 'cover', borderRadius: 10 }} /> : <span style={{ width: 48 }} />}
              <span className="grow"><b>{n.title}</b><br /><span className="muted" style={{ fontSize: '0.82em' }}>{new Date(n.at).toLocaleString('ru')} · {n.locale ?? 'ҳама'} · {n.audience}</span></span>
              <button type="button" className="btn btn-soft" onClick={() => void remove(n.id)}>Нест кардан</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function LibraryAdmin() {
  const lib = useApi<{ shelves: Shelf[] }>('/admin/library')
  const act = useAction()
  const [shelf, setShelf] = useState('')
  const [emoji, setEmoji] = useState('📚')
  const [book, setBook] = useState({ shelf_id: '', title: '', author: '', about: '' })
  const [cover, setCover] = useState<File | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const addShelf = async () => {
    if (await act.run(() => sendNow('/admin/library/shelves', 'POST', { title: shelf, emoji: emoji || null, position: lib.data?.shelves.length ?? 0 }), 'Раф илова шуд')) { setShelf(''); lib.reload() }
  }
  const addBook = async () => {
    const ok = await act.run(async () => {
      const cover_path = cover ? await store(cover, 'image') : null
      const file_path = file ? await store(file, 'file') : null
      return sendNow('/admin/library/books', 'POST', { shelf_id: book.shelf_id, title: book.title, author: book.author || null, about: book.about || null, cover_path, file_path })
    }, 'Китоб ба раф гузошта шуд')
    if (ok) { setBook({ ...book, title: '', author: '', about: '' }); setCover(null); setFile(null); lib.reload() }
  }
  const toggle = async (b: Book) => { if (await act.run(() => sendNow(`/admin/library/books/${b.id}`, 'PATCH', { published: !b.published }))) lib.reload() }
  const removeBook = async (b: Book) => { if (await act.run(() => sendNow(`/admin/library/books/${b.id}`, 'DELETE'), 'Китоб нест карда шуд')) lib.reload() }
  const removeShelf = async (s: Shelf) => { if (await act.run(() => sendNow(`/admin/library/shelves/${s.id}`, 'DELETE'), 'Раф нест карда шуд')) lib.reload() }
  return (
    <section className="card card-pad stack" style={{ gap: 10 }}>
      <h2 className="h-section" style={{ margin: 0 }}>📚 Китобхона (дар мактабҳо)</h2>
      <div className="row" style={{ gap: 8 }}>
        <input className="input" style={{ maxWidth: 64 }} value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} aria-label="Эмодзи" />
        <input className="input grow" placeholder="Раф (категория), масалан: Адабиёти классикӣ" value={shelf} maxLength={120} onChange={(e) => setShelf(e.target.value)} />
        <button type="button" className="btn" disabled={act.busy || !shelf.trim()} onClick={() => void addShelf()}>Раф</button>
      </div>
      {lib.data?.shelves.length ? (
        <div className="stack" style={{ gap: 8 }}>
          <Field label="Китоби нав">
            <select className="input" value={book.shelf_id} onChange={(e) => setBook({ ...book, shelf_id: e.target.value })}>
              <option value="">— раф —</option>
              {lib.data.shelves.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.title}</option>)}
            </select>
          </Field>
          <input className="input" placeholder="Номи китоб" value={book.title} maxLength={300} onChange={(e) => setBook({ ...book, title: e.target.value })} />
          <input className="input" placeholder="Муаллиф" value={book.author} maxLength={200} onChange={(e) => setBook({ ...book, author: e.target.value })} />
          <textarea className="input" rows={3} placeholder="Дар бораи китоб" value={book.about} maxLength={4000} onChange={(e) => setBook({ ...book, about: e.target.value })} />
          <Field label="Муқова (расм)"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></Field>
          <Field label="Китоб (PDF)"><input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <button type="button" className="btn" disabled={act.busy || !book.shelf_id || !book.title.trim()} onClick={() => void addBook()}>Ба раф гузоштан</button>
        </div>
      ) : null}
      <Note message={act.message} />
      {lib.error ? <ErrorState error={lib.error} onRetry={lib.reload} /> : !lib.data ? <Loading /> : lib.data.shelves.map((s) => (
        <div key={s.id} className="stack" style={{ gap: 6 }}>
          <div className="row" style={{ alignItems: 'center', gap: 8 }}>
            <b className="grow">{s.emoji} {s.title} · {s.books.length}</b>
            <button type="button" className="link-btn" onClick={() => void removeShelf(s)}>Нест кардани раф</button>
          </div>
          {s.books.map((b) => (
            <div key={b.id} className="row" style={{ gap: 10, alignItems: 'center', opacity: b.published ? 1 : 0.55 }}>
              {b.cover ? <img src={b.cover} alt="" width={36} height={50} style={{ objectFit: 'cover', borderRadius: 4 }} /> : <span style={{ width: 36 }} />}
              <span className="grow">{b.title}{b.author ? ` — ${b.author}` : ''}{b.file ? ' 📄' : ''}</span>
              <button type="button" className="btn btn-soft" onClick={() => void toggle(b)}>{b.published ? 'Пинҳон' : 'Нашр'}</button>
              <button type="button" className="btn btn-soft" onClick={() => void removeBook(b)}>×</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}
