'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { Icon } from '../components/Icon'
import { ErrorState, Loading } from '../components/States'
import { useApi } from '../useApi'
import { errorText, send, sendNow } from './ui'

/**
 * Support chat for staff: threads written from phones (newest and open first), the conversation, a reply
 * box, close/reopen, and the help her phone carries out itself: a new PIN, the PIN off, her account's new e-mail.
 */

interface ThreadRow {
  id: string; name: string | null; username: string | null; status: 'open' | 'closed'; unread_staff: number; last_message_at: string; last_body: string | null
  /** the learner's rating of the consultant (1–5) and her note */
  rating?: number | null; rating_note?: string | null
}
/** 'bot': Mahliyo's answer at once; 'joined': a consultant opened the conversation (the body is her name) */
interface Message { id: string; from_staff: boolean; kind?: 'text' | 'bot' | 'joined'; body: string; at: string; action?: 'pin' | 'unlock' | 'email' | null }
/** `email`: the account the learner wrote for (her phone told it) */
interface Thread extends ThreadRow { messages: Message[]; email?: string | null }

const when = (iso: string) => new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function Support() {
  const list = useApi<ThreadRow[]>('/admin/support')
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const timer = setInterval(list.reload, 15_000)
    return () => clearInterval(timer)
  }, [list.reload])
  if (open) return <ThreadView id={open} onBack={() => { setOpen(null); list.reload() }} />
  if (list.error) return <ErrorState error={list.error} onRetry={list.reload} />
  if (!list.data) return <Loading />
  if (!list.data.length) return <p className="muted" style={{ textAlign: 'center' }}>Муроҷиат нест</p>
  return (
    <div className="stack" style={{ gap: 8 }}>
      {list.data.map((t) => (
        <button key={t.id} type="button" className="glass list-row" style={{ textAlign: 'start', cursor: 'pointer', opacity: t.status === 'closed' ? 0.6 : 1 }} onClick={() => setOpen(t.id)}>
          <span className="row-icon"><Icon name={t.status === 'closed' ? 'check' : 'bell'} /></span>
          <span className="row-main">
            <b>{t.name ?? 'Бе ном'}{t.username ? ` · ${t.username}` : ''}</b>
            <span className="row-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.last_body}</span>
          </span>
          <span className="row-end" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            <span>{when(t.last_message_at)}</span>
            {t.unread_staff ? <span className="review-badge" style={{ minWidth: 26, height: 26 }}>{t.unread_staff}</span> : null}
            {t.rating ? <span title={t.rating_note ?? undefined} style={{ color: '#e0a21c' }}>{'★'.repeat(t.rating)}</span> : null}
          </span>
        </button>
      ))}
    </div>
  )
}

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const thread = useApi<Thread>(`/admin/support/${id}`)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  useEffect(() => {
    const timer = setInterval(thread.reload, 10_000)
    return () => clearInterval(timer)
  }, [thread.reload])
  if (thread.error) return <ErrorState error={thread.error} onRetry={thread.reload} />
  if (!thread.data) return <Loading />
  const t = thread.data

  const reply = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await send(`/admin/support/${id}/reply`, 'POST', { body: text.trim() })
      setText('')
      thread.reload()
    } catch (err) {
      setNote(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const status = async (s: 'open' | 'closed') => {
    await send(`/admin/support/${id}/status`, 'POST', { status: s }).catch((err) => setNote(errorText(err)))
    thread.reload()
  }
  /** the consultant's help, carried out by her phone when it reads the conversation */
  const help = async (action: 'pin' | 'unlock' | 'email') => {
    const ask = action === 'pin' ? 'PIN-и нави 4-рақама ба корбар фиристода шавад? Телефонаш онро худ мегузорад.'
      : action === 'unlock' ? 'PIN-и корбар хомӯш карда шавад? Барнома бе PIN кушода мешавад.'
      : `Почтаи ҳисоб ба «${email.trim()}» иваз карда шавад?`
    if (action === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setNote('Почтаи дурусти навро нависед.')
    if (!confirm(ask)) return
    try {
      await sendNow(`/admin/support/${id}/action`, 'POST', action === 'email' ? { action, value: email.trim() } : { action })
      setNote(action === 'pin' ? 'PIN-и нав фиристода шуд — дар телефони корбар худ гузошта мешавад.'
        : action === 'unlock' ? 'PIN хомӯш карда шуд — барномаи корбар кушода мешавад.' : 'Почта иваз шуд.')
      if (action === 'email') setEmail('')
      thread.reload()
    } catch (err) {
      setNote(errorText(err))
    }
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row">
        <button type="button" className="icon-btn" aria-label="Бозгашт" onClick={onBack}><Icon name="back" /></button>
        <b style={{ flex: 1 }}>{t.name ?? 'Бе ном'}{t.username ? ` · ${t.username}` : ''}</b>
        <button type="button" className="chip" onClick={() => status(t.status === 'open' ? 'closed' : 'open')}>{t.status === 'open' ? 'Бастан' : 'Кушодан'}</button>
      </div>
      <div className="chat" style={{ paddingBottom: 8 }}>
        {t.messages.map((m) => m.kind === 'joined' ? (
          <p key={m.id} className="muted" style={{ textAlign: 'center', fontSize: '0.8em', margin: 0 }}>Мушовир «{m.body}» пайваст шуд · {when(m.at)}</p>
        ) : (
          <div key={m.id} className={`bubble${m.from_staff ? '' : ' bubble-staff'}`} style={m.kind === 'bot' ? { opacity: 0.75 } : undefined}>
            {m.kind === 'bot' ? <span className="bubble-who" style={{ color: 'inherit' }}>Маҳлиё (худкор)</span> : null}
            <span style={{ whiteSpace: 'pre-wrap' }}>{m.action === 'pin' ? `PIN-и нав: ${m.body}` : m.action === 'unlock' ? 'PIN хомӯш карда шуд' : m.action === 'email' ? `Почтаи нав: ${m.body}` : m.body}</span>
            <time>{when(m.at)}</time>
          </div>
        ))}
        {t.rating ? <p className="muted" style={{ textAlign: 'center', margin: 0 }}>Баҳо: <span style={{ color: '#e0a21c' }}>{'★'.repeat(t.rating)}</span>{t.rating_note ? ` — «${t.rating_note}»` : ''}</p> : null}
      </div>
      <form className="stack" style={{ gap: 8 }} onSubmit={reply}>
        <textarea className="input" rows={3} placeholder="Ҷавоб…" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-block" disabled={busy || !text.trim()}>Фиристодан <Icon name="arrow" size={16} /></button>
      </form>
      {/* the consultant's help: her phone carries it out itself when it reads the conversation */}
      <div className="glass card-pad stack" style={{ gap: 10 }}>
        <b style={{ fontWeight: 500 }}>Ёрӣ ба корбар</b>
        <span className="muted" style={{ fontSize: '0.85em' }}>
          {t.email ? <>Ҳисоб: <b>{t.email}</b></> : 'Почтаи ҳисоб маълум нест (корбар бе почта навиштааст).'}
        </span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-soft" onClick={() => help('pin')}><Icon name="key" size={16} /> PIN-и нав додан</button>
          <button type="button" className="btn btn-soft" onClick={() => help('unlock')}><Icon name="lock" size={16} /> PIN-ро хомӯш кардан</button>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" type="email" placeholder="почтаи нав" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" />
          <button type="button" className="btn btn-soft" onClick={() => help('email')}>Почтаро иваз кардан</button>
        </div>
      </div>
      {note ? <p role="status" className="muted" style={{ margin: 0 }}>{note}</p> : null}
    </div>
  )
}
