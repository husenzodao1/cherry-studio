'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Icon } from '@/web/components/Icon'
import { Empty, ErrorState } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

interface Hit { type: 'school' | 'course' | 'module' | 'topic' | 'lesson'; id: string; title: string; snippet?: string | null }
const HREF: Record<Hit['type'], (id: string) => string | null> = {
  school: (id) => `/schools/${id}`, course: (id) => `/courses/${id}`, lesson: (id) => `/lessons/${id}`, module: () => null, topic: () => null
}

export default function SearchPage() {
  const { t, locale } = usePrefs()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const h = setTimeout(() => setDebounced(q.trim()), 300)
    return () => clearTimeout(h)
  }, [q])
  const hits = useApi<Hit[]>(debounced.length >= 2 ? `/search?q=${encodeURIComponent(debounced)}&locale=${locale}` : null)
  return (
    <>
      <header className="topbar">
        <Link href="/" className="icon-btn" aria-label={t('action.back')}><Icon name="back" /></Link>
        <label style={{ flex: 1, position: 'relative' }}>
          <span className="sr-only">{t('action.search')}</span>
          <input className="input" type="search" autoFocus placeholder={t('action.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </header>
      <div className="section" aria-live="polite">
        {hits.error ? <ErrorState error={hits.error} /> : null}
        {hits.data && hits.data.length === 0 ? <Empty title={t('state.empty_search')} /> : null}
        {hits.data?.map((h) => {
          const href = HREF[h.type](h.id)
          const body = (<><div className="eyebrow">{h.type}</div><b style={{ fontWeight: 500 }}>{h.title}</b>{h.snippet ? <div className="muted" style={{ fontSize: '0.9em' }}>{h.snippet}</div> : null}</>)
          return href
            ? <Link key={`${h.type}-${h.id}`} href={href} className="card card-pad" style={{ textDecoration: 'none' }}>{body}</Link>
            : <div key={`${h.type}-${h.id}`} className="card card-pad">{body}</div>
        })}
      </div>
    </>
  )
}
