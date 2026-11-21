'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type { AiBlock } from '@/lib/aiCatalog'
import SPOTS from '@/lib/aiSpots.json'

import { allowLockScreen, lockScreenAllowed } from '../offline/call'
import { cancelReminder, reminderId, setReminder } from '../offline/mahliyo'
import { usePrefs } from '../prefs'
import { AiMarkdown, isMarkdown } from './AiMarkdown'
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
        <span key={i} className="ai-w" style={{ ['--w' as string]: `${from + n++ * WORD_MS}ms` }}>{w}</span>
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

export function AnswerBlocks({ blocks, fresh }: { blocks: AiBlock[]; fresh: boolean }) {
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
              : <p key={i} className="ai-card ai-text" style={style}>{fresh ? <Words text={b.text} /> : b.text}</p>
          case 'steps': {
            let from = wordCount(b.title) * WORD_MS
            return (
              <div key={i} className="ai-card ai-steps" style={style}>
                {b.title ? <b>{fresh ? <Words text={b.title} /> : b.title}</b> : null}
                <ol>{b.items.map((s, n) => {
                  const at = from + n * 90
                  from += wordCount(s) * WORD_MS
                  return (
                    <li key={n} style={{ ['--w' as string]: `${at}ms` }}>
                      <span className="ai-step-n">{n + 1}</span><span>{isMarkdown(s) ? <AiMarkdown text={s} fresh={fresh} from={at} step={WORD_MS} inline /> : fresh ? <Words text={s} from={at} /> : s}</span>
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
                {b.caption ? <figcaption>{b.caption}</figcaption> : null}
              </figure>
            )
          case 'link':
            return b.to.startsWith('/') ? (
              <Link key={i} href={b.to} className="ai-link" style={style}><span>{b.label}</span><Icon name="arrow" size={18} /></Link>
            ) : (
              <a key={i} href={b.to} target="_blank" rel="noopener noreferrer" className="ai-link" style={style}><span>{b.label}</span><Icon name="arrow" size={18} /></a>
            )
          case 'reminder':
            return <ReminderCard key={i} block={b} fresh={fresh} style={style} />
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
      <span className="ai-reminder-icon"><Icon name="phone" size={22} /></span>
      <div className="grow">
        <b>{block.title}</b>
        <span className="ai-reminder-time">{when(block.at, t)}</span>
        {block.text ? <span className="muted">{block.text}</span> : null}
        <span className="ai-reminder-state" role="status">
          {status === 'set' ? (past ? t('ai.reminder_done') : t('ai.reminder_set'))
            : status === 'cancelled' ? t('ai.reminder_cancelled')
            : status === 'denied' ? t('ai.reminder_denied')
            : status === 'web' ? t('ai.reminder_web') : null}
        </span>
        {waiting && !lock ? (
          <span className="ai-reminder-lock">
            <span>{t('ai.call_lock')}</span>
            <button type="button" className="btn btn-soft ai-reminder-btn" onClick={allowLockScreen}>{t('ai.call_lock_allow')}</button>
          </span>
        ) : null}
      </div>
      {status === 'set' && !past ? (
        <button type="button" className="btn btn-soft ai-reminder-btn" onClick={cancel}>{t('ai.reminder_cancel')}</button>
      ) : (status === 'cancelled' || status === 'denied' || (!fresh && !status)) && !past ? (
        <button type="button" className="btn btn-soft ai-reminder-btn" onClick={put}>{t('ai.reminder_put')}</button>
      ) : null}
    </div>
  )
}
