'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Icon } from '@/web/components/Icon'
import { AnswerBlocks } from '@/web/components/MahliyoBlocks'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import { aboutMe, AiError, aiReady, askMahliyo, loadChat, saveChat, type AiTurn } from '@/web/offline/mahliyo'
import { usePrefs } from '@/web/prefs'

const FACE = '/assets/mascot/face.webp'
const FACE_THINK = '/assets/mascot/face-think.webp'
const PORTRAIT = '/assets/mascot/salom.webp'
const PORTRAIT_THINK = '/assets/mascot/think.webp'

/**
 * "Маҳлиё AI", a tab of its own: a quiet scene with soft moving light, her portrait in a glowing orb, and
 * the conversation. She answers in Tajik about the app, what its schools teach and the learner's own
 * progress (the phone sends a summary of it with each question), in blocks — steps, a screenshot with a
 * pointer, a link, a reminder that rings on the phone. While she thinks, her orb turns and she ponders.
 * The conversation stays on this phone; every question also reaches the staff.
 */
export default function MahliyoPage() {
  const { t } = usePrefs()
  const { learner, progress } = useLearner()
  const { bundle } = useContent()
  const [ready, setReady] = useState<boolean | null>(null)
  const [turns, setTurns] = useState<AiTurn[]>([])
  const [fresh, setFresh] = useState(-1)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setTurns(loadChat()), [])
  useEffect(() => { void aiReady().then(setReady) }, [])
  // her new answer is read from its beginning; otherwise the newest line stays in view
  useEffect(() => {
    const answer = !busy && turns[turns.length - 1]?.role === 'assistant' ? [...document.querySelectorAll('.ai-said')].pop() : null
    if (answer) answer.scrollIntoView({ block: 'start', behavior: 'smooth' })
    else end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, busy])
  // the box grows with what she writes (up to five lines)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  const ask = async (question: string) => {
    const q = question.trim()
    if (!q || busy || !ready) return
    if (navigator.onLine === false) return setNote(t('support.offline'))
    setNote(null)
    const asked: AiTurn[] = [...turns, { role: 'user', content: q, at: new Date().toISOString() }]
    setTurns(asked)
    saveChat(asked)
    setText('')
    setBusy(true)
    try {
      const a = await askMahliyo(asked, { code: learner?.code, name: learner?.name, me: aboutMe(learner?.name, progress, bundle) })
      const next: AiTurn[] = [...asked, { role: 'assistant', content: a.reply, tajik: a.tajik, blocks: a.blocks, at: new Date().toISOString() }]
      setFresh(next.length - 1)
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
  const last = turns[turns.length - 1]
  const first = learner?.name?.split(/\s+/)[0]

  return (
    <div className={`ai-scene${busy ? ' is-thinking' : ''}`}>
      <div className="ai-aurora" aria-hidden="true"><i /><i /><i /></div>

      <header className="ai-top">
        <span className="ai-orb ai-orb-sm" aria-hidden="true"><span className="ai-orb-ring" /><img src={busy ? FACE_THINK : FACE} alt="" /></span>
        <div className="grow">
          <h1 className="ai-name">{t('ai.title')}</h1>
          <span className={`ai-status${busy ? ' is-busy' : ''}`} aria-live="polite">{busy ? t('ai.thinking') : t('ai.subtitle')}</span>
        </div>
        {turns.length ? <button type="button" className="icon-btn" aria-label={t('ai.clear')} onClick={restart}><Icon name="refresh" /></button> : null}
      </header>

      <div className="ai-chat">
        {turns.length ? null : (
          <section className="ai-hero">
            <span className="ai-orb ai-orb-lg" aria-hidden="true">
              <span className="ai-orb-glow" /><span className="ai-orb-ring" />
              <img src={busy ? PORTRAIT_THINK : PORTRAIT} alt="" />
            </span>
            <h2 className="ai-greet">{first ? t('ai.greet').replace('{name}', first) : t('ai.title')}</h2>
            <p className="ai-hello">{ready === false ? t('ai.soon') : t('ai.hello')}</p>
            {ready === false ? (
              <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link>
            ) : (
              <div className="ai-suggest" role="list">
                {t('ai.suggest').split('\n').filter(Boolean).map((s, i) => (
                  <button key={s} type="button" role="listitem" className="ai-chip" style={{ ['--i' as string]: i }} onClick={() => ask(s)} disabled={!ready}>
                    <Icon name="sparkle" size={16} /><span>{s}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {turns.map((m, i) => (m.role === 'user' ? (
          <div key={i} className="bubble"><span style={{ whiteSpace: 'pre-wrap' }}>{m.content}</span></div>
        ) : (
          <div key={i} className="ai-said">
            <img src={FACE} alt="" aria-hidden="true" />
            <div className="grow">
              <AnswerBlocks blocks={m.blocks?.length ? m.blocks : [{ type: 'text', text: m.content }]} fresh={i === fresh} />
              {m.tajik === false ? <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link> : null}
            </div>
          </div>
        )))}

        {busy ? (
          <div className="ai-thinking" aria-label={t('ai.thinking')}>
            <span className="ai-orb ai-orb-xs" aria-hidden="true"><span className="ai-orb-ring" /><img src={FACE_THINK} alt="" /></span>
            <span className="ai-thinking-text">{t('ai.thinking')}</span>
            <span className="mi-dots"><i /><i /><i /></span>
          </div>
        ) : last?.role === 'assistant' && last.tajik !== false ? (
          <div className="ai-follow">
            <button type="button" className="ai-chip" onClick={() => ask(t('ai.not_clear'))}><Icon name="image" size={16} /><span>{t('ai.not_clear')}</span></button>
          </div>
        ) : null}
        {note ? <p className="muted ai-note" role="status">{note}</p> : null}
        <div ref={end} />
      </div>

      <form className="ai-composer" onSubmit={send}>
        <textarea ref={box} className="ai-input" rows={1} placeholder={t('ai.placeholder')} value={text} maxLength={1000} lang="tg"
          disabled={ready === false} aria-label={t('ai.placeholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text) } }} />
        <button className="ai-send" aria-label={t('support.send')} disabled={busy || !ready || !text.trim()}><Icon name="up" size={20} /></button>
      </form>
    </div>
  )
}
