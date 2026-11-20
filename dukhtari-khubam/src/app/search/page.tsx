'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { Empty } from '@/web/components/States'
import { useContent, type Bundle } from '@/web/offline/content'
import { usePrefs } from '@/web/prefs'
import { browserSupabase } from '@/web/supabase-browser'

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
// The staff passphrase opens the panel straight from search. It is the password of the panel's own staff
// account, checked by Supabase Auth (rate-limited); the app only carries the first 16 bits of its SHA-256,
// enough to skip ordinary queries but useless for guessing the passphrase offline.
const PANEL_EMAIL = 'panel@dukhtari-khubam.invalid'
const KEY_PREFIX = '23db'

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
  // the passphrase was recognised: the field's ring turns green while the panel opens
  const [opening, setOpening] = useState(false)
  useEffect(() => {
    let alive = true
    const typed = q.trim()
    // search runs on the phone; only text matching the passphrase prefix is sent, and only to Supabase Auth
    const h = setTimeout(async () => {
      if (typed.length >= 8 && (await sha256(typed)).startsWith(KEY_PREFIX)) {
        if (alive) setOpening(true)
        // the panel's code loads while the password is checked
        router.prefetch('/admin')
        const sb = browserSupabase()
        const signed = sb ? !(await sb.auth.signInWithPassword({ email: PANEL_EMAIL, password: typed }).catch(() => ({ error: true }))).error : false
        if (signed) {
          if (alive) router.push('/admin')
          return
        }
        if (alive) setOpening(false)
      } else if (alive) setOpening(false)
      if (alive) setDebounced(typed)
    }, typed.length >= 8 ? 120 : 300)
    return () => {
      alive = false
      clearTimeout(h)
    }
  }, [q, router])
  const hits = useMemo(() => (bundle && debounced.length >= 2 ? searchBundle(bundle, debounced) : null), [bundle, debounced])
  return (
    <>
      <Header back="/" title={t('action.search')} />
      <label className={`glass search-bar${opening ? ' is-opening' : ''}`} style={{ marginTop: 18 }} aria-busy={opening}>
        <Icon name="search" />
        <span className="sr-only">{t('action.search')}</span>
        <input type="search" autoFocus placeholder={t('search.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </label>
      <div className="section stagger" aria-live="polite" key={debounced}>
        {hits && hits.length === 0 ? <Empty icon="search" title={t('state.empty_search')} /> : null}
        {hits?.map((h) => (
          <Link key={`${h.type}-${h.id}`} href={HREF[h.type](h.id)} className="glass list-row">
            <span className="row-icon"><Icon name={h.type === 'school' ? 'cap' : h.type === 'course' ? 'layers' : 'book'} /></span>
            <span className="row-main">
              <b>{h.title}</b>
              <span className="row-sub">{h.snippet ?? (h.type === 'school' ? t('nav.schools') : h.type === 'course' ? t('section.courses') : t('section.lessons'))}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
