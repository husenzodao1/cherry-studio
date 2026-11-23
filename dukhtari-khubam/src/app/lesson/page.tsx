'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

import { lessonTest, stageState } from '@/lib/stage'
import { BlockView } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { say } from '@/web/components/Mascot'
import { StageDone } from '@/web/components/StageDone'
import { Empty, Loading } from '@/web/components/States'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { usePrefs } from '@/web/prefs'
import { useQueryParam } from '@/web/useQueryParam'
import { emojify } from '@/web/components/Emoji'

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
  const [stageDone, setStageDone] = useState(false)
  const router = useRouter()
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
  if (!l) return <Empty title={t('state.not_found')} />
  const test = lessonTest(bundle, id)
  /** A lesson without a test is finished by the button; the last one may finish the stage. */
  const finish = () => {
    const course = l.context.course.id
    const before = stageState(bundle, progress, course)
    completeLesson(id)
    say('lessonDone')
    const after = stageState(bundle, { ...progress, lessons: { ...progress.lessons, [id]: { ...progress.lessons[id], done: new Date().toISOString() } } }, course)
    if (after.read && after.hasFinal && !after.finalPassed) router.push(`/quiz?final=${course}`)
    else if (after.complete && !before.complete) setStageDone(true)
  }

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
        {emojify(l.context.course.title)}
        {l.position.index ? ` · ${t('lesson.lesson')} ${l.position.index} ${t('lesson.of')} ${l.position.total}` : ''}
      </div>
      <h1>{emojify(l.title)}</h1>
      {l.summary ? <p className="lead">{l.summary}</p> : null}

      {l.locked ? (
        <div className="glass card-pad row" style={{ marginTop: 24 }}>
          <Icon name="lock" /> <b>{t('state.locked')}</b>
        </div>
      ) : (
        <div className="blocks">{l.blocks.map((b) => <BlockView key={b.id} block={b} assets={l.assets} />)}</div>
      )}

      {!l.locked ? (
        test ? (
          // the lesson ends with its test: finishing the test finishes the lesson
          <div className="lesson-end">
            <Link href={`/quiz?id=${test}&lesson=${id}`} className="btn btn-lg btn-block">
              <Icon name="check" size={18} /> {done ? t('lesson.retake_test') : t('lesson.mark_done')}
            </Link>
            {done ? null : <p className="muted lesson-end-hint">{t('lesson.test_hint')}</p>}
          </div>
        ) : (
          <button type="button" className="btn btn-soft" style={{ marginTop: 28 }} onClick={finish} disabled={done}>
            <Icon name="check" size={18} /> {done ? t('lesson.completed') : t('lesson.mark_done')}
          </button>
        )
      ) : null}
      {/* her small circle at the lower right: a tap asks her about what is unclear in this lesson */}
      {!l.locked ? (
        <button type="button" className="lesson-ask" aria-label={t('lesson.ask_mahliyo')}
          onClick={() => {
            try { sessionStorage.setItem('dk.ai.ask', t('lesson.ask_prefill').replace('{title}', l.title)) } catch { /* storage blocked: the chat opens empty */ }
            router.push('/mahliyo')
          }}>
          <img src="/assets/mascot/face.webp" alt="" aria-hidden="true" />
        </button>
      ) : null}
      {stageDone ? <StageDone course={l.context.course.title} school={l.context.school.title} onClose={() => setStageDone(false)} /> : null}

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
