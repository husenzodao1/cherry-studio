'use client'

import { Capacitor } from '@capacitor/core'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { findCommands, splitCommand, withCommand } from '@/lib/aiCommands'
import { onBack } from '@/web/components/BackButton'

import { AttachSheet } from '@/web/components/AttachSheet'
import { SlashMenu } from '@/web/components/SlashMenu'
import { SlidesSetup } from '@/web/components/SlidesSetup'
import { DocViewer, type DocSource } from '@/web/components/DocViewer'
import { MODE_ICON } from '@/web/aiModes'
import { PhotoMarker } from '@/web/components/PhotoMarker'
import { useScreenshot } from '@/web/components/ScreenGuard'
import { Icon } from '@/web/components/Icon'
import { emojify } from '@/web/components/Emoji'
import { AnswerBlocks, Sources, timingOf } from '@/web/components/MahliyoBlocks'
import { showToast } from '@/web/components/Toast'
import { useContent } from '@/web/offline/content'
import { useAuth } from '@/web/auth'
import { useLearner } from '@/web/offline/learner'
import { useApi } from '@/web/useApi'
import {
  aboutMe, accountChanged, girlyChanged, keptFile, aiReady, archiveChat, tempChat, leaveTemp, ask, copyOf, QUESTION_CAP, copyText, drawn, FileProblem, FILES_CAP, MAX_FILES, newChat, openChat, prepareFile, keepChatsForever, rate, removeChat, retry, shareChat, stop,
  useMahliyo, watch, type AiChatMeta, type AiMode, type AiFileView, type AiTurn, type AiUpload
} from '@/web/offline/mahliyo'
import { alphaVideo, CLIPS } from '@/web/mahliyo'
import { placeNote, refreshPlace } from '@/web/offline/place'
import { usePrefs } from '@/web/prefs'

const FACE = '/assets/mascot/face.webp'
const FACE_THINK = '/assets/mascot/face-think.webp'
/** a second "back" within this long leaves her full screen */
const EXIT_MS = 2000
/** rubber at the chat's ends: the share of the finger's travel it follows, and how far it can go */
const PULL = 0.3
const STRETCH = 90
/** questions one chat holds; then it says its context is over (a Premium account has no such end) */
const CHAT_LIMIT = 20
/** pulled down this far at the top of a chat, it lets go into a new chat */
const NEW_AT = 64

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
  const { t, mode: appMode } = usePrefs()
  const { learner, progress } = useLearner()
  const { session } = useAuth()
  const me = useApi<{ premium?: boolean }>(session ? '/me' : null)
  // a Premium account keeps its chats; the others, a week
  useEffect(() => { if (me.data || !session) keepChatsForever(!!me.data?.premium) }, [me.data, session])
  const { bundle } = useContent()
  const { chat, chats, turns, pending, problem, fresh, online, temp } = useMahliyo()
  const [history, setHistory] = useState(false)
  const [ready, setReady] = useState<boolean | null>(null)
  const [text, setText] = useState('')
  /** the question being edited (its index), or none */
  const [editing, setEditing] = useState<number | null>(null)
  /** the question whose actions are shown (the last one's always are) */
  const [opened, setOpened] = useState<number | null>(null)
  /** pictures and files chosen for the next question */
  const [files, setFiles] = useState<AiUpload[]>([])
  /** the picture opened to mark with the red pen */
  const [marking, setMarking] = useState<number | null>(null)
  // the paperclip's sheet, and the way she asked to be answered (kept on the phone)
  const [sheet, setSheet] = useState(false)
  const [mode, setModeState] = useState<AiMode | null>(null)
  /** a screenshot of this chat was just taken: the card that offers to share it */
  const [shot, setShot] = useState(false)
  const current = chats.find((c) => c.id === chat)
  // a temporary chat is not shared (it is kept nowhere)
  useScreenshot(!!current && !temp && turns.length > 0, () => setShot(true))
  const closeShot = useCallback(() => setShot(false), [])
  /** the ready command chosen after "/" (a grey chip in the box; it goes first in the question) */
  const [command, setCommand] = useState<string | null>(null)
  /** "/" typed at the start: the list of ready commands, for the words after it */
  const slash = command === null && /^\/[^\n]*$/.test(text) ? text.slice(1) : null
  /** "Презентатсия": its setup (style, slides) before asking */
  const [slides, setSlides] = useState(false)
  const pickCommand = (title: string) => {
    if (title === 'презентатсия') { write(''); setSlides(true); return }
    setCommand(title)
    write('')
    box.current?.focus()
  }
  useEffect(() => { try { setModeState((localStorage.getItem('dk.ai.mode') as AiMode | null) || null) } catch { /* none */ } }, [])
  const setMode = (m: AiMode | null) => {
    setModeState(m)
    try { if (m) localStorage.setItem('dk.ai.mode', m); else localStorage.removeItem('dk.ai.mode') } catch { /* only for now */ }
  }
  const scroller = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const pull = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const box = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  /** she is answering a question of this chat (one question at a time, in any chat) */
  const busy = !!pending && pending.chat === chat
  /** the question is still on its way (no id from the server yet) */
  const sending = busy && !pending.id
  /** this chat has held as many questions as it can (not for a Premium account): a new chat goes on */
  const full = !me.data?.premium && turns.filter((m) => m.role === 'user').length >= CHAT_LIMIT && !busy

  useEffect(() => watch(), [])
  // opened from her circle in the tab bar: the chat pours out of it
  const [genie, setGenie] = useState(false)
  useLayoutEffect(() => {
    // opened from the tab bar with a view transition: the new screen is there, it may pour out now
    window.dispatchEvent(new Event('dk:ai-shown'))
    let from = false
    try {
      from = sessionStorage.getItem('dk.ai-genie') === '1'
      sessionStorage.removeItem('dk.ai-genie')
    } catch { /* no animation */ }
    if (!from) return
    setGenie(true)
    const done = setTimeout(() => setGenie(false), 700)
    return () => clearTimeout(done)
  }, [])
  /** a question begun elsewhere (a lesson's circle), put into the box of the new chat once it opens */
  const prefill = useRef<string | null>(null)
  // a chat opens with what she had begun writing in it
  useEffect(() => {
    setEditing(null)
    const begun = prefill.current
    prefill.current = null
    if (begun) keepDraft(chat, begun)
    setText(begun ?? drafts()[chat] ?? '')
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

  /** a new chat (the menu's button, or the chat pulled down at its top) */
  const startNew = () => {
    newChat()
    setFiles([])
  }
  // opened from a lesson's circle ("what is unclear here?"): a new chat with the question begun in the box
  useEffect(() => {
    let asked: string | null = null
    try {
      asked = sessionStorage.getItem('dk.ai.ask')
      sessionStorage.removeItem('dk.ai.ask')
    } catch { /* storage blocked */ }
    if (!asked) return
    prefill.current = asked
    startNew()
    setTimeout(() => {
      // the chat was new already (no change of chat to carry it in): put it in now
      if (prefill.current) { setText(prefill.current); prefill.current = null }
      const el = box.current
      if (!el) return
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }, 120)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // her rough place, looked at again when a day old (only if she allowed it)
  useEffect(() => { void refreshPlace() }, [])
  const startNewRef = useRef(startNew)
  startNewRef.current = startNew
  const hasTurns = useRef(false)
  hasTurns.current = turns.length > 0 && !pending

  // only the conversation moves; at its ends it stretches like rubber and springs back. Pulled far enough
  // up at its end, it lets go into a new chat (the sign below it fills as it is pulled).
  useEffect(() => {
    const el = scroller.current
    const body = inner.current
    const sign = pull.current
    if (!el || !body || !sign) return
    let y0 = 0
    let d = 0
    let ready = false
    const show = () => {
      const p = hasTurns.current && d < 0 ? Math.min(-d / NEW_AT, 1) : 0
      sign.style.setProperty('--p', String(p))
      if (p >= 1 !== ready) {
        ready = p >= 1
        sign.classList.toggle('is-ready', ready)
        if (ready) try { navigator.vibrate?.(12) } catch { /* no vibration */ }
      }
    }
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
        show()
        if (e.cancelable) e.preventDefault()
      } else if (d) {
        d = 0
        body.style.transform = ''
        show()
        y0 = e.touches[0].clientY
      }
    }
    const end = () => {
      if (!d) return
      if (ready) {
        // let go: the old chat slides up and away, the new one rises from below
        body.style.transition = 'transform 0.32s ease-in, opacity 0.32s ease-in'
        body.style.transform = `translateY(${-STRETCH * 2}px)`
        body.style.opacity = '0'
        setTimeout(() => {
          startNewRef.current()
          body.style.transition = 'none'
          body.style.transform = 'translateY(24px)'
          requestAnimationFrame(() => {
            body.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.45s ease-out'
            body.style.transform = ''
            body.style.opacity = ''
          })
        }, 320)
      } else {
        body.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.15)'
        body.style.transform = ''
      }
      d = 0
      show()
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
  // whether she can answer: looked at again (every few seconds, and when the connection comes back) until
  // she can — a failed first look (a weak connection on opening) must not leave "she is not ready yet"
  useEffect(() => {
    let alive = true
    let again = 0
    const look = () => void aiReady().then((r) => {
      if (!alive) return
      setReady(r)
      clearTimeout(again)
      if (!r) again = window.setTimeout(look, 5000)
    })
    look()
    window.addEventListener('online', look)
    return () => { alive = false; clearTimeout(again); window.removeEventListener('online', look) }
  }, [])
  // read further up: a small button takes her back down (with her dots while she is writing below)
  const [below, setBelow] = useState(false)
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const look = () => setBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 160)
    look()
    el.addEventListener('scroll', look, { passive: true })
    const grew = new ResizeObserver(look)
    if (inner.current) grew.observe(inner.current)
    return () => { el.removeEventListener('scroll', look); grew.disconnect() }
  }, [])
  const down = () => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  // her new answer is read from its beginning; otherwise the newest line stays in view
  useEffect(() => {
    const answer = !busy && turns[turns.length - 1]?.role === 'assistant' ? [...document.querySelectorAll('.ai-said')].pop() : null
    if (answer) answer.scrollIntoView({ block: 'start', behavior: 'smooth' })
    // the newest line — her question, then "she is thinking" once it arrived — in view above the box
    else scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns.length, busy, sending, problem, chat])
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

  const who = () => ({ code: learner?.code, name: learner?.name, me: aboutMe(learner?.name, progress, bundle), account: learner?.code || learner?.email, place: placeNote(), ...(mode ? { mode } : {}), ...(appMode === 'boy' ? { gender: 'boy' as const } : {}) })
  const send = (question: string, withFiles: AiUpload[] = []) => {
    // a picture alone asks her to look at it
    const said = question.trim() || (withFiles.length ? t('ai.look') : '')
    const q = command ? withCommand(command, said) : said
    if (!q || pending || !ready || (full && editing === null)) return
    void ask(q, who(), editing ?? undefined, withFiles)
    setCommand(null)
    // a new question was the draft; after an edit, the draft comes back
    if (editing === null) keepDraft(chat, '')
    setText(editing === null ? '' : drafts()[chat] ?? '')
    setFiles([])
    setEditing(null)
    setOpened(null)
  }
  const pick = async (chosen: FileList | File[] | null) => {
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
    // a question with a ready command: the chip again, and her words
    const { command: had, rest } = splitCommand(turns[i].content)
    setCommand(had?.title ?? null)
    setText(had ? rest : turns[i].content)
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
  const lastAsked = lastQuestion >= 0 ? turns[lastQuestion].content : ''
  const first = learner?.name?.split(/\s+/)[0]
  /** the empty box shows a hint that changes every few seconds */
  const hinting = online && !text && command === null && ready !== false

  return (
    <div className={`ai-scene${busy ? ' is-thinking' : ''}${genie ? ' is-genie' : ''}`}>
      <header className="ai-top">
        <span className="ai-orb ai-orb-sm" aria-hidden="true"><span className="ai-orb-ring" /><img src={busy ? FACE_THINK : FACE} alt="" /></span>
        <div className="grow">
          <h1 className="ai-name">{t('ai.title')}</h1>
          <span className={`ai-status${busy ? ' is-busy' : ''}`} aria-live="polite">{sending ? t('ai.sending') : busy ? t('ai.thinking') : t('ai.subtitle')}</span>
        </div>
        <button type="button" className="ai-menu" aria-label={t('ai.clear')} onClick={startNew} disabled={!turns.length && !temp}><Icon name="compose" size={21} /></button>
        <button type="button" className="ai-menu" aria-label={t('ai.history')} aria-haspopup="dialog" onClick={() => { leaveTemp(); setHistory(true) }}><Icon name="menu" size={22} /></button>
        <button type="button" className={`ai-menu ai-temp${temp ? ' is-on' : ''}`} aria-label={t('ai.temp')} aria-pressed={!!temp}
          onClick={() => { if (temp) startNew(); else { tempChat(); setFiles([]) } }}><Icon name="ghostChat" size={21} /></button>
        <button type="button" className="ai-menu ai-leave" aria-label={t('ai.leave')} onClick={leave}><Icon name="x" size={20} /></button>
      </header>
      {selecting !== null ? <SelectText text={selecting} onClose={() => setSelecting(null)} /> : null}
      {history ? (
        <History chats={chats} open={chat} onClose={() => setHistory(false)}
          onOpen={(id) => { openChat(id); setHistory(false) }}
          onNew={() => { startNew(); setHistory(false) }}
          onRemove={removeChat} onArchive={archiveChat} />
      ) : null}

      {shot && current && !temp ? <ShotShare chat={current} onClose={closeShot} /> : null}
      {temp ? <p className="ai-temp-note" role="status"><Icon name="ghostChat" size={16} /><span>{t('ai.temp_on')}</span></p> : null}
      {online ? null : (
        <p className="ai-offline" role="status"><Icon name="globe" size={18} /><span>{t('ai.offline')}{busy ? ` ${t('ai.offline_wait')}` : ''}</span></p>
      )}

      {/* the chat, and under its end (not inside it, so it never lies over her words) the "new chat" sign */}
      <div className="ai-stage">
      <div className="ai-pull" ref={pull} aria-hidden="true">
        <svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" pathLength="1" /></svg>
        <Icon name="compose" size={16} />
        <span>{t('ai.clear')}</span>
      </div>
      <div className="ai-scroll" ref={scroller}>
      <div className="ai-chat" ref={inner}>
        {turns.length ? null : (
          <section className="ai-hero">
            <HeroPortrait />
            <Taglines lines={t(taglinesKey(new Date().getHours())).split('\n').filter(Boolean).map((l) => (first ? l.replace('{name}', first) : l.replace(/,?\s*\{name\}/, '')))} />
            {/* no line under her greeting: only when she is not there yet, why */}
            {ready === false ? <p className="ai-hello">{t('ai.soon')}</p> : null}
            {ready === false ? (
              <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link>
            ) : <Suggestions lines={t('ai.suggest').split('\n').filter(Boolean)} disabled={!ready || !online} onPick={send} />}
          </section>
        )}

        {turns.map((m, i) => (m.role === 'user' ? (
          <Fragment key={i}>
          {/* the account on this phone was changed: what follows is the new one's */}
          {accountChanged(turns, i) ? <div className="ai-switched" role="separator"><span>{t('ai.account_switched')}</span></div> : null}
          {/* a boy's chat: a thin line where the girls' mode was turned on or off */}
          {appMode === 'boy' && girlyChanged(turns, i) !== null ? <div className="ai-switched is-mode" role="separator"><span>{t(girlyChanged(turns, i) ? 'ai.girly_on' : 'ai.girly_off')}</span></div> : null}
          <div className={`ai-asked${editing === i ? ' is-editing' : ''}`}>
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
          </Fragment>
        ) : (
          <div key={i} className="ai-said">
            <div className="grow">
              <AnswerBlocks blocks={m.blocks?.length ? m.blocks : [{ type: 'text', text: m.content }]} fresh={i === fresh}
                id={m.id ?? m.at} onQuiz={(result) => send(result)} onAsk={i === turns.length - 1 ? (text) => send(text) : undefined} onSend={(text, f) => send(text, f)} />
              {m.tajik === false ? <Link href="/support" className="btn btn-soft ai-consultant"><Icon name="bell" size={16} /> {t('ai.to_consultant')}</Link> : null}
              <div className="ai-acts ai-acts-start">
                <button type="button" className="ai-act" onClick={() => copy(m)} aria-label={t('ai.copy')}><Icon name="copy" size={16} /></button>
                <button type="button" className="ai-act" onClick={() => setSelecting(textOf(m))} aria-label={t('ai.select')}><Icon name="select" size={16} /></button>
                <button type="button" className="ai-act" onClick={() => share(m)} aria-label={t('ai.share')}><Icon name="share" size={16} /></button>
                <button type="button" className={`ai-act${m.rating === 1 ? ' is-on' : ''}`} aria-pressed={m.rating === 1} onClick={() => rate(i, 1)} aria-label={t('ai.like')}>
                  <Icon name="thumb-up" size={16} fill={m.rating === 1 ? 'currentColor' : 'none'} />
                </button>
                <button type="button" className={`ai-act${m.rating === -1 ? ' is-on' : ''}`} aria-pressed={m.rating === -1} onClick={() => rate(i, -1)} aria-label={t('ai.dislike')}>
                  <Icon name="thumb-down" size={16} fill={m.rating === -1 ? 'currentColor' : 'none'} />
                </button>
                {/* where her answer came from: at the end of the row, small */}
                {m.blocks?.map((b, n) => (b.type === 'sources' ? <Sources key={n} items={b.items} /> : null))}
              </div>
            </div>
          </div>
        )))}

        {busy && !sending ? (
          <div className="ai-thinking" aria-label={t('ai.thinking')}>
            <span className="ai-orb ai-orb-xs" aria-hidden="true"><span className="ai-orb-ring" /><img src={FACE_THINK} alt="" /></span>
            <span className="grow">
              <span className="ai-thinking-row"><ThinkingWords /><span className="mi-dots"><i /><i /><i /></span></span>
              {pending?.books ? <BooksHint since={pending.since} /> : null}
              {makingFile(lastAsked) ? <FileSteps /> : null}
            </span>
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
      </div>
      </div>
      </div>

      {full ? (
        <div className="ai-limit" role="status">
          <p>{t('ai.limit_reached')}</p>
          <button type="button" className="ai-limit-new" onClick={startNew}><Icon name="compose" size={14} />{t('ai.clear')}</button>
        </div>
      ) : (
      <form className={`ai-composer${editing !== null ? ' is-editing' : ''}${busy ? ' is-busy' : ''}`} onSubmit={submit}>
        {/* while she answers: a thin gradient light runs round the box */}
        {busy ? <span className="ai-ring" aria-hidden="true" /> : null}
        {below ? (
          <button type="button" className={`ai-down${busy ? ' is-writing' : ''}`} onClick={down} aria-label={busy ? `${t('ai.scroll_down')} · ${t('ai.thinking')}` : t('ai.scroll_down')}>
            {busy ? <span className="mi-dots"><i /><i /><i /></span> : <Icon name="arrow-down" size={18} />}
          </button>
        ) : null}
        {editing !== null ? (
          <span className="ai-editing">
            <Icon name="edit" size={14} /><span className="grow">{t('ai.editing')}</span>
            <button type="button" className="ai-act" aria-label={t('pin.cancel')} onClick={() => { setEditing(null); setCommand(null); setText(drafts()[chat] ?? '') }}><Icon name="x" size={14} /></button>
          </span>
        ) : null}
        {files.length ? (
          <div className="ai-files" role="list">
            {files.map((f, i) => (
              <span key={i} className={`ai-file${f.thumb ? ' is-photo' : ''}`} role="listitem">
                {f.thumb ? (
                  <button type="button" className="ai-file-photo" aria-label={t('ai.mark_title')} onClick={() => setMarking(i)}>
                    <img src={f.thumb} alt="" /><span className="ai-file-pen"><Icon name="edit" size={12} /></span>
                  </button>
                ) : <span className="ai-file-doc"><Icon name="file" size={18} /><span>{f.name}</span></span>}
                <button type="button" className="ai-file-x" aria-label={t('ai.remove')} onClick={() => setFiles(files.filter((_, n) => n !== i))}><Icon name="x" size={12} /></button>
              </span>
            ))}
          </div>
        ) : null}
        {marking !== null && files[marking] ? (
          <PhotoMarker file={files[marking]} onClose={() => setMarking(null)}
            onDone={(f) => { setFiles(files.map((x, n) => (n === marking ? f : x))); setMarking(null) }} />
        ) : null}
        {mode ? (
          <span className="ai-mode-chip"><Icon name={MODE_ICON[mode]} size={14} />{t(`ai.mode_${mode}`)}
            <button type="button" aria-label={t('ai.remove')} onClick={() => setMode(null)}><Icon name="x" size={12} /></button></span>
        ) : null}
        {command !== null ? (
          <span className="ai-cmd-chip">/{command}
            <button type="button" aria-label={t('ai.remove')} onClick={() => { setCommand(null); box.current?.focus() }}><Icon name="x" size={12} /></button></span>
        ) : null}
        {slash !== null ? <SlashMenu query={slash} onPick={pickCommand} /> : null}
        {slides ? <SlidesSetup onClose={() => setSlides(false)} onSend={(q) => { setSlides(false); send(q) }} /> : null}
        {sheet ? <AttachSheet max={MAX_FILES - files.length} mode={mode} onMode={(m) => { setMode(m); setSheet(false) }} onCommand={(c) => { setSheet(false); pickCommand(c) }} onFiles={(f) => void pick(f)} onClose={() => setSheet(false)} /> : null}
        <div className="ai-composer-row">
          <input ref={picker} type="file" hidden multiple accept="image/*,application/pdf,text/plain" onChange={(e) => void pick(e.target.files)} />
          <button type="button" className="ai-attach" aria-label={t('ai.attach')} disabled={ready === false || !!pending || files.length >= MAX_FILES}
            onClick={() => setSheet(true)}><Icon name="clip" size={20} /></button>
          <EmojiBox text={text}>
            <textarea ref={box} className="ai-input" rows={1} placeholder={online ? (hinting ? '' : t('ai.placeholder')) : t('ai.offline')} value={text} maxLength={QUESTION_CAP} lang="tg"
              disabled={ready === false} aria-label={t('ai.placeholder')}
              onChange={(e) => write(e.target.value)}
              onKeyDown={(e) => {
                // in the list of commands: Enter takes the first that fits, Escape closes it
                if (slash !== null && e.key === 'Enter') { e.preventDefault(); const first = findCommands(slash)[0]; if (first) pickCommand(first.title); return }
                if (slash !== null && e.key === 'Escape') { e.preventDefault(); write(''); return }
                // Backspace in an empty box takes the chip away
                if (command !== null && e.key === 'Backspace' && !text) { e.preventDefault(); setCommand(null); return }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) send(text, files) }
              }} />
            {hinting ? <RotatingHint lines={t('ai.placeholders').split('\n').filter(Boolean)} /> : null}
          </EmojiBox>
          {busy ? (
            <button className="ai-send is-stop" aria-label={t('ai.stop')}><Icon name="stop" size={18} fill="currentColor" /></button>
          ) : (
            <button className="ai-send" aria-label={t('support.send')} disabled={!ready || !online || !!pending || (!text.trim() && !files.length && command === null)}><Icon name="up" size={20} /></button>
          )}
        </div>
      </form>
      )}
    </div>
  )
}

/** while she thinks: "Маҳлиё фикр мекунад…", then every few seconds the next line, round and round */
const THINKING_LINES = ['ai.thinking', 'ai.thinking_2', 'ai.thinking_3'] as const
const THINKING_MS = 4000
function ThinkingWords() {
  const { t } = usePrefs()
  const [n, setN] = useState(0)
  useEffect(() => {
    const next = setInterval(() => setN((x) => (x + 1) % THINKING_LINES.length), THINKING_MS)
    return () => clearInterval(next)
  }, [])
  return <span key={n} className="ai-thinking-text" aria-live="polite">{t(THINKING_LINES[n])}</span>
}

/** the empty box's hint: the next one every few seconds, rising softly into place */
const HINT_MS = 3000
function RotatingHint({ lines }: { lines: string[] }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const next = setInterval(() => setN((x) => (x + 1) % Math.max(lines.length, 1)), HINT_MS)
    return () => clearInterval(next)
  }, [lines.length])
  return <span key={n} className="ai-hint" aria-hidden="true">{lines[n % Math.max(lines.length, 1)]}</span>
}

/** whether a question asks her to make a file (a ready file command, or the words of one) */
function makingFile(q: string) {
  const { command } = splitCommand(q)
  if (command?.group.id === 'files') return true
  return /\b(pdf|docx?|pptx?|word|powerpoint|txt|html|py)\b|пдф|ворд|презент|файл|иншо.*(соз|навис)|эссе/i.test(q)
}

/**
 * Under "she is thinking", while she makes a file: small lines one after another, a light sweeping over
 * each — the file is being prepared, the topics go in, the last point is written…
 */
const FILE_STEPS = ['ai.file_step_1', 'ai.file_step_2', 'ai.file_step_3', 'ai.file_step_4', 'ai.file_step_5'] as const
function FileSteps() {
  const { t } = usePrefs()
  const [n, setN] = useState(0)
  useEffect(() => {
    // the last line stays until the file is ready
    const next = setInterval(() => setN((x) => Math.min(x + 1, FILE_STEPS.length - 1)), 6000)
    return () => clearInterval(next)
  }, [])
  return <span key={n} className="ai-books-hint ai-file-step" role="status">{t(FILE_STEPS[n])}</span>
}

/** a wait this long, with books: she is searching the company's own sources */
const BOOKS_AFTER_MS = 2500
/** Under "she is thinking", once she takes a while and has books: a tiny line, a light sweeping over it. */
function BooksHint({ since }: { since: number }) {
  const { t } = usePrefs()
  const [show, setShow] = useState(() => Date.now() - since >= BOOKS_AFTER_MS)
  useEffect(() => {
    if (show) return
    const later = setTimeout(() => setShow(true), Math.max(0, BOOKS_AFTER_MS - (Date.now() - since)))
    return () => clearTimeout(later)
  }, [show, since])
  return show ? <span className="ai-books-hint" role="status">{t('ai.books_search')}</span> : null
}

/**
 * The box to write in, its emoji drawn as the chat's own as soon as they are typed: the words stay in the
 * box (the caret, the selection), a copy beneath it draws them with the pictures, each as wide as the
 * phone's emoji in the box, so every letter stays where it is.
 */
function EmojiBox({ text, children }: { text: string; children: ReactNode }) {
  const own = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)
  const drawn = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(text)
  useLayoutEffect(() => {
    const wrap = own.current
    const box = wrap?.querySelector('textarea')
    if (!wrap || !box || !drawn) return
    try {
      const ctx = document.createElement('canvas').getContext('2d')
      if (ctx) {
        ctx.font = getComputedStyle(box).font
        wrap.style.setProperty('--emo-w', `${ctx.measureText('\u{1F600}').width}px`)
      }
    } catch { /* the pictures keep their own width */ }
    const follow = () => { if (copy.current) copy.current.scrollTop = box.scrollTop }
    follow()
    box.addEventListener('scroll', follow)
    return () => box.removeEventListener('scroll', follow)
  }, [drawn, text])
  return (
    <div ref={own} className={`ai-input-wrap${drawn ? ' has-emo' : ''}`}>
      {drawn ? <div ref={copy} className="ai-input ai-input-copy" aria-hidden="true">{emojify(text)}{'\u200b'}</div> : null}
      {children}
    </div>
  )
}

/**
 * Her question in its bubble; a long one shows its first lines, fading out below (so she sees it goes on),
 * and opens whole when tapped.
 */
function Question({ text: said }: { text: string }) {
  const { command, rest: text } = splitCommand(said)
  const own = useRef<HTMLSpanElement>(null)
  const [long, setLong] = useState(false)
  const [whole, setWhole] = useState(false)
  useLayoutEffect(() => {
    const el = own.current
    if (el && !whole) setLong(el.scrollHeight > el.clientHeight + 4)
  }, [text, whole])
  return (
    <span ref={own} className={`ai-q${long ? ' is-long' : ''}${whole ? ' is-whole' : ''}`} onClick={() => { if (long) setWhole(true) }}>
      {command ? <span className="ai-cmd-chip is-sent">/{command.title}</span> : null}{text ? emojify(text) : null}</span>
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
                <button type="button" className="ai-act ai-history-dots" aria-label={`${t('ai.chat_actions')}: ${c.title}`} aria-haspopup="dialog"
                  onClick={() => setActs(c.id)}><Icon name="more" size={18} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="ai-history-none">{t('ai.no_chats')}</p>}
        <p className="ai-history-keep">{t('ai.keep_week')}</p>
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
      {acts ? (() => {
        const c = chats.find((x) => x.id === acts)
        return c ? <ChatActions chat={c} onClose={() => setActs(null)} onArchive={() => onArchive(c.id, !c.archived)} onRemove={() => onRemove(c.id)} /> : null
      })() : null}
    </div>,
    document.body
  )
}

/** A chat's link to the phone's share sheet (the browser's, or copied where there is none). */
async function sendLink(title: string, link: string, t: ReturnType<typeof usePrefs>['t']) {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    return void Share.share({ title, url: link, dialogTitle: t('ai.share_link') }).catch(() => undefined)
  }
  if (navigator.share) return void navigator.share({ title, url: link }).catch(() => undefined)
  showToast(t((await copyText(link)) ? 'ai.copied' : 'ai.unavailable'), 'copy')
}

/**
 * The chat was screenshotted: a card slides down from the top — "you took a screenshot; share the whole
 * chat?" — the share icon makes its link and opens the share sheet, ✕ (or a while) puts it away.
 */
const SHOT_MS = 9000
function ShotShare({ chat, onClose }: { chat: AiChatMeta; onClose: () => void }) {
  const { t } = usePrefs()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const away = setTimeout(onClose, SHOT_MS)
    return () => clearTimeout(away)
  }, [onClose])
  const share = async () => {
    setBusy(true)
    try {
      await sendLink(chat.title, await shareChat(chat.id), t)
      onClose()
    } catch {
      showToast(t('ai.unavailable'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="ai-shot" role="status">
      <div className="grow">
        <b>{t('ai.shot_title')}</b>
        <span>{t('ai.shot_text')}</span>
      </div>
      <button type="button" className="ai-shot-share" aria-label={t('ai.share_link')} disabled={busy} onClick={() => void share()}><Icon name="share" size={26} /></button>
      <button type="button" className="ai-shot-x" aria-label={t('action.close')} onClick={onClose}><Icon name="x" size={16} /></button>
    </div>
  )
}

/**
 * A chat's actions, over the whole screen in the app's look: its name, then a choice (one at a time, as
 * radio buttons) — to the archive (or back), share as a link, delete for good — and "Минбаъд" at the
 * bottom. Shared, the link is shown with "copy" and the phone's share sheet.
 */
function ChatActions({ chat, onClose, onArchive, onRemove }: { chat: AiChatMeta; onClose: () => void; onArchive: () => void; onRemove: () => void }) {
  const { t } = usePrefs()
  const [pick, setPick] = useState<'archive' | 'share' | 'delete' | null>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const options: { id: 'archive' | 'share' | 'delete'; icon: 'archive' | 'share' | 'trash'; label: string; hint?: string }[] = [
    { id: 'archive', icon: 'archive', label: chat.archived ? t('ai.unarchive') : t('ai.archive') },
    { id: 'share', icon: 'share', label: t('ai.share_link') },
    { id: 'delete', icon: 'trash', label: t('ai.delete_full'), hint: t('ai.delete_hint') }
  ]
  const next = async () => {
    if (pick === 'archive') { onArchive(); return onClose() }
    if (pick === 'delete') { onRemove(); return onClose() }
    if (pick === 'share') {
      setBusy(true)
      try {
        setLink(await shareChat(chat.id))
      } catch {
        showToast(t('ai.unavailable'), 'alert')
      } finally {
        setBusy(false)
      }
    }
  }
  const send = async () => { if (link) await sendLink(chat.title, link, t) }
  return (
    <div className="ai-actions" role="dialog" aria-modal="true" aria-label={t('ai.chat_actions')} onClick={(e) => e.stopPropagation()}>
      <header className="ai-actions-head">
        <button type="button" className="ai-history-round" aria-label={t('action.close')} onClick={onClose}><Icon name="x" size={20} /></button>
      </header>
      <div className="ai-actions-body">
        <span className="ai-actions-icon" aria-hidden="true"><Icon name="menu" size={22} /></span>
        <h2 className="ai-actions-title">{emojify(chat.title || '…')}</h2>
        {link ? (
          <div className="ai-actions-link">
            <b>{t('ai.link_ready')}</b>
            <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
            <div className="ai-actions-link-btns">
              <button type="button" className="btn btn-soft" onClick={async () => showToast(t((await copyText(link)) ? 'ai.copied' : 'ai.unavailable'), 'copy')}><Icon name="copy" size={16} /> {t('ai.copy_link')}</button>
              <button type="button" className="btn" onClick={() => void send()}><Icon name="share" size={16} /> {t('ai.share_link')}</button>
            </div>
          </div>
        ) : (
          <div className="ai-actions-list" role="radiogroup" aria-label={t('ai.chat_actions')}>
            {options.map((o) => (
              <label key={o.id} className={`ai-actions-option${pick === o.id ? ' is-on' : ''}${o.id === 'delete' ? ' is-danger' : ''}`}>
                <input type="radio" name="chat-action" value={o.id} checked={pick === o.id} onChange={() => setPick(o.id)} />
                <span className="ai-actions-option-icon"><Icon name={o.icon} size={19} /></span>
                <span className="grow"><b>{o.label}</b>{o.hint ? <span>{o.hint}</span> : null}</span>
                <i className="ai-actions-radio" aria-hidden="true" />
              </label>
            ))}
          </div>
        )}
      </div>
      {link ? null : (
        <footer className="ai-actions-foot">
          <button type="button" className={`btn btn-block${pick === 'delete' ? ' btn-danger' : ''}`} disabled={!pick || busy} onClick={() => void next()}>
            {busy ? t('ai.sending') : t('ai.next')}
          </button>
        </footer>
      )}
    </div>
  )
}

/**
 * Her portrait over a new chat: the clip of the sign-in screen, silent and once (she leafs through her
 * book, looks up and waves, and stays so), inside her circle with her head a little above it. A still
 * picture where clear video is not drawn (iPhone) or less motion is asked for.
 */
function HeroPortrait() {
  const [live, setLive] = useState(false)
  useEffect(() => setLive(alphaVideo()), [])
  return (
    <span className="ai-orb ai-orb-lg ai-orb-live" aria-hidden="true">
      <span className="ai-orb-glow" /><span className="ai-orb-ring" /><span className="ai-orb-disc" />
      <span className="ai-orb-fig">
        {live
          ? <video src={CLIPS.signin.video} poster={CLIPS.signin.still} muted autoPlay playsInline preload="auto" disableRemotePlayback />
          : <img src={CLIPS.signin.still} alt="" />}
      </span>
    </span>
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
/**
 * The pictures and documents sent with a question; a document opens inside the app (a PDF page by page, a
 * text as it is), with "open in an app" for another app of the phone.
 */
function Attached({ files }: { files: AiFileView[] }) {
  const { t } = usePrefs()
  const [doc, setDoc] = useState<DocSource | null>(null)
  const open = async (f: AiFileView) => {
    const blob = f.key ? await keptFile(f.key) : null
    if (!blob) return showToast(t('doc.not_kept'), 'info')
    setDoc({ name: f.name, file: async () => blob, kind: f.mime === 'application/pdf' ? 'pdf' : 'text' })
  }
  return (
    <div className="ai-attached">
      {files.map((f, i) => (f.thumb ? <img key={i} src={f.thumb} alt={f.name} /> : (
        <button key={i} type="button" className="ai-file-doc" onClick={() => void open(f)}><Icon name="file" size={16} /><span>{f.name}</span></button>
      )))}
      {doc ? <DocViewer doc={doc} onClose={() => setDoc(null)} /> : null}
    </div>
  )
}

/**
 * Her greeting's letters, rising one after another and settling, again and again (each word kept whole on
 * its line; an emoji moves as one letter).
 */
function Wave({ text }: { text: string }) {
  const words = text.split(/(\s+)/)
  const n = [...text.replace(/\s+/g, '')].length
  let at = 0
  return (
    <span className="ai-wave" style={{ ['--n' as string]: n }} aria-label={text}>
      {words.map((w, wi) => (/^\s+$/.test(w) ? w : (
        <span key={wi} className="ai-wave-word" aria-hidden="true">
          {(w.match(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*|./gsu) ?? []).map((ch, ci) => (
            <span key={ci} className="ai-wave-ch" style={{ ['--i' as string]: at++ }}>{emojify(ch)}</span>
          ))}
        </span>
      )))}
    </span>
  )
}


/** Her greetings fit the hour: the night (22–5), the morning (5–11), the evening (17–22), or any time. */
export const taglinesKey = (h: number) =>
  h >= 22 || h < 5 ? 'ai.taglines_night' as const : h < 11 ? 'ai.taglines_morning' as const : h >= 17 ? 'ai.taglines_evening' as const : 'ai.taglines' as const

/** Her greeting over the conversation's start: one of many, a different one each time her chat opens; it stays until she writes. */
function Taglines({ lines }: { lines: string[] }) {
  // one greeting of many, chosen anew each time her chat opens (after the first paint: no mismatch)
  const [i, setI] = useState<number | null>(null)
  useEffect(() => { setI(Math.floor(Math.random() * lines.length)) }, [lines.length])
  return (
    <h2 className="ai-greet" aria-live="polite">
      {i === null ? '\u00a0' : <span key={i} className="ai-greet-line"><Wave text={lines[i]} /></span>}
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
                {c.icon ? <span className="ai-chip-icon" aria-hidden="true">{emojify(c.icon)}</span> : null}<span>{emojify(c.text)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
