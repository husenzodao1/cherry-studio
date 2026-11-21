'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Header } from '@/web/components/Header'
import { Icon } from '@/web/components/Icon'
import { useLearner } from '@/web/offline/learner'
import { AiError, askMahliyo, loadChat, saveChat, type AiTurn } from '@/web/offline/mahliyo'
import { usePrefs } from '@/web/prefs'

const FACE = '/assets/mascot/salom.webp'

/**
 * "Маҳлиё AI": a chat with the app's teacher. She answers in Tajik about the app and what its schools
 * teach (server/mahliyo.ts); written to in another language she says so in that language and offers the
 * consultant. The conversation stays on this phone; every question also reaches the staff.
 */
export default function MahliyoPage() {
  const { t } = usePrefs()
  const { learner } = useLearner()
  const [turns, setTurns] = useState<AiTurn[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => setTurns(loadChat()), [])
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [turns.length, busy])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    if (navigator.onLine === false) return setNote(t('support.offline'))
    setNote(null)
    const asked: AiTurn[] = [...turns, { role: 'user', content: q, at: new Date().toISOString() }]
    setTurns(asked)
    saveChat(asked)
    setText('')
    setBusy(true)
    try {
      const a = await askMahliyo(asked, { code: learner?.code, name: learner?.name })
      const next: AiTurn[] = [...asked, { role: 'assistant', content: a.reply, tajik: a.tajik, at: new Date().toISOString() }]
      setTurns(next)
      saveChat(next)
    } catch (e) {
      setNote(t(e instanceof AiError && e.status === 429 ? 'ai.limit' : 'ai.unavailable'))
    } finally {
      setBusy(false)
    }
  }
  const send = (e: FormEvent) => {
    e.preventDefault()
    void ask(text)
  }
  const restart = () => {
    setTurns([])
    saveChat([])
    setNote(null)
  }

  return (
    <>
      <Header back="/" title={t('ai.title')}
        end={turns.length ? <button type="button" className="icon-btn" aria-label={t('ai.clear')} onClick={restart}><Icon name="refresh" /></button> : undefined} />
      <div className="chat ai-chat">
        <div className="ai-hello">
          <img src={FACE} alt="" aria-hidden="true" />
          <p>{t('ai.hello')}</p>
        </div>
        {turns.length ? null : (
          <div className="ai-suggest" role="list">
            {t('ai.suggest').split('\n').filter(Boolean).map((s, i) => (
              <button key={s} type="button" role="listitem" className="chip" style={{ ['--i' as string]: i }} onClick={() => ask(s)}>{s}</button>
            ))}
          </div>
        )}
        {turns.map((m, i) => (m.role === 'user' ? (
          <div key={i} className="bubble"><span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span></div>
        ) : (
          <div key={i} className="ai-said">
            <img src={FACE} alt="" aria-hidden="true" />
            <div className="bubble bubble-staff">
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span>
              {m.tajik === false ? <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link> : null}
            </div>
          </div>
        )))}
        {busy ? (
          <div className="ai-said" aria-live="polite" aria-label={t('ai.title')}>
            <img src={FACE} alt="" aria-hidden="true" />
            <div className="bubble bubble-staff"><span className="mi-dots"><i /><i /><i /></span></div>
          </div>
        ) : null}
        {note ? <p className="muted" role="status" style={{ textAlign: 'center', margin: 0, fontSize: '0.88em' }}>{note}</p> : null}
        <div ref={end} />
      </div>
      <form className="chat-form glass" onSubmit={send}>
        <div className="row" style={{ gap: 8 }}>
          <textarea className="input" rows={1} placeholder={t('ai.placeholder')} value={text} maxLength={1000} lang="tg"
            onChange={(e) => setText(e.target.value)} style={{ minHeight: 52, resize: 'none' }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text) } }} />
          <button className="play-btn" style={{ border: 0, cursor: 'pointer', width: 52, height: 52 }} aria-label={t('support.send')}
            disabled={busy || !text.trim()}><Icon name="arrow" size={20} /></button>
        </div>
      </form>
    </>
  )
}
