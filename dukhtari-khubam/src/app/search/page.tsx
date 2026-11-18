'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Icon } from '@/web/components/Icon'
import { Empty, ErrorState } from '@/web/components/States'
import { usePrefs } from '@/web/prefs'
import { useApi } from '@/web/useApi'

interface Hit { type: 'school' | 'course' | 'module' | 'topic' | 'lesson'; id: string; title: string; snippet?: string | null }
// SHA-256 of the staff passphrase that opens the admin panel from search. Only the hash ships in the
// bundle; the panel itself is protected by the staff roles checked in the database.
const ADMIN_KEY = '23dbbe5ca1da746b77afa49530cdf0dce81e513182b05f2ff9bfe43a72ecb732'

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const HREF: Record<Hit['type'], (id: string) => string | null> = {
  school: (id) => `/schools/${id}`, course: (id) => `/courses/${id}`, lesson: (id) => `/lessons/${id}`, module: () => null, topic: () => null
}

export default function SearchPage() {
  const { t, locale } = usePrefs()
  const router = useRouter()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    let alive = true
    const typed = q.trim()
    // the passphrase is checked before any search request, so it never reaches the API or its logs
    const h = setTimeout(async () => {
      if (typed.length >= 8 && (await sha256(typed)) === ADMIN_KEY) {
        if (alive) router.push('/admin')
        return
      }
      if (alive) setDebounced(typed)
    }, 300)
    return () => {
      alive = false
      clearTimeout(h)
    }
  }, [q, router])
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
