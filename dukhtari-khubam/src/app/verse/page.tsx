'use client'

import { useState } from 'react'

import { Header } from '@/web/components/Header'
import { VERSE_ART } from '@/web/components/PoemTile'
import { Empty } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { lines } from '@/web/offline/notify'
import { usePrefs } from '@/web/prefs'

type Work = { id: string; body: string; author_name?: string | null; source_title?: string | null; kind: 'poem' | 'story' }

/** One work: a poem keeps its lines, one per row; a story flows on (a blank line starts a paragraph). */
function WorkCard({ w, i }: { w: Work; i: number }) {
  const { t } = usePrefs()
  const [open, setOpen] = useState(false)
  const paragraphs = w.body.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
  const long = w.kind === 'story' ? w.body.length > 420 : lines(w.body).length > 8
  return (
    <article className={`verse-card${w.kind === 'story' ? ' is-story' : ''}${open || !long ? ' is-open' : ''}`} style={{ ['--i' as string]: i }}>
      <span className="verse-kind">{t(w.kind === 'story' ? 'verse.story' : 'verse.poem')}</span>
      {w.source_title ? <h2 className="verse-title">{w.source_title}</h2> : null}
      <div className="verse-body">
        {w.kind === 'poem'
          ? lines(w.body).map((l, n) => <span key={n} className="verse-line">{l}</span>)
          : paragraphs.map((p, n) => <p key={n}>{p}</p>)}
      </div>
      {long ? (
        <button type="button" className="link-btn verse-more" onClick={() => setOpen(!open)}>{t(open ? 'verse.less' : 'verse.more')}</button>
      ) : null}
      {w.author_name ? <p className="verse-author">— {w.author_name}</p> : null}
    </article>
  )
}

/** "Гулбоғи эҷод": the poems and stories from the panel, newest first, with a filter by kind. */
export default function Verse() {
  const { t } = usePrefs()
  const { bundle } = useContent()
  const [only, setOnly] = useState<'all' | 'poem' | 'story'>('all')
  const works: Work[] = [
    ...(bundle?.poems ?? []).map((p) => ({ ...p, kind: 'poem' as const })),
    ...(bundle?.stories ?? []).map((s) => ({ ...s, kind: 'story' as const }))
  ]
  const shown = works.filter((w) => only === 'all' || w.kind === only)
  return (
    <>
      <Header back="/schools" title={t('poem.title')} />
      <div className="verse-head">
        <img src={VERSE_ART} alt="" aria-hidden="true" className="bloom-in" />
        <p className="muted">{t('verse.hint')}</p>
      </div>
      {works.length ? (
        <div className="segmented" role="tablist" style={{ marginTop: 6 }}>
          {(['all', 'poem', 'story'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={only === k} onClick={() => setOnly(k)}>
              {t(k === 'all' ? 'home.all' : k === 'poem' ? 'verse.poems' : 'verse.stories')}
            </button>
          ))}
        </div>
      ) : null}
      <section className="section">
        {shown.length ? shown.map((w, i) => <WorkCard key={`${w.kind}-${w.id}`} w={w} i={i} />) : <Empty icon="book" title={t('verse.empty')} />}
      </section>
    </>
  )
}
