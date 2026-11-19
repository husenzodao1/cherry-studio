'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import { Content } from '@/web/admin/Content'
import { MediaLibrary } from '@/web/admin/Media'
import { Support } from '@/web/admin/Support'
import { Texts } from '@/web/admin/Texts'
import { STATUS_LABEL } from '@/web/admin/ui'
import { Users } from '@/web/admin/Users'
import { useAuth } from '@/web/auth'
import { Icon } from '@/web/components/Icon'
import { ErrorState, Loading } from '@/web/components/States'
import { browserSupabase } from '@/web/supabase-browser'
import { useApi } from '@/web/useApi'

/**
 * Staff panel (opened from search with the staff passphrase). Every action goes through the same API
 * as the apps; the database checks the signed-in user's role for each read and write.
 */

type Tab = 'home' | 'support' | 'content' | 'media' | 'texts' | 'users'
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Панел' }, { id: 'support', label: 'Дастгирӣ' }, { id: 'content', label: 'Мундариҷа' }, { id: 'media', label: 'Медиа' },
  { id: 'texts', label: 'Матнҳо' }, { id: 'users', label: 'Корбарон' }
]

export default function AdminPage() {
  const { session, ready } = useAuth()
  const me = useApi<{ roles: string[] }>(session ? '/me' : null)
  const [tab, setTab] = useState<Tab>('home')

  if (!ready || (session && !me.data && !me.error)) return <Loading />
  if (!session) return <StaffLogin />
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />
  if (!me.data?.roles.length) {
    return (
      <div className="card card-pad stack" style={{ maxWidth: 480, margin: '40px auto 0' }}>
        <h1 className="h-page">Дастрасӣ нест</h1>
        <p className="muted" style={{ margin: 0 }}>Ин ҳисоб нақши кормандро надорад. Соҳиби сомона метавонад нақш диҳад.</p>
        <Link href="/" className="btn btn-soft btn-block">Ба саҳифаи асосӣ</Link>
      </div>
    )
  }

  return (
    <div className="stack" style={{ maxWidth: 860, margin: '0 auto' }}>
      <header className="topbar">
        <Link href="/" className="icon-btn" aria-label="Ба сомона"><Icon name="back" /></Link>
        <h1 className="h-page" style={{ flex: 1 }}>Идора</h1>
        <span className="muted" style={{ fontSize: '0.8em' }}>{me.data.roles.join(', ')}</span>
      </header>
      <nav className="scroller" role="tablist" style={{ gap: 6 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="chip" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      {tab === 'home' ? <Dashboard onGo={setTab} /> : tab === 'support' ? <Support /> : tab === 'content' ? <Content /> : tab === 'media' ? <MediaLibrary /> : tab === 'texts' ? <Texts /> : <Users />}
    </div>
  )
}

/** Staff accounts are created by the owner in Supabase (Authentication → Users); learners never sign in here. */
function StaffLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sb = browserSupabase()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!sb) return
    setBusy(true)
    const { error } = await sb.auth.signInWithPassword({ email, password })
    setBusy(false)
    setMessage(error ? error.message : null)
  }
  return (
    <form onSubmit={submit} className="card card-pad stack" style={{ maxWidth: 440, margin: '40px auto 0' }}>
      <h1 className="h-page">Идора</h1>
      <p className="muted" style={{ margin: 0 }}>Воридшавии кормандон.</p>
      <input className="input" type="email" placeholder="Почта" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      <input className="input" type="password" placeholder="Рамз" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      {message ? <p role="status" style={{ margin: 0, color: 'var(--bad)' }}>{message}</p> : null}
      <button className="btn btn-block" disabled={busy || !sb}>Ворид шудан</button>
    </form>
  )
}

interface Dash {
  counts: Record<string, number>
  status: Record<string, number>
  pending_quiz_reviews: number
  storage_bytes: number
  recent_activity: { entity_type: string; to_status: string; created_at: string; note?: string | null }[]
}

const COUNT_LABEL: Record<string, string> = {
  schools: 'Мактабҳо', courses: 'Курсҳо', modules: 'Модулҳо', topics: 'Мавзӯъҳо', lessons: 'Дарсҳо', quizzes: 'Тестҳо',
  questions: 'Саволҳо', users: 'Корбарон', inspirations: 'Илҳомҳо'
}

function Dashboard({ onGo }: { onGo: (t: Tab) => void }) {
  const d = useApi<Dash>('/admin/dashboard')
  if (d.error) return <ErrorState error={d.error} onRetry={d.reload} />
  if (!d.data) return <Loading />
  const { counts, status, pending_quiz_reviews, storage_bytes, recent_activity } = d.data
  return (
    <div className="stack">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
        {Object.entries(counts).map(([k, v]) => (
          <button key={k} type="button" className="card card-pad" style={{ textAlign: 'start', cursor: 'pointer' }} onClick={() => onGo(k === 'users' ? 'users' : k === 'inspirations' ? 'texts' : 'content')}>
            <div className="eyebrow">{COUNT_LABEL[k] ?? k}</div><div className="big-number" style={{ fontSize: '2rem' }}>{v}</div>
          </button>
        ))}
      </div>
      <div className="card card-pad stack" style={{ gap: 8 }}>
        <div className="eyebrow">Ҳолати мундариҷа</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(status).map(([k, v]) => <span key={k} className="chip">{STATUS_LABEL[k] ?? k}: {v}</span>)}
        </div>
        <div className="muted" style={{ fontSize: '0.9em' }}>Ҷавобҳои интизори санҷиш: {pending_quiz_reviews} · Медиа: {(storage_bytes / 1048576).toFixed(1)} МБ</div>
      </div>
      <div className="card card-pad stack" style={{ gap: 6 }}>
        <div className="eyebrow">Фаъолияти охирин</div>
        {recent_activity.length ? recent_activity.map((a, i) => (
          <div key={i} className="row" style={{ gap: 8, fontSize: '0.9em' }}>
            <span className="muted" style={{ minWidth: 92 }}>{new Date(a.created_at).toLocaleDateString()}</span>
            <span style={{ flex: 1 }}>{a.entity_type} → {STATUS_LABEL[a.to_status] ?? a.to_status}</span>
          </div>
        )) : <p className="muted" style={{ margin: 0 }}>Ҳоло фаъолият нест.</p>}
      </div>
    </div>
  )
}
