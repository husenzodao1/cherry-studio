'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'

import { Content } from '@/web/admin/Content'
import { MahliyoLog } from '@/web/admin/MahliyoLog'
import { MediaLibrary } from '@/web/admin/Media'
import { Support } from '@/web/admin/Support'
import { Texts } from '@/web/admin/Texts'
import { Pages } from '@/web/admin/Pages'
import { STATUS_LABEL } from '@/web/admin/ui'
import { Users } from '@/web/admin/Users'
import { useAuth } from '@/web/auth'
import { Icon } from '@/web/components/Icon'
import { useLearner } from '@/web/offline/learner'
import { ErrorState, Loading } from '@/web/components/States'
import { browserSupabase } from '@/web/supabase-browser'
import { useOutbox } from '@/web/admin/outbox'
import { useApi } from '@/web/useApi'

/**
 * Staff panel (opened from search with the staff passphrase). Every action goes through the same API
 * as the apps; the database checks the signed-in user's role for each read and write.
 */

type Tab = 'home' | 'support' | 'ai' | 'content' | 'media' | 'texts' | 'pages' | 'users'
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Панел' }, { id: 'support', label: 'Дастгирӣ' }, { id: 'ai', label: 'Маҳлиё AI' }, { id: 'content', label: 'Мундариҷа' }, { id: 'media', label: 'Медиа' },
  { id: 'texts', label: 'Матнҳо' }, { id: 'pages', label: 'Саҳифаҳо' }, { id: 'users', label: 'Корбарон' }
]

export default function AdminPage() {
  const { session, ready } = useAuth()
  const me = useApi<{ roles: string[] }>(session ? '/me' : null)
  // the app's "Саволҳои корбарон" opens the panel straight on support
  const [tab, setTab] = useState<Tab>('home')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'support') setTab('support')
  }, [])

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
      <OutboxNote />
      <nav className="scroller" role="tablist" style={{ gap: 6 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="chip" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>
      {tab === 'home' ? <Dashboard onGo={setTab} /> : tab === 'support' ? <Support /> : tab === 'ai' ? <MahliyoLog /> : tab === 'content' ? <Content /> : tab === 'media' ? <MediaLibrary /> : tab === 'texts' ? <Texts /> : tab === 'pages' ? <Pages /> : <Users />}
    </div>
  )
}

/** Changes made without a connection: how many wait, and any the server refused. */
function OutboxNote() {
  const box = useOutbox()
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const set = () => setOnline(navigator.onLine !== false)
    set()
    window.addEventListener('online', set)
    window.addEventListener('offline', set)
    return () => { window.removeEventListener('online', set); window.removeEventListener('offline', set) }
  }, [])
  if (online && !box.waiting && !box.failed) return null
  return (
    <div className="card card-pad row" role="status" style={{ gap: 10, flexWrap: 'wrap', fontSize: '0.9em' }}>
      <Icon name={online ? 'install' : 'wifiOff'} size={18} />
      <span style={{ flex: 1 }}>
        {!online ? 'Интернет нест — охирин маълумоти нигоҳдошта нишон дода мешавад. ' : ''}
        {box.waiting ? `Дар навбат: ${box.waiting} тағйирот — ҳангоми пайваст худ фиристода мешавад.` : ''}
        {box.failed ? ` ${box.failed} тағйиротро сервер қабул накард.` : ''}
      </span>
      {box.failed ? <button type="button" className="chip" onClick={box.clearFailed}>Пок кардан</button> : null}
    </div>
  )
}

/** Staff accounts are created by the owner in Supabase (Authentication → Users); learners never sign in here. */
/**
 * Staff sign-in: a 6-digit code sent to the staff member's e-mail (in the app, her own e-mail is filled
 * in), or the e-mail and a password.
 */
function StaffLogin() {
  const { learner } = useLearner()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'code' | 'password'>('code')
  const [sent, setSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const sb = browserSupabase()
  useEffect(() => {
    if (learner?.email) setEmail((e) => e || learner.email!)
  }, [learner?.email])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!sb) return
    setBusy(true)
    setMessage(null)
    if (mode === 'password') {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      setMessage(error ? error.message : null)
    } else if (!sent) {
      // only an account that exists: no new account is made from this form
      const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } })
      if (error) setMessage(error.message)
      else setSent(true)
    } else {
      const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: 'email' })
      setMessage(error ? 'Код нодуруст аст ё вақташ гузашт.' : null)
    }
    setBusy(false)
  }
  return (
    <form onSubmit={submit} className="card card-pad stack" style={{ maxWidth: 440, margin: '40px auto 0' }}>
      <h1 className="h-page">Идора</h1>
      <p className="muted" style={{ margin: 0 }}>Воридшавии кормандон.</p>
      <input className="input" type="email" placeholder="Почта" required value={email} onChange={(e) => { setEmail(e.target.value); setSent(false) }} autoComplete="username" />
      {mode === 'password' ? (
        <input className="input" type="password" placeholder="Рамз" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      ) : sent ? (
        <>
          <p className="muted" style={{ margin: 0, fontSize: '0.86em' }}>Коди 6-рақама ба {email} фиристода шуд.</p>
          <input className="input" inputMode="numeric" autoComplete="one-time-code" placeholder="Код" required maxLength={6} value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
        </>
      ) : null}
      {message ? <p role="status" style={{ margin: 0, color: 'var(--bad)' }}>{message}</p> : null}
      <button className="btn btn-block" disabled={busy || !sb}>{mode === 'password' ? 'Ворид шудан' : sent ? 'Тасдиқ' : 'Фиристодани код'}</button>
      <button type="button" className="link-btn" onClick={() => { setMode(mode === 'code' ? 'password' : 'code'); setMessage(null) }}>
        {mode === 'code' ? 'Бо рамз' : 'Бо коди почта'}
      </button>
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
