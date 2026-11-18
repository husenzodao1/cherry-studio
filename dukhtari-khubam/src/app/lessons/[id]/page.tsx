'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { api } from '@/web/api'
import { useAuth } from '@/web/auth'
import { BlockView, type Asset, type Block } from '@/web/components/Blocks'
import { Icon } from '@/web/components/Icon'
import { ErrorState, Loading } from '@/web/components/States'
import { LiquidGlass } from '@/web/glass/LiquidGlass'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

interface Lesson {
  id: string; title: string; summary?: string | null; locked: boolean; locale: string; estimated_minutes?: number | null
  context: { school: { title: string }; course: { id: string; title: string } }
  blocks: Block[]; assets: Record<string, Asset>
  position: { index: number | null; total: number }
  prev_lesson_id?: string | null; next_lesson_id?: string | null
  user?: { bookmarked: boolean; progress?: { status: string; percent: number } | null } | null
}

const SCALES = [1, 1.12, 1.25, 0.92]

export default function LessonPage() {
  const { id } = useParams<{ id: string }>()
  const { t, locale, textScale, set } = usePrefs()
  const { session } = useAuth()
  const lesson = useApi<Lesson>(`/lessons/${id}?locale=${locale}`)
  const [saved, setSaved] = useState<boolean | null>(null)
  const [done, setDone] = useState(false)
  const [read, setRead] = useState(0)
  const maxRead = useRef(0)

  useEffect(() => {
    setSaved(lesson.data?.user?.bookmarked ?? false)
    setDone(lesson.data?.user?.progress?.status === 'completed')
  }, [lesson.data])

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
  }, [lesson.data])

  // save reading progress periodically and when leaving
  useEffect(() => {
    if (!session || !lesson.data || lesson.data.locked) return
    const push = () => {
      if (maxRead.current > 0) api(`/me/lessons/${id}/progress`, { method: 'PUT', body: { percent: Math.min(maxRead.current, 99) } }).catch(() => undefined)
    }
    const timer = setInterval(push, 20000)
    return () => {
      clearInterval(timer)
      push()
    }
  }, [session, lesson.data, id])

  if (lesson.error) return <ErrorState error={lesson.error} onRetry={lesson.reload} />
  if (!lesson.data) return <Loading />
  const l = lesson.data

  const toggleSave = async () => {
    if (!session) return
    const next = !saved
    setSaved(next)
    await api(`/me/bookmarks/${id}`, { method: next ? 'PUT' : 'DELETE' }).catch(() => setSaved(!next))
  }
  const complete = async () => {
    setDone(true)
    await api(`/me/lessons/${id}/progress`, { method: 'PUT', body: { completed: true } }).catch(() => setDone(false))
  }

  return (
    <article className="reader" lang={l.locale} dir={l.locale === 'ar' ? 'rtl' : 'ltr'}>
      <div role="progressbar" aria-label={t('section.progress')} aria-valuenow={read} aria-valuemin={0} aria-valuemax={100}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'var(--lilac)', zIndex: 50 }}>
        <div style={{ width: `${read}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--plum))' }} />
      </div>
      <header className="topbar" style={{ position: 'sticky', top: 8, zIndex: 30 }}>
        <Link href={`/courses/${l.context.course.id}`} className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
        <span className="spacer" />
        {session ? (
          <button type="button" className="icon-btn" aria-pressed={!!saved} aria-label={saved ? t('action.saved') : t('action.save')} onClick={toggleSave}>
            <Icon name="bookmark" fill={saved ? 'currentColor' : 'none'} />
          </button>
        ) : null}
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

      {session && !l.locked ? (
        <button type="button" className={`btn ${done ? 'btn-soft' : ''}`} style={{ marginTop: 28 }} onClick={complete} disabled={done}>
          <Icon name="check" size={18} /> {done ? t('lesson.completed') : t('lesson.mark_done')}
        </button>
      ) : null}

      <nav className="reader-nav" aria-label={t('section.lessons')}>
        {l.prev_lesson_id ? (
          <LiquidGlass radius={26} bezel={12} style={{ flex: 1 }}>
            <Link href={`/lessons/${l.prev_lesson_id}`} className="row" style={{ position: 'relative', zIndex: 2, minHeight: 52, justifyContent: 'center', textDecoration: 'none', fontWeight: 500 }}>
              <Icon name="back" size={16} /> {t('action.prev')}
            </Link>
          </LiquidGlass>
        ) : <span style={{ flex: 1 }} />}
        {l.next_lesson_id ? (
          <Link href={`/lessons/${l.next_lesson_id}`} className="btn" style={{ flex: 1, minHeight: 52 }}>{t('action.next')} <Icon name="forward" size={16} /></Link>
        ) : null}
      </nav>
    </article>
  )
}
