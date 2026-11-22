'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import type { AiBlock } from '@/lib/aiCatalog'
import SPOTS from '@/lib/aiSpots.json'

import { allowLockScreen, lockScreenAllowed } from '../offline/call'
import { cancelReminder, reminderId, setReminder } from '../offline/mahliyo'
import { usePrefs } from '../prefs'
import { AiMarkdown, isMarkdown } from './AiMarkdown'
import { emojify } from './Emoji'
import { Icon } from './Icon'

/**
 * Mahliyo's answer, drawn block by block (each rises in turn): a paragraph, numbered steps, a screenshot
 * of the app with a pulsing pointer on the place to tap (tap it to see it large), a button to a page, and
 * a reminder she set (it rings on the phone at that time; it can be taken back). A fresh answer is drawn
 * as she would say it: word after word, each block after the one before.
 */

/** how long each word takes to come in, and a block without words */
const WORD_MS = 34
const BLOCK_MS = 380
const words = (text: string) => text.split(/(\s+)/)
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length
/** when each block starts (ms from the answer's start), and when the last has come in */
export function timingOf(blocks: AiBlock[]) {
  let t = 0
  const starts = blocks.map((b) => {
    const at = t
    t += b.type === 'text' ? wordCount(b.text) * WORD_MS + 160
      : b.type === 'steps' ? (wordCount(b.title) + b.items.reduce((n, s) => n + wordCount(s), 0)) * WORD_MS + b.items.length * 90 + 160
      : BLOCK_MS
    return at
  })
  return { starts, total: t }
}

/** Text whose words come in one by one, from `from` ms after its block starts. */
function Words({ text, from = 0 }: { text: string; from?: number }) {
  let n = 0
  return (
    <>
      {words(text).map((w, i) => (/^\s+$/.test(w) || !w ? w : (
        <span key={i} className="ai-w" style={{ ['--w' as string]: `${from + n++ * WORD_MS}ms` }}>{emojify(w)}</span>
      )))}
    </>
  )
}

/** where each place is on its screenshot, in % of the picture (made by tools/ai-screens) */
const RECTS = SPOTS as Record<string, { x: number; y: number; w: number; h: number }>

type Reminder = Extract<AiBlock, { type: 'reminder' }>
type Status = 'set' | 'denied' | 'web' | 'past' | 'cancelled'
const REM_KEY = 'dk.ai-rem'
const readRem = (): Record<string, Status> => {
  try { return JSON.parse(localStorage.getItem(REM_KEY) || '{}') as Record<string, Status> } catch { return {} }
}
const writeRem = (id: number, s: Status) => {
  try { localStorage.setItem(REM_KEY, JSON.stringify({ ...readRem(), [id]: s })) } catch { /* not kept */ }
}

/** what was chosen in a test, kept on this phone (the test still shows its marks when the chat is opened again) */
const QUIZ_KEY = 'dk.ai.quiz'
type QuizSaved = Record<string, { picked: (number | null)[]; checked: boolean }>
const readQuiz = (): QuizSaved => {
  try { return JSON.parse(localStorage.getItem(QUIZ_KEY) || '{}') as QuizSaved } catch { return {} }
}
const keepQuiz = (id: string, v: QuizSaved[string]) => {
  try {
    // only the last fifty tests are kept
    const all = Object.entries({ ...readQuiz(), [id]: v }).slice(-50)
    localStorage.setItem(QUIZ_KEY, JSON.stringify(Object.fromEntries(all)))
  } catch { /* not kept */ }
}
/** a question's or an answer's words: Markdown and formulas when they have them */
const Rich = ({ text }: { text: string }) => (isMarkdown(text) ? <AiMarkdown text={text} inline /> : <>{emojify(text)}</>)

/**
 * A test in the chat: up to ten questions, an answer chosen for each; "Санҷидан" marks them right or wrong
 * at once, with each one's explanation and the score — and sends her result to Mahliyo, who answers it.
 */
function QuizCard({ block, id, onQuiz, style }: { block: Extract<AiBlock, { type: 'quiz' }>; id?: string; onQuiz?: (result: string) => void; style: CSSProperties }) {
  const { t } = usePrefs()
  const total = block.questions.length
  const [picked, setPicked] = useState<(number | null)[]>(() => (id && readQuiz()[id]?.picked) || block.questions.map(() => null))
  const [checked, setChecked] = useState(() => !!(id && readQuiz()[id]?.checked))
  const answered = picked.filter((p) => p !== null).length
  const score = block.questions.filter((q, n) => picked[n] === q.answer).length
  const pick = (n: number, o: number) => {
    if (checked) return
    const next = picked.map((p, k) => (k === n ? o : p))
    setPicked(next)
    if (id) keepQuiz(id, { picked: next, checked: false })
  }
  const check = () => {
    if (answered < total) return
    setChecked(true)
    if (id) keepQuiz(id, { picked, checked: true })
    // her result, for Mahliyo to answer: the score and each mistake
    const wrong = block.questions.map((q, n) => ({ q, n })).filter(({ q, n }) => picked[n] !== q.answer)
    onQuiz?.([
      t('ai.quiz_result').replace('{n}', String(score)).replace('{total}', String(total)) + (block.title ? ` («${block.title}»)` : ''),
      ...wrong.map(({ q, n }) => `${n + 1}. ${q.question} — ${t('ai.quiz_mine')}: «${q.options[picked[n] ?? 0]}», ${t('ai.quiz_right')}: «${q.options[q.answer]}»`)
    ].join('\n'))
  }
  return (
    <section className={`ai-quiz${checked ? ' is-checked' : ''}`} style={style} aria-label={block.title || t('ai.quiz')}>
      <header className="ai-quiz-head">
        <span className="ai-quiz-icon" aria-hidden="true"><Icon name="check" size={16} strokeWidth={2.4} /></span>
        <b className="grow">{block.title ? emojify(block.title) : t('ai.quiz')}</b>
        <span className="ai-quiz-count">{checked ? `${score}/${total}` : t('ai.quiz_count').replace('{n}', String(total))}</span>
      </header>
      {block.intro ? <p className="ai-quiz-intro"><Rich text={block.intro} /></p> : null}
      <ol className="ai-quiz-list">
        {block.questions.map((q, n) => (
          <li key={n} className="ai-quiz-item">
            <p className="ai-quiz-q"><span className="ai-quiz-n">{n + 1}</span><span><Rich text={q.question} /></span></p>
            <div className="ai-quiz-opts" role="radiogroup" aria-label={q.question}>
              {q.options.map((o, k) => {
                const mine = picked[n] === k
                const mark = checked ? (k === q.answer ? ' is-right' : mine ? ' is-wrong' : '') : mine ? ' is-picked' : ''
                return (
                  <button key={k} type="button" role="radio" aria-checked={mine} className={`ai-quiz-opt${mark}`} disabled={checked} onClick={() => pick(n, k)}>
                    <i aria-hidden="true">{String.fromCharCode(65 + k)}</i><span><Rich text={o} /></span>
                    {checked && k === q.answer ? <Icon name="check" size={16} strokeWidth={2.6} /> : checked && mine ? <Icon name="x" size={16} strokeWidth={2.6} /> : null}
                  </button>
                )
              })}
            </div>
            {checked && q.explanation ? <p className="ai-quiz-why"><Rich text={q.explanation} /></p> : null}
          </li>
        ))}
      </ol>
      <footer className="ai-quiz-foot">
        {checked ? (
          <p className="ai-quiz-score" role="status"><b>{t('ai.quiz_score').replace('{n}', String(score)).replace('{total}', String(total))}</b>
            <span className="ai-quiz-bar" aria-hidden="true"><i style={{ width: `${Math.round((score / total) * 100)}%` }} /></span></p>
        ) : (
          <>
            <span className="ai-quiz-progress">{answered}/{total}</span>
            <button type="button" className="btn ai-quiz-check" disabled={answered < total} onClick={check}>{t('ai.quiz_check')}</button>
          </>
        )}
      </footer>
    </section>
  )
}

type Picture = Extract<AiBlock, { type: 'images' }>['items'][number]

/**
 * Pictures of what she was asked about: while one comes, three dots turn on a soft shimmer; one that cannot
 * come is left out (none at all: nothing is shown); a tap opens it large, here in the app.
 */
function Pictures({ items, style }: { items: Picture[]; style: CSSProperties }) {
  const [failed, setFailed] = useState<Set<number>>(new Set())
  const [open, setOpen] = useState<Picture | null>(null)
  const shown = items.map((p, n) => ({ p, n })).filter(({ n }) => !failed.has(n))
  if (!shown.length) return null
  return (
    <div className={`ai-images${shown.length === 1 ? ' is-one' : ''}`} style={style}>
      {shown.map(({ p, n }) => (
        <PictureTile key={n} picture={p} onOpen={() => setOpen(p)} onFail={() => setFailed((f) => new Set(f).add(n))} />
      ))}
      {open ? createPortal(
        <div className="ai-zoom ai-photo" role="dialog" aria-modal="true" aria-label={open.title} onClick={() => setOpen(null)}>
          <img src={open.src} alt={open.title} referrerPolicy="no-referrer" />
          {open.title ? <p>{open.title}</p> : null}
          <button type="button" className="icon-btn ai-zoom-x" aria-label="×" onClick={() => setOpen(null)}><Icon name="x" /></button>
        </div>,
        document.body
      ) : null}
    </div>
  )
}

function PictureTile({ picture, onOpen, onFail }: { picture: Picture; onOpen: () => void; onFail: () => void }) {
  const [ready, setReady] = useState(false)
  const tried = useRef(false)
  return (
    <button type="button" className={`ai-image${ready ? ' is-ready' : ''}`} onClick={onOpen} disabled={!ready}>
      <span className="ai-image-frame">
        {/* not "lazy": inside the chat's own scrolling, the phone's browser may never start it */}
        <img src={picture.src} alt={picture.title} referrerPolicy="no-referrer" decoding="async"
          onLoad={() => setReady(true)}
          onError={(e) => {
            // once more (a weak connection), then it is left out
            if (tried.current) return onFail()
            tried.current = true
            const img = e.currentTarget
            setTimeout(() => { img.src = `${picture.src}${picture.src.includes('?') ? '&' : '?'}r=1` }, 1500)
          }} />
        {ready ? null : <span className="ai-image-wait" aria-hidden="true"><i /><i /><i /></span>}
      </span>
      {picture.title ? <span>{picture.title}</span> : null}
    </button>
  )
}

export function AnswerBlocks({ blocks, fresh, id, onQuiz }: { blocks: AiBlock[]; fresh: boolean; id?: string; onQuiz?: (result: string) => void }) {
  const { t } = usePrefs()
  const [zoom, setZoom] = useState<Extract<AiBlock, { type: 'screen' }> | null>(null)
  const { starts } = timingOf(blocks)
  return (
    <div className={`ai-blocks${fresh ? ' is-fresh' : ''}`}>
      {blocks.map((b, i) => {
        const style = { ['--i' as string]: i, ['--at' as string]: `${starts[i]}ms` }
        switch (b.type) {
          case 'text':
            // a worked solution, a formula, a table or code: drawn as Markdown
            return isMarkdown(b.text)
              ? <div key={i} className="ai-card ai-text ai-md" style={style}><AiMarkdown text={b.text} fresh={fresh} step={WORD_MS} /></div>
              : <p key={i} className="ai-card ai-text" style={style}>{fresh ? <Words text={b.text} /> : emojify(b.text)}</p>
          case 'steps': {
            let from = wordCount(b.title) * WORD_MS
            return (
              <div key={i} className="ai-card ai-steps" style={style}>
                {b.title ? <b>{fresh ? <Words text={b.title} /> : emojify(b.title)}</b> : null}
                <ol>{b.items.map((s, n) => {
                  const at = from + n * 90
                  from += wordCount(s) * WORD_MS
                  return (
                    <li key={n} style={{ ['--w' as string]: `${at}ms` }}>
                      <span className="ai-step-n">{n + 1}</span><span>{isMarkdown(s) ? <AiMarkdown text={s} fresh={fresh} from={at} step={WORD_MS} inline /> : fresh ? <Words text={s} from={at} /> : emojify(s)}</span>
                    </li>
                  )
                })}</ol>
              </div>
            )
          }
          case 'screen':
            return (
              <figure key={i} className="ai-screen" style={style}>
                <button type="button" onClick={() => setZoom(b)} aria-label={b.caption}><Shot spot={b.spot} /></button>
                {b.caption ? <figcaption>{emojify(b.caption)}</figcaption> : null}
              </figure>
            )
          case 'link':
            return b.to.startsWith('/') ? (
              <Link key={i} href={b.to} className="ai-link" style={style}><span>{emojify(b.label)}</span><Icon name="arrow" size={18} /></Link>
            ) : (
              <a key={i} href={b.to} target="_blank" rel="noopener noreferrer" className="ai-link" style={style}><span>{emojify(b.label)}</span><Icon name="arrow" size={18} /></a>
            )
          case 'reminder':
            return <ReminderCard key={i} block={b} fresh={fresh} style={style} />
          case 'images':
            return <Pictures key={i} items={b.items} style={style} />
          case 'quiz':
            return <QuizCard key={i} block={b} id={id ? `${id}:${i}` : undefined} onQuiz={onQuiz} style={style} />
          case 'premium':
            return null
          case 'warning':
            // insults or pressure: only this, in red
            return <p key={i} className="ai-card ai-warning" role="alert" style={style}>{t('ai.warning')}</p>
          case 'sources':
            // shown small at the end of her answer's row (Sources)
            return null
        }
      })}
      {/* large, over everything (the tab bar too) */}
      {zoom ? createPortal(
        <div className="ai-zoom" role="dialog" aria-modal="true" aria-label={zoom.caption} onClick={() => setZoom(null)}>
          <Shot spot={zoom.spot} />
          {zoom.caption ? <p>{zoom.caption}</p> : null}
          <button type="button" className="icon-btn ai-zoom-x" aria-label="×" onClick={() => setZoom(null)}><Icon name="x" /></button>
        </div>,
        document.body
      ) : null}
    </div>
  )
}

/** the sites, by their first letter (W for Wikipedia), each a little circle */
const siteMark = (site: string) => (/wikipedia/.test(site) ? 'W' : site === 'Китоби расмӣ' ? '📖' : site.replace(/^www\./, '')[0]?.toUpperCase() ?? '•')

/**
 * Where her answer came from, small at the end of its row (as a messenger shows it): the sites' marks, one
 * over another, and "Манбаъҳо"; tapped, the list — each source's name in blue, and its site.
 */
export function Sources({ items }: { items: Extract<AiBlock, { type: 'sources' }>['items'] }) {
  const { t } = usePrefs()
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  return (
    <>
      <button type="button" className="ai-sources" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="ai-sources-marks" aria-hidden="true">{items.slice(0, 3).map((s, n) => <i key={n}>{emojify(siteMark(s.site))}</i>)}</span>
        <span>{t('ai.sources')}</span>
      </button>
      {open ? createPortal(
        <div className="ai-sheet-back" role="presentation" onClick={() => setOpen(false)}>
          <div className="ai-sheet ai-sources-sheet" role="dialog" aria-modal="true" aria-label={t('ai.sources')} onClick={(e) => e.stopPropagation()}>
            <div className="ai-sheet-head"><b>{t('ai.sources')}</b><span className="grow" />
              <button type="button" className="ai-act" onClick={() => setOpen(false)} aria-label={t('action.close')}><Icon name="x" size={16} /></button>
            </div>
            <ol>
              {items.map((s, n) => (
                <li key={n}>
                  <i aria-hidden="true">{emojify(siteMark(s.site))}</i>
                  {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : <b>{s.title}</b>}
                  <span>{s.site}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>,
        document.body
      ) : null}
    </>
  )
}

/** A screenshot in a phone's frame, the place marked and a pointer pulsing on it. */
function Shot({ spot }: { spot: string }) {
  const r = RECTS[spot]
  return (
    <span className="ai-phone">
      <img src={`/assets/ai-screens/${spot}.webp`} alt="" loading="lazy" />
      {r ? (
        <>
          <span className="ai-mark" style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }} />
          <span className="ai-pointer" style={{ left: `${r.x + r.w / 2}%`, top: `${r.y + r.h / 2}%` }}><i /><i /></span>
        </>
      ) : null}
    </span>
  )
}

/** "Today, 20:00" / "Tomorrow, 07:30" / "25.11, 18:00" on the phone's clock. */
function when(at: string, t: (k: 'ai.today' | 'ai.tomorrow') => string) {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const name = day === today ? t('ai.today') : day === today + 86_400_000 ? t('ai.tomorrow') : `${p(d.getDate())}.${p(d.getMonth() + 1)}`
  return `${name}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** A reminder she set: set on the phone when her answer comes (once), shown with its time; can be taken back. */
function ReminderCard({ block, fresh, style }: { block: Reminder; fresh: boolean; style: React.CSSProperties }) {
  const { t } = usePrefs()
  const id = reminderId(block.at)
  const [status, setStatus] = useState<Status | null>(null)
  const put = async () => {
    const s = await setReminder(block).catch(() => 'denied' as const)
    writeRem(id, s)
    setStatus(s)
  }
  useEffect(() => {
    const known = readRem()[id]
    if (known) return setStatus(known)
    if (fresh) void put()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, fresh])
  const cancel = async () => {
    await cancelReminder(block.at)
    writeRem(id, 'cancelled')
    setStatus('cancelled')
  }
  const past = new Date(block.at).getTime() <= Date.now()
  // her call covers the lock screen only with the phone's permission (Android 14+): asked here, and
  // looked at again when the learner comes back from the phone's settings
  const [lock, setLock] = useState(true)
  const waiting = status === 'set' && !past
  useEffect(() => {
    if (!waiting) return
    const look = () => void lockScreenAllowed().then(setLock)
    look()
    document.addEventListener('visibilitychange', look)
    return () => document.removeEventListener('visibilitychange', look)
  }, [waiting])
  return (
    <div className={`ai-card ai-reminder${status === 'set' && !past ? ' is-set' : ''}`} style={style}>
      <span className="ai-reminder-icon"><Icon name="phone" size={20} /></span>
      <div className="grow">
        <b>{emojify(block.title)}</b>
        <span className="ai-reminder-time">{when(block.at, t)}</span>
      </div>
      {status === 'set' && !past ? (
        <button type="button" className="btn btn-soft ai-reminder-btn" onClick={cancel}>{t('ai.reminder_cancel')}</button>
      ) : (status === 'cancelled' || status === 'denied' || (!fresh && !status)) && !past ? (
        <button type="button" className="btn btn-soft ai-reminder-btn" onClick={put}>{t('ai.reminder_put')}</button>
      ) : null}
      {/* only what she must know: it did not work, it was taken back, or it is over */}
      {status && status !== 'set' ? (
        <span className="ai-reminder-state" role="status">
          {status === 'cancelled' ? t('ai.reminder_cancelled') : status === 'denied' ? t('ai.reminder_denied') : status === 'web' ? t('ai.reminder_web') : null}
        </span>
      ) : status === 'set' && past ? <span className="ai-reminder-state" role="status">{t('ai.reminder_done')}</span> : null}
      {waiting && !lock ? (
        <span className="ai-reminder-lock">
          <span>{t('ai.call_lock')}</span>
          <button type="button" className="btn btn-soft ai-reminder-btn" onClick={allowLockScreen}>{t('ai.call_lock_allow')}</button>
        </span>
      ) : null}
    </div>
  )
}
