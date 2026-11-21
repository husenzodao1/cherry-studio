'use client'

import { Capacitor } from '@capacitor/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { onBack } from '@/web/components/BackButton'

import { Icon } from '@/web/components/Icon'
import { AnswerBlocks, timingOf } from '@/web/components/MahliyoBlocks'
import { showToast } from '@/web/components/Toast'
import { useContent } from '@/web/offline/content'
import { useLearner } from '@/web/offline/learner'
import {
  aboutMe, aiReady, archiveChat, ask, copyOf, QUESTION_CAP, copyText, drawn, FileProblem, FILES_CAP, MAX_FILES, newChat, openChat, prepareFile, removeChat, retry, stop,
  useMahliyo, watch, type AiChatMeta, type AiFileView, type AiTurn, type AiUpload
} from '@/web/offline/mahliyo'
import { usePrefs } from '@/web/prefs'

const FACE = '/assets/mascot/face.webp'
const FACE_THINK = '/assets/mascot/face-think.webp'
const PORTRAIT = '/assets/mascot/salom.webp'
const PORTRAIT_THINK = '/assets/mascot/think.webp'
/** a second "back" within this long leaves her full screen */
const EXIT_MS = 2000
/** rubber at the chat's ends: the share of the finger's travel it follows, and how far it can go */
const PULL = 0.3
const STRETCH = 90

/** what the learner began writing in each chat and did not send (kept on this phone) */
const DRAFTS = 'dk.ai.drafts'
const drafts = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(DRAFTS) || '{}') as Record<string, string> } catch { return {} }
}
const keepDraft = (chat: string, text: string) => {
  try {
    const all = drafts()
    if (text.trim()) all[chat] = text
    else delete all[chat]
    localStorage.setItem(DRAFTS, JSON.stringify(all))
  } catch { /* storage blocked: no draft */ }
}

/**
 * "Маҳлиё AI" opens full screen (no tab bar; the browser's bars hidden where it allows): a quiet scene in
 * a soft plain colour of the theme, her portrait in a glowing orb, and the conversation — her answers as
 * plain text, no boxes. Only the conversation moves, and at its ends it stretches like rubber. "✕" at the
 * top right leaves; the phone's (or browser's) back says first how to leave, and a second press leaves.
 * The menu (☰) keeps the history of chats. She answers in Tajik about the app, what its schools teach and the learner's own
 * progress (the phone sends a summary of it with each question), in blocks — steps, a screenshot with a
 * pointer, a link, a reminder that rings on the phone — drawn word by word as they come. The question goes
 * on in the background (web/offline/mahliyo.ts): the learner may leave and come back. While it is still on
 * its way it says "sending"; only once it arrived does she think. Pictures and files (PDF, text) can go
 * with a question. A question can be stopped and edited; her answers and the learner's questions can be
 * copied. Without internet the chat says so. The conversation stays on this phone; every question also
 * reaches the staff.
 */
export default function MahliyoPage() {
  const { t } = usePrefs()
  const { learner, progress } = useLearner()
  const { bundle } = useContent()
  const { chat, chats, turns, pending, problem, fresh, online } = useMahliyo()
  const [history, setHistory] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  /** the question being edited (its index), or none */
  const [editing, setEditing] = useState<number | null>(null)
  /** the question whose actions are shown (the last one's always are) */
  const [opened, setOpened] = useState<number | null>(null)
  /** pictures and files chosen for the next question */
  const [files, setFiles] = useState<AiUpload[]>([])
  const end = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  /** she is answering a question of this chat (one question at a time, in any chat) */
  const busy = !!pending && pending.chat === chat
  /** the question is still on its way (no id from the server yet) */
  const sending = busy && !pending.id

  useEffect(() => watch(), [])
  // a chat opens with what she had begun writing in it
  useEffect(() => {
    setEditing(null)
    setText(drafts()[chat] ?? '')
  }, [chat])
  /** what she writes (a new question, not an edit, is kept as the chat's draft) */
  const write = (value: string) => {
    setText(value)
    if (editing === null) keepDraft(chat, value)
  }

  // full screen: the page behind does not move
  useEffect(() => {
    document.documentElement.classList.add('ai-full')
    return () => document.documentElement.classList.remove('ai-full')
  }, [])
  /** leaves her full screen, back where the learner came from */
  const leave = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    let from = '/'
    try { from = sessionStorage.getItem('dk.ai-from') || '/' } catch { /* home */ }
    router.push(from)
  }
  const leaveRef = useRef(leave)
  leaveRef.current = leave
  const historyRef = useRef(history)
  historyRef.current = history
  const tRef = useRef(t)
  tRef.current = t
  // back (the phone's, or the browser's): the history closes first; then the first press says how to
  // leave, and a second one within two seconds leaves
  useEffect(() => {
    let last = 0
    const press = () => {
      if (historyRef.current) return setHistory(false)
      if (Date.now() - last < EXIT_MS) return leaveRef.current()
      last = Date.now()
      showToast(tRef.current('ai.exit_again'), 'info')
    }
    if (Capacitor.isNativePlatform()) return onBack(press)
    const keep = () => window.history.pushState(window.history.state, '')
    keep()
    const pop = () => {
      const leaving = !historyRef.current && Date.now() - last < EXIT_MS
      press()
      if (!leaving) keep()
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])

  // only the conversation moves; at its ends it stretches like rubber and springs back
  useEffect(() => {
    const el = scroller.current
    const body = inner.current
    if (!el || !body) return
    let y0 = 0
    let d = 0
    const start = (e: TouchEvent) => {
      y0 = e.touches[0].clientY
      body.style.transition = 'none'
    }
    const move = (e: TouchEvent) => {
      const dy = e.touches[0].clientY - y0
      const atTop = el.scrollTop <= 0
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if ((dy > 0 && atTop) || (dy < 0 && atEnd)) {
        d = Math.sign(dy) * STRETCH * (1 - Math.exp((-Math.abs(dy) * PULL) / STRETCH))
        body.style.transform = `translateY(${d}px)`
        if (e.cancelable) e.preventDefault()
      } else if (d) {
        d = 0
        body.style.transform = ''
        y0 = e.touches[0].clientY
      }
    }
    const end = () => {
      if (!d) return
      body.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.15)'
      body.style.transform = ''
      d = 0
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [])
  useEffect(() => { void aiReady().then(setReady) }, [])
  // her new answer is read from its beginning; otherwise the newest line stays in view
  useEffect(() => {
    const answer = !busy && turns[turns.length - 1]?.role === 'assistant' ? [...document.querySelectorAll('.ai-said')].pop() : null
    if (answer) answer.scrollIntoView({ block: 'start', behavior: 'smooth' })
    else end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, busy, problem, chat])
  // a fresh answer is drawn word by word once; then it stays drawn
  useEffect(() => {
    const a = turns[fresh]
    if (!a?.blocks) return
    const done = setTimeout(drawn, timingOf(a.blocks).total + 600)
    return () => clearTimeout(done)
  }, [fresh, turns])
  // the box grows with what she writes (up to five lines)
  useEffect(() => {
    const el = box.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  const who = () => ({ code: learner?.code, name: learner?.name, me: aboutMe(learner?.name, progress, bundle) })
  const send = (question: string, withFiles: AiUpload[] = []) => {
    // a picture alone asks her to look at it
    const q = question.trim() || (withFiles.length ? t('ai.look') : '')
    if (!q || pending || !ready) return
    void ask(q, who(), editing ?? undefined, withFiles)
    // a new question was the draft; after an edit, the draft comes back
    if (editing === null) keepDraft(chat, '')
    setText(editing === null ? '' : drafts()[chat] ?? '')
    setFiles([])
    setEditing(null)
    setOpened(null)
  }
  const pick = async (chosen: FileList | null) => {
    const list = [...(chosen ?? [])]
    if (picker.current) picker.current.value = ''
    if (!list.length) return
    if (files.length + list.length > MAX_FILES) showToast(t('ai.file_many'), 'info')
    const prepared: AiUpload[] = []
    for (const f of list.slice(0, MAX_FILES - files.length)) {
      try {
        prepared.push(await prepareFile(f))
      } catch (e) {
        showToast(t(e instanceof FileProblem && e.kind === 'big' ? 'ai.file_big' : 'ai.file_type'), 'alert')
      }
    }
    const all = [...files, ...prepared]
    if (all.reduce((n, f) => n + f.data.length, 0) > FILES_CAP) return showToast(t('ai.file_big'), 'alert')
    setFiles(all)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) stop()
    else send(text, files)
  }
  const edit = (i: number) => {
    if (busy) stop()
    // the draft stays kept; the box shows the question being edited
    setEditing(i)
    setText(turns[i].content)
    setTimeout(() => box.current?.focus(), 50)
  }
  const textOf = (m: AiTurn) => (m.role === 'user' ? m.content : copyOf(m))
  const copy = async (m: AiTurn) => {
    showToast(t((await copyText(textOf(m))) ? 'ai.copied' : 'ai.unavailable'), 'copy')
  }
  /** shares her answer with another app (the phone's share sheet; the browser's where it has one) */
  const share = async (m: AiTurn) => {
    const said = textOf(m)
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share')
      return void Share.share({ text: said, dialogTitle: t('ai.share') }).catch(() => undefined)
    }
    if (navigator.share) return void navigator.share({ text: said }).catch(() => undefined)
    void copy(m)
  }
  /** the text whose words are being selected (a sheet where any part can be picked) */
  const [selecting, setSelecting] = useState<string | null>(null)
  const last = turns[turns.length - 1]
  const lastQuestion = turns.map((m) => m.role).lastIndexOf('user')
  const first = learner?.name?.split(/\s+/)[0]

  return (
    <div className={`ai-scene${busy ? ' is-thinking' : ''}`}>
      <header className="ai-top">
        <span className="ai-orb ai-orb-sm" aria-hidden="true"><span className="ai-orb-ring" /><img src={busy ? FACE_THINK : FACE} alt="" /></span>
        <div className="grow">
          <h1 className="ai-name">{t('ai.title')}</h1>
          <span className={`ai-status${busy ? ' is-busy' : ''}`} aria-live="polite">{sending ? t('ai.sending') : busy ? t('ai.thinking') : t('ai.subtitle')}</span>
        </div>
        <button type="button" className="ai-menu" aria-label={t('ai.history')} aria-haspopup="dialog" onClick={() => setHistory(true)}><Icon name="menu" size={22} /></button>
        <button type="button" className="ai-menu ai-leave" aria-label={t('ai.leave')} onClick={leave}><Icon name="x" size={20} /></button>
      </header>
      {selecting !== null ? <SelectText text={selecting} onClose={() => setSelecting(null)} /> : null}
      {history ? (
        <History chats={chats} open={chat} onClose={() => setHistory(false)}
          onOpen={(id) => { openChat(id); setHistory(false) }}
          onNew={() => { newChat(); setFiles([]); setHistory(false) }}
          onRemove={removeChat} onArchive={archiveChat} />
      ) : null}

      {online ? null : (
        <p className="ai-offline" role="status"><Icon name="globe" size={18} /><span>{t('ai.offline')}{busy ? ` ${t('ai.offline_wait')}` : ''}</span></p>
      )}

      <div className="ai-scroll" ref={scroller}>
      <div className="ai-chat" ref={inner}>
        {turns.length ? null : (
          <section className="ai-hero">
            <span className="ai-orb ai-orb-lg" aria-hidden="true">
              <span className="ai-orb-glow" /><span className="ai-orb-ring" />
              <img src={busy ? PORTRAIT_THINK : PORTRAIT} alt="" />
            </span>
            <Taglines lines={t('ai.taglines').split('\n').filter(Boolean).map((l) => (first ? l.replace('{name}', first) : l.replace(/,?\s*\{name\}/, '')))} />
            {/* no line under her greeting: only when she is not there yet, why */}
            {ready === false ? <p className="ai-hello">{t('ai.soon')}</p> : null}
            {ready === false ? (
              <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link>
            ) : <Suggestions lines={t('ai.suggest').split('\n').filter(Boolean)} disabled={!ready || !online} onPick={send} />}
          </section>
        )}

        {turns.map((m, i) => (m.role === 'user' ? (
          <div key={i} className={`ai-asked${editing === i ? ' is-editing' : ''}`}>
            {m.files?.length ? <Attached files={m.files} /> : null}
            <button type="button" className="bubble" onClick={() => setOpened(opened === i ? null : i)} aria-expanded={opened === i || i === lastQuestion}>
              <Question text={m.content} />
            </button>
            {i === lastQuestion && busy ? (
              <span className={`ai-delivery${sending ? ' is-sending' : ''}`} role="status">
                <Icon name={sending ? 'refresh' : 'check'} size={14} />{sending ? t('ai.sending') : t('ai.sent')}
              </span>
            ) : opened === i || i === lastQuestion ? (
              <div className="ai-acts">
                <button type="button" className="ai-act" onClick={() => edit(i)} aria-label={t('ai.edit')}><Icon name="edit" size={16} /></button>
                <button type="button" className="ai-act" onClick={() => copy(m)} aria-label={t('ai.copy')}><Icon name="copy" size={16} /></button>
              </div>
            ) : null}
          </div>
        ) : (
          <div key={i} className="ai-said">
            <div className="grow">
              <AnswerBlocks blocks={m.blocks?.length ? m.blocks : [{ type: 'text', text: m.content }]} fresh={i === fresh} />
              {m.tajik === false ? <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link> : null}
              <div className="ai-acts ai-acts-start">
                <button type="button" className="ai-act" onClick={() => copy(m)} aria-label={t('ai.copy')}><Icon name="copy" size={16} /></button>
                <button type="button" className="ai-act" onClick={() => setSelecting(textOf(m))} aria-label={t('ai.select')}><Icon name="select" size={16} /></button>
                <button type="button" className="ai-act" onClick={() => share(m)} aria-label={t('ai.share')}><Icon name="share" size={16} /></button>
              </div>
            </div>
          </div>
        )))}

        {busy && !sending ? (
          <div className="ai-thinking" aria-label={t('ai.thinking')}>
            <span className="ai-orb ai-orb-xs" aria-hidden="true"><span className="ai-orb-ring" /><img src={FACE_THINK} alt="" /></span>
            <span className="ai-thinking-text">{t('ai.thinking')}</span>
            <span className="mi-dots"><i /><i /><i /></span>
          </div>
        ) : busy ? null : problem && last?.role === 'user' ? (
          <div className={`ai-problem is-${problem}`} role="status">
            <div className="grow">
              <p>{t(problem === 'limit' ? 'ai.limit' : problem === 'offline' ? 'ai.offline' : problem === 'stopped' ? 'ai.stopped' : 'ai.failed')}</p>
              {problem === 'limit' ? null : (
                <div className="ai-follow-in">
                  <button type="button" className="ai-chip" onClick={() => retry(who())} disabled={!online || !ready}><Icon name="refresh" size={16} /><span>{t('ai.retry')}</span></button>
                  {problem === 'stopped' ? <button type="button" className="ai-chip ai-chip-quiet" onClick={() => edit(turns.length - 1)}><Icon name="edit" size={16} /><span>{t('ai.edit')}</span></button> : null}
                </div>
              )}
            </div>
          </div>
        ) : null}
        <div ref={end} />
      </div>
      </div>

      <form className={`ai-composer${editing !== null ? ' is-editing' : ''}`} onSubmit={submit}>
        {editing !== null ? (
          <span className="ai-editing">
            <Icon name="edit" size={14} /><span className="grow">{t('ai.editing')}</span>
            <button type="button" className="ai-act" aria-label={t('pin.cancel')} onClick={() => { setEditing(null); setText(drafts()[chat] ?? '') }}><Icon name="x" size={14} /></button>
          </span>
        ) : null}
        {files.length ? (
          <div className="ai-files" role="list">
            {files.map((f, i) => (
              <span key={i} className="ai-file" role="listitem">
                {f.thumb ? <img src={f.thumb} alt="" /> : <span className="ai-file-doc"><Icon name="file" size={18} /><span>{f.name}</span></span>}
                <button type="button" className="ai-file-x" aria-label={t('ai.remove')} onClick={() => setFiles(files.filter((_, n) => n !== i))}><Icon name="x" size={12} /></button>
              </span>
            ))}
          </div>
        ) : null}
        <div className="ai-composer-row">
          <input ref={picker} type="file" hidden multiple accept="image/*,application/pdf,text/plain" onChange={(e) => void pick(e.target.files)} />
          <button type="button" className="ai-attach" aria-label={t('ai.attach')} disabled={ready === false || !!pending || files.length >= MAX_FILES}
            onClick={() => picker.current?.click()}><Icon name="clip" size={20} /></button>
          <textarea ref={box} className="ai-input" rows={1} placeholder={online ? t('ai.placeholder') : t('ai.offline')} value={text} maxLength={QUESTION_CAP} lang="tg"
            disabled={ready === false} aria-label={t('ai.placeholder')}
            onChange={(e) => write(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) send(text, files) } }} />
          {busy ? (
            <button className="ai-send is-stop" aria-label={t('ai.stop')}><Icon name="stop" size={18} fill="currentColor" /></button>
          ) : (
            <button className="ai-send" aria-label={t('support.send')} disabled={!ready || !online || !!pending || (!text.trim() && !files.length)}><Icon name="up" size={20} /></button>
          )}
        </div>
      </form>
    </div>
  )
}

/**
 * Her question in its bubble; a long one shows its first lines, fading out below (so she sees it goes on),
 * and opens whole when tapped.
 */
function Question({ text }: { text: string }) {
  const own = useRef<HTMLSpanElement>(null)
  const [long, setLong] = useState(false)
  const [whole, setWhole] = useState(false)
  useLayoutEffect(() => {
    const el = own.current
    if (el && !whole) setLong(el.scrollHeight > el.clientHeight + 4)
  }, [text, whole])
  return (
    <span ref={own} className={`ai-q${long ? ' is-long' : ''}${whole ? ' is-whole' : ''}`} onClick={() => { if (long) setWhole(true) }}>{text}</span>
  )
}

/**
 * The history of chats, over the whole screen: her name at the top (» closes); "Сӯҳбатҳо", folding; each
 * chat a plain line — its name and when — with "⋮": to the archive, or deleted for good. At the bottom a
 * search, the archive (its chats instead of the others) and a new chat.
 */
function History({ chats, open, onClose, onOpen, onNew, onRemove, onArchive }: {
  chats: AiChatMeta[]; open: string; onClose: () => void; onOpen: (id: string) => void; onNew: () => void
  onRemove: (id: string) => void; onArchive: (id: string, archived: boolean) => void
}) {
  const { t } = usePrefs()
  /** the chat whose actions are open */
  const [acts, setActs] = useState<string | null>(null)
  const [archive, setArchive] = useState(false)
  const [folded, setFolded] = useState(false)
  const [query, setQuery] = useState('')
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') (acts ? setActs(null) : onClose()) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose, acts])
  /** today, yesterday, a weekday this week, or the date */
  const when = (at: string) => {
    const d = new Date(at)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const p = (n: number) => String(n).padStart(2, '0')
    if (day === today) return t('ai.today')
    if (day === today - 86_400_000) return t('ai.yesterday')
    if (today - day < 7 * 86_400_000) return t('ai.weekdays').split('\n')[d.getDay()] ?? ''
    return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
  }
  const q = query.trim().toLowerCase()
  const list = chats.filter((c) => !!c.archived === archive && (!q || c.title.toLowerCase().includes(q)))
  // over the tab bar: drawn at the page's top level
  return createPortal(
    <div className="ai-history" role="dialog" aria-modal="true" aria-label={t('ai.history')} onClick={onClose}>
      <aside className="ai-history-panel" onClick={(e) => { e.stopPropagation(); if (acts && !(e.target as HTMLElement).closest('.ai-history-row')) setActs(null) }}>
        <header className="ai-history-head">
          {archive ? (
            <button type="button" className="ai-history-round" aria-label={t('ai.chats')} onClick={() => setArchive(false)}><Icon name="back" size={20} /></button>
          ) : <span className="ai-orb ai-orb-sm" aria-hidden="true"><img src={FACE} alt="" /></span>}
          <b className="grow">{archive ? t('ai.archived') : t('ai.title')}</b>
          <button type="button" className="ai-history-round" aria-label={t('action.close')} onClick={onClose}><Icon name="chevrons" size={20} /></button>
        </header>
        <button type="button" className="ai-history-fold" aria-expanded={!folded} onClick={() => setFolded(!folded)}>
          <span className="grow">{archive ? t('ai.archived') : t('ai.chats')}</span><Icon name={folded ? 'down' : 'up'} size={18} />
        </button>
        {folded ? null : list.length ? (
          <ul className="ai-history-list">
            {list.map((c) => (
              <li key={c.id} className={`ai-history-row${c.id === open ? ' is-open' : ''}`}>
                <button type="button" className="grow" aria-label={c.title || '…'} aria-current={c.id === open || undefined} onClick={() => onOpen(c.id)}>
                  <span className="ai-history-title">{c.title || '…'}</span>
                  <span className="ai-history-when">{when(c.at)}</span>
                </button>
                <button type="button" className="ai-act ai-history-dots" aria-label={`${t('ai.chat_actions')}: ${c.title}`} aria-expanded={acts === c.id}
                  onClick={() => setActs(acts === c.id ? null : c.id)}><Icon name="more" size={18} /></button>
                {acts === c.id ? (
                  <div className="ai-history-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => { onArchive(c.id, !c.archived); setActs(null) }}>
                      <Icon name="archive" size={17} />{c.archived ? t('ai.unarchive') : t('ai.archive')}
                    </button>
                    <button type="button" role="menuitem" className="is-danger" onClick={() => { onRemove(c.id); setActs(null) }}>
                      <Icon name="trash" size={17} />{t('ai.delete_full')}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className="ai-history-none">{t('ai.no_chats')}</p>}
        <footer className="ai-history-foot">
          <label className="ai-history-search">
            <Icon name="search" size={19} />
            <input type="search" value={query} placeholder={t('action.search')} aria-label={t('action.search')} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className={`ai-history-round${archive ? ' is-on' : ''}`} aria-label={t('ai.archived')} aria-pressed={archive} onClick={() => setArchive(!archive)}>
            <Icon name="archive" size={20} />
          </button>
          <button type="button" className="ai-history-round" aria-label={t('ai.clear')} onClick={onNew}><Icon name="edit" size={20} /></button>
        </footer>
      </aside>
    </div>,
    document.body
  )
}

/** Her answer's words in a sheet where any part of them can be selected (and copied with the phone's own tools). */
function SelectText({ text, onClose }: { text: string; onClose: () => void }) {
  const { t } = usePrefs()
  const area = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    area.current?.focus()
    area.current?.setSelectionRange(0, 0)
  }, [])
  return createPortal(
    <div className="ai-select" role="dialog" aria-modal="true" aria-label={t('ai.select')} onClick={onClose}>
      <div className="ai-select-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="ai-history-head">
          <b className="grow">{t('ai.select')}</b>
          <button type="button" className="ai-history-round" aria-label={t('action.close')} onClick={onClose}><Icon name="x" size={18} /></button>
        </header>
        <textarea ref={area} className="ai-select-text" readOnly value={text} />
      </div>
    </div>,
    document.body
  )
}

/** The pictures (small) and files (by name) sent with a question. */
function Attached({ files }: { files: AiFileView[] }) {
  return (
    <div className="ai-attached">
      {files.map((f, i) => (f.thumb ? <img key={i} src={f.thumb} alt={f.name} /> : (
        <span key={i} className="ai-file-doc"><Icon name="file" size={16} /><span>{f.name}</span></span>
      )))}
    </div>
  )
}

/** Her short lines over the conversation's start, one after another: each comes in softly and goes. */
function Taglines({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (lines.length < 2) return
    const every = setInterval(() => setI((n) => (n + 1) % lines.length), 3600)
    return () => clearInterval(every)
  }, [lines.length])
  return (
    <h2 className="ai-greet" aria-live="polite">
      <span key={i} className="ai-greet-line">{lines[i % lines.length]}</span>
    </h2>
  )
}

/**
 * Short questions to start with, in two rows laid like bricks that keep gliding past in opposite ways,
 * coming in and fading out at the edges (a touch holds them). A line "📈 Пешрафти ман" shows its sign
 * and sends only its words.
 */
function Suggestions({ lines, disabled, onPick }: { lines: string[]; disabled: boolean; onPick: (q: string) => void }) {
  const chips = lines.map((l) => {
    const [first, ...rest] = l.trim().split(' ')
    return /\p{L}/u.test(first) ? { icon: '', text: l.trim() } : { icon: first, text: rest.join(' ') }
  })
  const rows = [chips.filter((_, i) => i % 2 === 0), chips.filter((_, i) => i % 2 === 1)]
  return (
    <div className="ai-marquee" role="list">
      {rows.map((row, r) => (
        <div key={r} className="ai-row">
          <div className="ai-track">
            {/* twice over, so the row runs on without a seam; the copy is for the eye only */}
            {[...row, ...row].map((c, i) => (
              <button key={i} type="button" className="ai-chip" role={i < row.length ? 'listitem' : undefined} aria-hidden={i >= row.length || undefined}
                tabIndex={i < row.length ? undefined : -1} disabled={disabled} onClick={() => onPick(c.text)}>
                {c.icon ? <span className="ai-chip-icon" aria-hidden="true">{c.icon}</span> : null}<span>{c.text}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
