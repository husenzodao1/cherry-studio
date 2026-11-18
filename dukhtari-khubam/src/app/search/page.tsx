'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { Icon } from '@/web/components/Icon'
import { Empty } from '@/web/components/States'
import { useContent, type Bundle } from '@/web/offline/content'
import { usePrefs } from '@/web/prefs'

interface Hit { type: 'school' | 'course' | 'lesson'; id: string; title: string; snippet?: string | null }

/** Plain text of a block's content, for searching lessons on the phone. */
function blockText(content: unknown): string {
  if (!content || typeof content !== 'object') return typeof content === 'string' ? content : ''
  if (Array.isArray(content)) return content.map(blockText).join(' ')
  return Object.entries(content as Record<string, unknown>)
    .map(([k, v]) => (k === 'text' && typeof v === 'string' ? v : blockText(v))).join(' ')
}

function searchBundle(bundle: Bundle, q: string): Hit[] {
  const needle = q.toLowerCase()
  const hits: Hit[] = []
  const snippet = (text: string) => {
    const i = text.toLowerCase().indexOf(needle)
    return i < 0 ? null : `${i > 30 ? '…' : ''}${text.slice(Math.max(0, i - 30), i + needle.length + 60)}…`
  }
  for (const s of bundle.schools) {
    if (`${s.title} ${s.description ?? ''}`.toLowerCase().includes(needle)) hits.push({ type: 'school', id: s.slug, title: s.title, snippet: s.description })
  }
  for (const c of Object.values(bundle.courses)) {
    if (`${c.title} ${c.description ?? ''}`.toLowerCase().includes(needle)) hits.push({ type: 'course', id: c.id, title: c.title, snippet: c.description })
  }
  for (const l of Object.values(bundle.lessons)) {
    const body = `${l.summary ?? ''} ${l.blocks.map((b) => blockText(b.content)).join(' ')}`
    if (l.title.toLowerCase().includes(needle)) hits.push({ type: 'lesson', id: l.id, title: l.title, snippet: l.summary })
    else {
      const sn = snippet(body)
      if (sn) hits.push({ type: 'lesson', id: l.id, title: l.title, snippet: sn })
    }
  }
  return hits.slice(0, 50)
}
// SHA-256 of the staff passphrase that opens the admin panel from search. Only the hash ships in the
// bundle; the panel itself is protected by the staff roles checked in the database.
const ADMIN_KEY = '23dbbe5ca1da746b77afa49530cdf0dce81e513182b05f2ff9bfe43a72ecb732'

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

const HREF: Record<Hit['type'], (id: string) => string> = {
  school: (id) => `/school?key=${encodeURIComponent(id)}`, course: (id) => `/course?id=${id}`, lesson: (id) => `/lesson?id=${id}`
}

export default function SearchPage() {
  const { t } = usePrefs()
  const { bundle } = useContent()
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
  const hits = useMemo(() => (bundle && debounced.length >= 2 ? searchBundle(bundle, debounced) : null), [bundle, debounced])
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
        {hits && hits.length === 0 ? <Empty title={t('state.empty_search')} /> : null}
        {hits?.map((h) => (
          <Link key={`${h.type}-${h.id}`} href={HREF[h.type](h.id)} className="card card-pad" style={{ textDecoration: 'none' }}>
            <div className="eyebrow">{h.type === 'school' ? t('nav.schools') : h.type === 'course' ? t('section.courses') : t('section.lessons')}</div>
            <b style={{ fontWeight: 500 }}>{h.title}</b>
            {h.snippet ? <div className="muted" style={{ fontSize: '0.9em' }}>{h.snippet}</div> : null}
          </Link>
        ))}
      </div>
    </>
  )
}
