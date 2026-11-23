'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { formatDay } from '@/lib/progress'
import { onBack } from '@/web/components/BackButton'
import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { useLearner } from '@/web/offline/learner'
import { clearPin, setPin } from '@/web/offline/pin'
import { loadThread, markDone, pendingHelp, rateThread, sendMessage, supportToken, type SupportMessage, type SupportThread } from '@/web/offline/support'
import { usePrefs } from '@/web/prefs'

/** Why she came from the PIN screen: no e-mail access, or neither the answers nor an e-mail. */
type Help = 'email' | 'answers'
const SENT = 'dk.help-sent'

/** "Баҳодиҳии мушовир": five stars and a note, after a conversation the consultant has closed. */
function RateConsultant({ onDone }: { onDone: (rating?: number, note?: string) => Promise<void> | void }) {
  const { t } = usePrefs()
  const [stars, setStars] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div className="consult-screen" role="dialog" aria-modal="true" aria-label={t('support.rate_title')}>
      <div className="consult-card glass">
        <img className="consult-girl" src="/assets/mascot/star.webp" alt="" aria-hidden="true" />
        <h2 className="consult-title">{t('support.rate_title')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('support.rate_hint')}</p>
        <div className="consult-stars" role="radiogroup" aria-label={t('support.rate_title')}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={String(n)} className={n <= stars ? 'is-on' : undefined}
              style={{ ['--i' as string]: n }} onClick={() => setStars(n)}>
              <Icon name="star" size={34} fill={n <= stars ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <textarea className="input" rows={2} maxLength={500} placeholder={t('support.rate_note')} value={note} onChange={(e) => setNote(e.target.value)} style={{ resize: 'none' }} />
        <button type="button" className="btn btn-block btn-lg" disabled={!stars || busy} aria-busy={busy}
          onClick={async () => { setBusy(true); await onDone(stars, note.trim() || undefined) }}>{t('support.rate_send')}</button>
        <button type="button" className="link-btn" onClick={() => onDone()}>{t('support.rate_skip')}</button>
      </div>
    </div>
  )
}

/**
 * Small support chat: the learner writes, consultants answer in the panel; works without an account.
 * While no consultant is there, Mahliyo answers at once that they will write soon; when a consultant
 * opens the conversation, "Мушовир «…» бо шумо пайваст шуд" appears at its bottom in a fair hand. Coming
 * from the PIN screen (?help=email|answers) her request is written and sent for her. When a consultant
 * has closed the conversation, leaving it asks her to rate the consultant, once.
 */
export default function SupportPage() {
  const { t, locale } = usePrefs()
  const { learner, confirmEmail } = useLearner()
  const router = useRouter()
  const [thread, setThread] = useState<SupportThread | null>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'offline' | 'error'>('idle')
  const [rating, setRating] = useState(false)
  const [help, setHelp] = useState<Help | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const skipped = useRef(false)

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
  // the consultant's help, carried out here at once: a new PIN, the PIN off, the account's new e-mail
  useEffect(() => {
    for (const m of pendingHelp(thread)) {
      if (m.action === 'pin' && /^\d{4}$/.test(m.body)) void setPin(m.body)
      else if (m.action === 'unlock') {
        clearPin()
        window.dispatchEvent(new Event('dk-pin-cleared'))
      } else if (m.action === 'email' && /@/.test(m.body)) confirmEmail(m.body)
      markDone(m.id)
    }
  }, [thread, confirmEmail])

  const post = useCallback(async (body: string) => {
    if (navigator.onLine === false) return setState('offline')
    setState('sending')
    try {
      const token = supportToken()!
      setThread(await sendMessage(token, body, {
        name: learner?.name ?? (name.trim() || undefined), username: learner?.username ?? (username.trim() || undefined),
        // the account she writes for, so the consultant can help with it (change its e-mail)
        email: learner?.email ?? learner?.google ?? undefined
      }))
      setText('')
      setState('idle')
    } catch {
      setState('error')
    }
  }, [learner, name, username])

  // from the PIN screen: her request goes at once (once, even if the page is opened again)
  useEffect(() => {
    const h = new URLSearchParams(window.location.search).get('help')
    // from the plans' screen: "I want to buy Standard / Premium through a consultant"
    if (h === 'plan_standard' || h === 'plan_premium') {
      router.replace('/support')
      const body = t('support.help_plan').replace('{plan}', h === 'plan_premium' ? 'Premium' : 'Standard').replace('{email}', learner?.email ?? learner?.google ?? '—')
      try {
        if (sessionStorage.getItem(SENT) === body) return
        sessionStorage.setItem(SENT, body)
      } catch { /* storage blocked: send */ }
      void post(body)
      return
    }
    if (h !== 'email' && h !== 'answers') return
    setHelp(h)
    router.replace('/support')
    const body = h === 'email' && learner?.email ? t('support.help_email').replace('{email}', learner.email) : t('support.help_answers')
    try {
      if (sessionStorage.getItem(SENT) === body) return
      sessionStorage.setItem(SENT, body)
    } catch { /* storage blocked: send */ }
    void post(body)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const send = (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (body) void post(body)
  }

  // leaving: from the PIN screen back to it; a closed conversation not yet rated asks for a rating first
  const leaveTo = help ? '/' : learner ? '/settings' : '/start'
  const leave = useCallback(() => {
    if (thread?.needs_rating && !skipped.current) return setRating(true)
    router.push(leaveTo)
  }, [thread?.needs_rating, leaveTo, router])
  useEffect(() => (thread?.needs_rating && !rating ? onBack(leave) : undefined), [thread?.needs_rating, rating, leave])
  const rated = async (stars?: number, note?: string) => {
    skipped.current = true
    const token = supportToken(false)
    if (stars && token) {
      try { setThread(await rateThread(token, stars, note)) } catch { /* the rating is not worth keeping her here */ }
    }
    setRating(false)
    router.push(leaveTo)
  }

  const when = (m: SupportMessage) => `${formatDay(m.at, locale)} · ${new Date(m.at).toLocaleTimeString(locale === 'tg' ? 'ru' : locale, { hour: '2-digit', minute: '2-digit' })}`
  const joined = (m: SupportMessage) => {
    const [before, after] = t('support.joined').split('{name}')
    return (
      <div key={m.id} className="chat-joined" role="status">
        {/* the name with its quotes kept together on one line */}
        <span>{before.replace(/[«"“]$/, '')}</span>
        <span className="chat-joined-who">{before.match(/[«"“]$/)?.[0]}<b className="chat-joined-name">{m.body}</b>{after.match(/^[»"”]/)?.[0]}</span>
        <span>{after.replace(/^[»"”]/, '')}</span>
      </div>
    )
  }
  const first = !thread?.messages.length
  return (
    <>
      <Header onBack={leave} title={t('support.title')} />
      <div className="chat">
        {first ? <p className="muted" style={{ textAlign: 'center', margin: '18px 12px' }}>{t('support.hint')}</p> : null}
        {thread?.messages.map((m) => m.kind === 'joined' ? joined(m) : m.kind === 'bot' ? (
          <div key={m.id} className="bubble bubble-staff bubble-bot">
            <span className="bubble-who"><img src="/assets/mascot/salom.webp" alt="" aria-hidden="true" />{t('support.mahliyo')}</span>
            <span style={{ whiteSpace: 'pre-wrap' }}>{t('support.bot_wait')}</span>
            <time>{when(m)}</time>
          </div>
        ) : (
          <div key={m.id} className={`bubble${m.from_staff ? ' bubble-staff' : ''}${m.action ? ' bubble-help' : ''}`}>
            {m.from_staff ? <span className="bubble-who">{t('support.staff')}</span> : null}
            {/* the consultant's help, in words (the phone has carried it out) */}
            {m.action === 'pin' ? <span>{t('support.help_pin')}<b className="help-pin">{m.body}</b></span>
              : m.action === 'unlock' ? <span>{t('support.help_unlock')}</span>
              : m.action === 'email' ? <span>{t('support.help_new_email').replace('{email}', m.body)}</span>
              : <span style={{ whiteSpace: 'pre-wrap' }}>{m.body}</span>}
            <time>{when(m)}</time>
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
      {rating ? <RateConsultant onDone={rated} /> : null}
    </>
  )
}
