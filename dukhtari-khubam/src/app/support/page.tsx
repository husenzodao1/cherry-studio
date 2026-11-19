'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { formatDay } from '@/lib/progress'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { useLearner } from '@/web/offline/learner'
import { loadThread, sendMessage, supportToken, type SupportThread } from '@/web/offline/support'
import { usePrefs } from '@/web/prefs'

/** Small support chat: the learner writes, staff answer in the panel; works without an account. */
export default function SupportPage() {
  const { t, locale } = usePrefs()
  const { learner } = useLearner()
  const [thread, setThread] = useState<SupportThread | null>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'offline' | 'error'>('idle')
  const end = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    const token = supportToken(false)
    if (!token || navigator.onLine === false) return
    try {
      setThread(await loadThread(token))
    } catch {
      /* keep what is shown */
    }
  }, [])
  // replies arrive while the chat is open
  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 10_000)
    return () => clearInterval(timer)
  }, [refresh])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [thread?.messages.length])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    if (navigator.onLine === false) {
      setState('offline')
      return
    }
    setState('sending')
    try {
      const token = supportToken()!
      setThread(await sendMessage(token, body, {
        name: learner?.name ?? (name.trim() || undefined), username: learner?.username ?? (username.trim() || undefined)
      }))
      setText('')
      setState('idle')
    } catch {
      setState('error')
    }
  }
  const first = !thread?.messages.length
  return (
    <>
      <Header back={learner ? '/settings' : '/start'} title={t('support.title')} />
      <div className="chat">
        {first ? <p className="muted" style={{ textAlign: 'center', margin: '18px 12px' }}>{t('support.hint')}</p> : null}
        {thread?.messages.map((m) => (
          <div key={m.id} className={`bubble${m.from_staff ? ' bubble-staff' : ''}`}>
            {m.from_staff ? <span className="bubble-who">{t('support.staff')}</span> : null}
            <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>
            <time>{formatDay(m.at, locale)} · {new Date(m.at).toLocaleTimeString(locale === 'tg' ? 'ru' : locale, { hour: '2-digit', minute: '2-digit' })}</time>
          </div>
        ))}
        {thread?.status === 'closed' ? <p className="muted" style={{ textAlign: 'center', fontSize: '0.85em' }}>{t('support.closed')}</p> : null}
        <div ref={end} />
      </div>
      <form className="chat-form glass" onSubmit={send}>
        {first && !learner ? (
          <div className="row" style={{ gap: 8 }}>
            <input className="input" placeholder={t('support.name')} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder={t('support.username')} value={username} maxLength={32} autoCapitalize="none" onChange={(e) => setUsername(e.target.value)} />
          </div>
        ) : null}
        <div className="row" style={{ gap: 8 }}>
          <textarea className="input" rows={1} placeholder={t('support.placeholder')} value={text} maxLength={2000}
            onChange={(e) => setText(e.target.value)} style={{ minHeight: 52, resize: 'none' }} />
          <button className="play-btn" style={{ border: 0, cursor: 'pointer', width: 52, height: 52 }} aria-label={t('support.send')}
            disabled={state === 'sending' || !text.trim()}><Icon name="arrow" size={20} /></button>
        </div>
        {state === 'offline' || state === 'error' ? <span className="muted" role="status" style={{ fontSize: '0.85em' }}>{t(state === 'offline' ? 'support.offline' : 'state.error')}</span> : null}
      </form>
    </>
  )
}
