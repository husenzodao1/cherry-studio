'use client'

import Link from 'next/link'
import { Suspense, useEffect, useRef, useState } from 'react'

import { BlockView } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { say } from '@/web/components/Mascot'
import { Empty, Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'

// the same two sizes as in the settings: small and medium
const SCALES = [0.9, 1]

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
      <div className="read-bar" role="progressbar" aria-label={t('section.progress')} aria-valuenow={read} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${read}%` }} />
      </div>
      <header className="topbar" style={{ position: 'sticky', top: 'max(8px, env(safe-area-inset-top))', zIndex: 30 }}>
        <Link href={`/course?id=${l.context.course.id}`} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
        <span className="spacer" />
        <button type="button" className="icon-btn" aria-pressed={saved} aria-label={saved ? t('action.saved') : t('action.save')} onClick={() => toggleBookmark(id)}>
          <Icon name="bookmark" fill={saved ? 'currentColor' : 'none'} />
        </button>
        <button type="button" className="icon-btn" aria-label={t('action.text_size')}
          onClick={() => set({ textScale: SCALES[(SCALES.indexOf(textScale) + 1) % SCALES.length] ?? 1 })}>
          <span style={{ fontWeight: 600, fontSize: 15 }} aria-hidden="true">Aa</span>
        </button>
      </header>

      <div className="eyebrow" style={{ marginTop: 14 }}>
        {l.context.course.title}
        {l.position.index ? ` · ${t('lesson.lesson')} ${l.position.index} ${t('lesson.of')} ${l.position.total}` : ''}
      </div>
      <h1>{l.title}</h1>
      {l.summary ? <p className="lead">{l.summary}</p> : null}

      {l.locked ? (
        <div className="glass card-pad row" style={{ marginTop: 24 }}>
          <Icon name="lock" /> <b>{t('state.locked')}</b>
        </div>
      ) : (
        <div className="blocks">{l.blocks.map((b) => <BlockView key={b.id} block={b} assets={l.assets} />)}</div>
      )}

      {!l.locked ? (
        <button type="button" className="btn btn-soft" style={{ marginTop: 28 }} onClick={() => { completeLesson(id); say('lessonDone') }} disabled={done}>
          <Icon name="check" size={18} /> {done ? t('lesson.completed') : t('lesson.mark_done')}
        </button>
      ) : null}

      <nav className="reader-nav" aria-label={t('section.lessons')}>
        {l.prev_lesson_id ? (
          <Link href={`/lesson?id=${l.prev_lesson_id}`} className="icon-btn" style={{ width: 52, height: 52 }} aria-label={t('lesson.prev_page')}><Icon name="back" /></Link>
        ) : null}
        <span style={{ flex: 1 }} />
        {l.next_lesson_id ? (
          <Link href={`/lesson?id=${l.next_lesson_id}`} className="btn">
            {t('lesson.next_page')} <Icon name="arrow" size={16} />
          </Link>
        ) : null}
      </nav>
    </article>
  )
}
