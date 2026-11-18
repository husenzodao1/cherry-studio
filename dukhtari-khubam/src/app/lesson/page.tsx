'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'

import { BlockView } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { Empty, Loading } from '@/web/components/States'
import { LiquidGlass } from '@/web/glass/LiquidGlass'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

const SCALES = [1, 1.12, 1.25, 0.92]

export default function LessonPage() {
  return <Suspense fallback={<Loading />}><Lesson /></Suspense>
}

function Lesson() {
  const id = useQueryParam('id')
  const { t, textScale, set } = usePrefs()
  const { bundle, loading } = useContent()
  const { progress, readLesson, completeLesson, toggleBookmark } = useLearner()
  const l = bundle?.lessons[id]
  const saved = !!progress.bookmarks[id]?.on
  const done = !!progress.lessons[id]?.done
  const [read, setRead] = useState(0)
  const maxRead = useRef(0)
  const readRef = useRef(readLesson)
  readRef.current = readLesson

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const pct = Math.min(100, Math.round(((h.scrollTop + h.clientHeight) / Math.max(h.scrollHeight, 1)) * 100))
      setRead(pct)
      maxRead.current = Math.max(maxRead.current, pct)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [l])

  // reading progress is saved on the phone every few seconds and when leaving the lesson
  useEffect(() => {
    if (!l || l.locked) return
    maxRead.current = 0
    const push = () => {
      if (maxRead.current > 0) readRef.current(id, Math.min(maxRead.current, 99))
    }
    const timer = setInterval(push, 5000)
    return () => {
      clearInterval(timer)
      push()
    }
  }, [l, id])

  if (!bundle) return loading ? <Loading /> : <p className="muted">{t('state.offline_empty')}</p>
  if (!l) return <Empty title={t('state.empty_courses')} />

  return (
    <article className="reader" lang={l.locale} dir={l.locale === 'ar' ? 'rtl' : 'ltr'}>
      <div role="progressbar" aria-label={t('section.progress')} aria-valuenow={read} aria-valuemin={0} aria-valuemax={100}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'var(--lilac)', zIndex: 50 }}>
        <div style={{ width: `${read}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--plum))' }} />
      </div>
      <header className="topbar" style={{ position: 'sticky', top: 8, zIndex: 30 }}>
        <Link href={`/course?id=${l.context.course.id}`} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
        <span className="spacer" />
        <button type="button" className="icon-btn" aria-pressed={saved} aria-label={saved ? t('action.saved') : t('action.save')} onClick={() => toggleBookmark(id)}>
          <Icon name="bookmark" fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="icon-btn" aria-label={t('action.text_size')}
          onClick={() => set({ textScale: SCALES[(SCALES.indexOf(textScale) + 1) % SCALES.length] ?? 1 })}>
          <Icon name="text" />
        </button>
      </header>

      <div className="eyebrow" style={{ marginTop: 12 }}>
        {l.context.school.title} · {l.context.course.title}
        {l.position.index ? ` · ${t('lesson.lesson')} ${l.position.index} ${t('lesson.of')} ${l.position.total}` : ''}
      </div>
      <h1>{l.title}</h1>
      {l.summary ? <p className="lead">{l.summary}</p> : null}

      {l.locked ? (
        <div className="card card-pad card-lilac row" style={{ marginTop: 24 }}>
          <Icon name="lock" /> <b>{t('state.locked')}</b>
        </div>
      ) : (
        <div className="blocks">{l.blocks.map((b) => <BlockView key={b.id} block={b} assets={l.assets} />)}</div>
      )}

      {!l.locked ? (
        <button type="button" className={`btn ${done ? 'btn-soft' : ''}`} style={{ marginTop: 28 }} onClick={() => completeLesson(id)} disabled={done}>
          <Icon name="check" size={18} /> {done ? t('lesson.completed') : t('lesson.mark_done')}
        </button>
      ) : null}

      <nav className="reader-nav" aria-label={t('section.lessons')}>
        {l.prev_lesson_id ? (
          <LiquidGlass radius={26} bezel={12} style={{ flex: 1 }}>
            <Link href={`/lesson?id=${l.prev_lesson_id}`} className="row" style={{ position: 'relative', zIndex: 2, minHeight: 52, justifyContent: 'center', textDecoration: 'none', fontWeight: 500 }}>
              <Icon name="back" size={16} /> {t('action.prev')}
            </Link>
          </LiquidGlass>
        ) : <span style={{ flex: 1 }} />}
        {l.next_lesson_id ? (
          <Link href={`/lesson?id=${l.next_lesson_id}`} className="btn" style={{ flex: 1, minHeight: 52 }}>{t('action.next')} <Icon name="forward" size={16} /></Link>
        ) : null}
      </nav>
    </article>
  )
}
