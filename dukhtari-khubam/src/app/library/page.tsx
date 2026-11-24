'use client'

import { useEffect, useMemo, useState } from 'react'

import { DocViewer } from '@/web/components/DocViewer'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { Empty, Skeleton } from '@/web/components/States'
import { apiUrl } from '@/web/offline/base'
import { usePrefs } from '@/web/prefs'

/**
 * The schools' Library: the books the staff chose, standing on shelves by category, each with its cover. A
 * tapped book comes forward, its cover large, with what it is about and "Read" (the book opens in the app).
 * A search finds a book by its title or its author. Kept on the phone for when it is offline.
 */

interface Book { id: string; title: string; author: string | null; about: string | null; cover: string | null; file: string | null; pages: number | null }
interface Shelf { id: string; title: string; emoji: string | null; books: Book[] }
const KEY = 'dk.library'

/** letters as a search compares them (Tajik letters also typed as Russian ones) */
const plain = (s: string) => s.toLowerCase().replace(/[ӣ]/g, 'и').replace(/[ӯ]/g, 'у').replace(/[қ]/g, 'к').replace(/[ҳ]/g, 'х').replace(/[ҷ]/g, 'ч').replace(/[ғ]/g, 'г').replace(/ё/g, 'е')

export default function LibraryPage() {
  const { t, mode } = usePrefs()
  const [shelves, setShelves] = useState<Shelf[] | null>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Book | null>(null)
  const [reading, setReading] = useState<Book | null>(null)

  useEffect(() => {
    try { const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Shelf[] | null; if (kept) setShelves(kept) } catch { /* none kept */ }
    fetch(apiUrl(`/library?audience=${mode === 'boy' ? 'boys' : 'girls'}`)).then((r) => (r.ok ? r.json() as Promise<{ shelves: Shelf[] }> : null)).then((d) => {
      if (!d) return
      setShelves(d.shelves)
      try { localStorage.setItem(KEY, JSON.stringify(d.shelves)) } catch { /* only for now */ }
    }).catch(() => setShelves((s) => s ?? []))
  }, [mode])

  const shown = useMemo(() => {
    const words = plain(q.trim())
    const all = (shelves ?? []).filter((s) => s.books.length)
    if (!words) return all
    return all.map((s) => ({ ...s, books: s.books.filter((b) => plain(`${b.title} ${b.author ?? ''}`).includes(words)) })).filter((s) => s.books.length)
  }, [shelves, q])

  return (
    <>
      <Header back="/schools" title={t('lib.title')} />
      <label className="glass search-bar lib-search" style={{ marginTop: 18 }}>
        <Icon name="search" />
        <input className="grow" value={q} placeholder={t('lib.search')} aria-label={t('lib.search')} maxLength={80} onChange={(e) => setQ(e.target.value)} />
        {q ? <button type="button" className="nav-x" aria-label={t('action.close')} onClick={() => setQ('')}><Icon name="x" size={14} /></button> : null}
      </label>

      <div className="section lib">
        {shelves === null ? (
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} height={190} radius={22} />)
        ) : !shown.length ? (
          <Empty icon="book" title={q ? t('lib.none_found') : t('lib.empty')} />
        ) : shown.map((s) => (
          <section key={s.id} className="lib-shelf">
            <h2 className="lib-shelf-title"><span aria-hidden="true">{s.emoji ?? '📚'}</span>{s.title}<span className="muted">{s.books.length}</span></h2>
            <div className="lib-row">
              {s.books.map((b, i) => (
                <button key={b.id} type="button" className="lib-book" style={{ ['--i' as string]: i }} onClick={() => setOpen(b)} aria-label={b.title}>
                  {b.cover ? <img src={b.cover} alt="" loading="lazy" decoding="async" /> : <span className="lib-book-plain">{b.title}</span>}
                </button>
              ))}
            </div>
            <div className="lib-plank" aria-hidden="true" />
          </section>
        ))}
      </div>

      {open ? (
        <div className="lib-veil" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <div className="lib-open" onClick={(e) => e.stopPropagation()}>
            <div className="lib-open-cover">{open.cover ? <img src={open.cover} alt="" /> : <span className="lib-book-plain">{open.title}</span>}</div>
            <b className="lib-open-title">{open.title}</b>
            {open.author ? <span className="lib-open-author">{open.author}</span> : null}
            {open.about ? <p className="lib-open-about">{open.about}</p> : null}
            <div className="row" style={{ gap: 8, width: '100%' }}>
              <button type="button" className="btn btn-soft" onClick={() => setOpen(null)}>{t('action.close')}</button>
              <button type="button" className="btn grow" disabled={!open.file} onClick={() => { setReading(open); setOpen(null) }}>
                <Icon name="book" size={18} /> {open.file ? t('lib.read') : t('lib.no_file')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {reading?.file ? (
        <DocViewer doc={{ name: `${reading.title}.pdf`, kind: 'pdf', file: () => fetch(reading.file!).then((r) => r.blob()) }} onClose={() => setReading(null)} />
      ) : null}
    </>
  )
}
