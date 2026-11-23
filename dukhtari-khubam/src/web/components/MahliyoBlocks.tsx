'use client'

import { evaluate, formatNumber } from '@/lib/calc'
import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import type { AiBlock } from '@/lib/aiCatalog'
import { withCommand } from '@/lib/aiCommands'
import { extOf, fileType } from '@/lib/aiFiles'
import { lookStyle, slideStyle } from '@/lib/slideStyles'
import SPOTS from '@/lib/aiSpots.json'

import { allowLockScreen, lockScreenAllowed } from '../offline/call'
import { cancelReminder, makeSong, reminderId, setReminder, type AiUpload, type MadeSong, type SongProblem } from '../offline/mahliyo'
import { usePlan } from '../plans'
import { usePrefs } from '../prefs'
import { AiMarkdown, isMarkdown } from './AiMarkdown'
import { DocViewer, OpenChoice } from './DocViewer'
import { emojify } from './Emoji'
import { Icon } from './Icon'
import { showToast } from './Toast'

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
  // a test about her (character, taste): no right answers, no score — her picks and words go to Mahliyo
  const personal = block.questions.every((q) => q.answer < 0)
  const [comment, setComment] = useState('')
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
    // her own words; with an open task, the task and her answer to it
    const words = !comment.trim() ? '' : block.task ? `${t('ai.quiz_task')}: ${block.task}\n${t('ai.quiz_task_answer')}: ${comment.trim()}` : `${t('ai.quiz_comment_mine')}: ${comment.trim()}`
    if (personal) {
      // her picks, one per question, and her own words
      onQuiz?.([
        t('ai.quiz_picks') + (block.title ? ` («${block.title}»)` : ''),
        ...block.questions.map((q, n) => `${n + 1}. ${q.question} — «${q.options[picked[n] ?? 0]}»`),
        words
      ].filter(Boolean).join('\n'))
      return
    }
    // her result, for Mahliyo to answer: the score and each mistake
    const wrong = block.questions.map((q, n) => ({ q, n })).filter(({ q, n }) => picked[n] !== q.answer)
    onQuiz?.([
      t('ai.quiz_result').replace('{n}', String(score)).replace('{total}', String(total)) + (block.title ? ` («${block.title}»)` : ''),
      ...wrong.map(({ q, n }) => `${n + 1}. ${q.question} — ${t('ai.quiz_mine')}: «${q.options[picked[n] ?? 0]}», ${t('ai.quiz_right')}: «${q.options[q.answer]}»`),
      words
    ].filter(Boolean).join('\n'))
  }
  return (
    <section className={`ai-quiz${checked ? ' is-checked' : ''}`} style={style} aria-label={block.title || t('ai.quiz')}>
      <header className="ai-quiz-head">
        <span className="ai-quiz-icon" aria-hidden="true"><Icon name="check" size={16} strokeWidth={2.4} /></span>
        <b className="grow">{block.title ? emojify(block.title) : t('ai.quiz')}</b>
        <span className="ai-quiz-count">{checked && !personal ? `${score}/${total}` : t('ai.quiz_count').replace('{n}', String(total))}</span>
      </header>
      {block.intro ? <p className="ai-quiz-intro"><Rich text={block.intro} /></p> : null}
      <ol className="ai-quiz-list">
        {block.questions.map((q, n) => (
          <li key={n} className="ai-quiz-item">
            <p className="ai-quiz-q"><span className="ai-quiz-n">{n + 1}</span><span><Rich text={q.question} /></span></p>
            <div className="ai-quiz-opts" role="radiogroup" aria-label={q.question}>
              {q.options.map((o, k) => {
                const mine = picked[n] === k
                const mark = checked && !personal ? (k === q.answer ? ' is-right' : mine ? ' is-wrong' : '') : mine ? ' is-picked' : ''
                return (
                  <button key={k} type="button" role="radio" aria-checked={mine} className={`ai-quiz-opt${mark}`} disabled={checked} onClick={() => pick(n, k)}>
                    <i aria-hidden="true">{String.fromCharCode(65 + k)}</i><span><Rich text={o} /></span>
                    {personal ? (mine ? <Icon name="check" size={16} strokeWidth={2.6} /> : null)
                      : checked && k === q.answer ? <Icon name="check" size={16} strokeWidth={2.6} /> : checked && mine ? <Icon name="x" size={16} strokeWidth={2.6} /> : null}
                  </button>
                )
              })}
            </div>
            {checked && q.explanation ? <p className="ai-quiz-why"><Rich text={q.explanation} /></p> : null}
          </li>
        ))}
      </ol>
      {block.comment && block.task ? <p className="ai-quiz-task"><Icon name="edit" size={15} aria-hidden="true" /><span><Rich text={block.task} /></span></p> : null}
      {block.comment ? (
        <label className="ai-quiz-comment">
          <Icon name="edit" size={16} aria-hidden="true" />
          <textarea rows={1} value={comment} disabled={checked} placeholder={block.comment} aria-label={block.comment} maxLength={1000}
            onChange={(e) => { setComment(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px` }} />
        </label>
      ) : null}
      <footer className="ai-quiz-foot">
        {checked && personal ? (
          <p className="ai-quiz-score" role="status"><b>{t('ai.quiz_sent')}</b></p>
        ) : checked ? (
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

const TONE_LABEL_ICON = { best: 'star', good: 'check', risk: 'alert', neutral: null } as const

/** Options side by side: name, a badge (her first pick in green, a risk in red), a few points, a note. */
function ChoicesCard({ block, style }: { block: Extract<AiBlock, { type: 'choices' }>; style: CSSProperties }) {
  return (
    <section className="ai-choices" style={style} aria-label={block.title}>
      {block.title ? <h3 className="ai-choices-title">{emojify(block.title)}</h3> : null}
      {block.intro ? <p className="ai-choices-intro"><Rich text={block.intro} /></p> : null}
      <ol className="ai-choices-list">
        {block.items.map((it, n) => {
          const icon = TONE_LABEL_ICON[it.tone]
          return (
            <li key={n} className={`ai-choice tone-${it.tone}`}>
              <div className="ai-choice-head">
                <span className="ai-choice-n" aria-hidden="true">{n + 1}</span>
                <b className="grow">{emojify(it.name)}</b>
              </div>
              {it.badge ? <span className="ai-choice-badge">{icon ? <Icon name={icon} size={13} strokeWidth={2.4} /> : null}{emojify(it.badge)}</span> : null}
              {it.points.length ? <ul>{it.points.map((p, k) => <li key={k}><Rich text={p} /></li>)}</ul> : null}
              {it.note ? <p className="ai-choice-note"><Rich text={it.note} /></p> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const CALLOUT_ICON = { danger: 'alert', warning: 'alert', tip: 'sparkle', info: 'info' } as const
/** A framed note: a real danger in red, a warning in amber, a tip in green, a plain note. */
function CalloutCard({ block, style }: { block: Extract<AiBlock, { type: 'callout' }>; style: CSSProperties }) {
  return (
    <aside className={`ai-callout tone-${block.tone}`} style={style} role={block.tone === 'danger' ? 'alert' : 'note'}>
      <span className="ai-callout-icon" aria-hidden="true"><Icon name={CALLOUT_ICON[block.tone]} size={18} strokeWidth={2.2} /></span>
      <div className="grow">
        {block.title ? <b>{emojify(block.title)}</b> : null}
        {isMarkdown(block.text) ? <AiMarkdown text={block.text} /> : <p>{emojify(block.text)}</p>}
      </div>
    </aside>
  )
}

/** A live calculator: each value changes with − / + or a choice, and the results follow at once. */
function CalcCard({ block, style }: { block: Extract<AiBlock, { type: 'calc' }>; style: CSSProperties }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(block.inputs.map((i) => [i.id, i.value])))
  const set = (id: string, v: number) => setValues((all) => ({ ...all, [id]: v }))
  const fmt = (v: number, unit: string) => `${formatNumber(v)}${unit ? ` ${unit}` : ''}`
  const results = block.outputs.map((o) => ({ o, v: evaluate(o.formula, values) }))
  const main = results.find((r) => r.o.big) ?? null
  return (
    <section className="ai-calc" style={style} aria-label={block.title}>
      {block.title ? <h3 className="ai-calc-title">{emojify(block.title)}</h3> : null}
      <div className="ai-calc-inputs">
        {block.inputs.map((i) => {
          const v = values[i.id]
          const round = (x: number) => Number(x.toFixed(6))
          return (
            <div key={i.id} className="ai-calc-input">
              <span className="ai-calc-label">{emojify(i.label)}</span>
              {i.options.length ? (
                <div className="ai-calc-options" role="radiogroup" aria-label={i.label}>
                  {i.options.map((o) => (
                    <button key={o} type="button" role="radio" aria-checked={v === o} className={v === o ? 'is-on' : ''} onClick={() => set(i.id, o)}>{formatNumber(o)}</button>
                  ))}
                </div>
              ) : (
                <div className="ai-calc-stepper">
                  <button type="button" aria-label={`${i.label} −`} disabled={v <= i.min} onClick={() => set(i.id, round(Math.max(i.min, v - i.step)))}><Icon name="minus" size={16} strokeWidth={2.4} /></button>
                  <output aria-live="polite">{fmt(v, i.unit)}</output>
                  <button type="button" aria-label={`${i.label} +`} disabled={v >= i.max} onClick={() => set(i.id, round(Math.min(i.max, v + i.step)))}><Icon name="plus" size={16} strokeWidth={2.4} /></button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="ai-calc-results">
        {main && main.v !== null ? (
          <div className={`ai-calc-main tone-${main.o.tone}`}><span>{emojify(main.o.label)}</span><b>{fmt(main.v, main.o.unit)}</b></div>
        ) : null}
        {results.filter((r) => r !== main && r.v !== null).map(({ o, v }, n) => (
          <div key={n} className={`ai-calc-row tone-${o.tone}`}><span>{emojify(o.label)}</span><b>{fmt(v!, o.unit)}</b></div>
        ))}
      </div>
      {block.note ? <p className="ai-calc-note">{emojify(block.note)}</p> : null}
    </section>
  )
}

/** She did not understand: her question, choices to tap, and a line to write one's own. */
function ClarifyCard({ block, onAsk, style }: { block: Extract<AiBlock, { type: 'clarify' }>; onAsk?: (text: string) => void; style: CSSProperties }) {
  const { t } = usePrefs()
  const [own, setOwn] = useState('')
  const [done, setDone] = useState(false)
  const ask = (text: string) => {
    if (done || !text.trim() || !onAsk) return
    setDone(true)
    onAsk(text.trim())
  }
  return (
    <section className={`ai-clarify${done ? ' is-done' : ''}`} style={style} aria-label={block.question}>
      <p className="ai-clarify-q"><Icon name="help" size={18} aria-hidden="true" /><span>{emojify(block.question)}</span></p>
      <div className="ai-clarify-opts">
        {block.options.map((o, k) => (
          <button key={k} type="button" className="ai-quiz-opt" disabled={done} onClick={() => ask(o)}>
            <i aria-hidden="true">{String.fromCharCode(65 + k)}</i><span>{emojify(o)}</span>
          </button>
        ))}
        <form className="ai-clarify-own" onSubmit={(e) => { e.preventDefault(); ask(own) }}>
          <Icon name="edit" size={16} aria-hidden="true" />
          <input value={own} disabled={done} maxLength={500} placeholder={t('ai.clarify_own')} aria-label={t('ai.clarify_own')} onChange={(e) => setOwn(e.target.value)} />
          {own.trim() ? <button type="submit" aria-label={t('ai.send')}><Icon name="arrow" size={16} /></button> : null}
        </form>
      </div>
    </section>
  )
}

/** Questions to go on with, under her answer: a tap asks one. */
/** the label on a file's icon */
const FILE_BADGE: Record<string, string> = { pdf: 'PDF', docx: 'W', pptx: 'P' }

/**
 * A file she made: a bright icon (PDF red, Word blue, PowerPoint orange, code violet), its name and what it
 * is for; "Боргирӣ" builds the file on the phone and saves or shares it; "Дидан" opens a document (PDF,
 * Word, PowerPoint) in an app the phone asks for, and shows text and code right here.
 */
const time = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/**
 * A song she made (music maker): its record turning while it plays, the name and genre, her own player
 * (play, a bar to move through it, the time), "save" to keep the MP3, and the words, folded. The music is
 * made at once by Lyria (kept on the phone afterwards); while it is made, three lines with a light sweeping
 * over them say what is happening.
 */
function MusicCard({ block, style }: { block: Extract<AiBlock, { type: 'music' }>; style: CSSProperties }) {
  const { t } = usePrefs()
  const [song, setSong] = useState<MadeSong | SongProblem | null>(null)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [at, setAt] = useState(0)
  const [length, setLength] = useState(0)
  const [open, setOpen] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const make = () => {
    setSong(null)
    void makeSong(block).then(setSong)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(make, [block.title, block.prompt, block.lyrics])
  useEffect(() => {
    if (song !== null) return
    const timer = setInterval(() => setStep((n) => (n + 1) % 3), 5000)
    return () => clearInterval(timer)
  }, [song])
  const made = song && typeof song === 'object' ? song : null
  useEffect(() => {
    if (!made) return
    const bytes = Uint8Array.from(atob(made.audio), (c) => c.charCodeAt(0))
    const u = URL.createObjectURL(new Blob([bytes], { type: made.mime || 'audio/mpeg' }))
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [made])
  const toggle = () => {
    const a = audio.current
    if (!a) return
    if (a.paused) void a.play().catch(() => undefined)
    else a.pause()
  }
  const save = async () => {
    if (!made) return
    const bytes = Uint8Array.from(atob(made.audio), (c) => c.charCodeAt(0))
    const { saveFile } = await import('../files/build')
    await saveFile(`${block.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'song'}.mp3`, new Blob([bytes], { type: made.mime || 'audio/mpeg' }), block.title)
  }
  const lines = block.lyrics.trim().split('\n')
  const problem = typeof song === 'string' ? song : null
  return (
    <div className={`ai-card ai-song${playing ? ' is-playing' : ''}`} style={style}>
      <div className="ai-song-head">
        <span className="ai-song-disc" aria-hidden="true"><i /></span>
        <span className="ai-song-name">
          <b>{emojify(block.title)}</b>
          <span className="ai-song-tags">
            {block.genre ? <span>{block.genre}</span> : null}
            {block.instrumental ? <span>{t('ai.song_instrumental')}</span> : null}
          </span>
        </span>
        {made ? <button type="button" className="ai-song-play" aria-label={playing ? t('doc.pause') : t('doc.play')} onClick={toggle}><Icon name={playing ? 'pause' : 'play'} size={22} fill="currentColor" /></button> : null}
      </div>
      {song === null ? (
        <div className="ai-song-making" aria-live="polite">
          <span className="ai-song-wave" aria-hidden="true">{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ ['--k' as string]: k }} />)}</span>
          <span className="ai-books-hint ai-file-step">{t(`ai.song_step_${step + 1}` as 'ai.song_step_1')}</span>
        </div>
      ) : null}
      {made && url ? (
        <div className="ai-song-player">
          <audio ref={audio} src={url} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setAt(0) }}
            onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setLength(e.currentTarget.duration)} />
          <input type="range" className="ai-song-bar" min={0} max={length || 1} step={0.1} value={at} aria-label={block.title}
            style={{ ['--p' as string]: `${length ? (at / length) * 100 : 0}%` }}
            onChange={(e) => { const a = audio.current; if (a) a.currentTime = Number(e.target.value); setAt(Number(e.target.value)) }} />
          <span className="ai-song-time">{time(at)} / {time(length)}</span>
          <button type="button" className="ai-song-save" onClick={() => void save()}><Icon name="install" size={16} />{t('ai.song_save')}</button>
        </div>
      ) : null}
      {problem ? (
        <p className="ai-song-note">
          {t(problem === 'not_configured' ? 'ai.song_soon' : problem === 'refused' ? 'ai.song_refused' : problem === 'offline' ? 'ai.song_offline' : 'ai.song_failed')}
          {problem === 'failed' || problem === 'offline' ? <button type="button" className="link-btn" onClick={make}>{t('ai.song_retry')}</button> : null}
        </p>
      ) : null}
      {lines.length && block.lyrics.trim() ? (
        <div className="ai-song-lyrics">
          <span className="eyebrow">{t('ai.song_lyrics')}</span>
          <p>{emojify((open ? lines : lines.slice(0, 6)).join('\n'))}</p>
          {lines.length > 6 ? <button type="button" className="link-btn" onClick={() => setOpen(!open)}>{t(open ? 'ai.song_less' : 'ai.song_more')}</button> : null}
        </div>
      ) : null}
    </div>
  )
}

/** A higher plan's card in her answer: its crown, one line, and the way to the plans. */
function PlanCard({ style }: { style: CSSProperties }) {
  const { t } = usePrefs()
  const { open } = usePlan()
  return (
    <button type="button" className="ai-card ai-plan-card" style={style} onClick={() => open('mahliyo')}>
      <span className="plan-lock"><Icon name="crown" size={18} /></span>
      <span className="ai-plan-text"><b>{t('pw.card_title')}</b><span>{t('pw.card_text')}</span></span>
      <span className="ai-plan-go">{t('pw.card_cta')}<Icon name="forward" size={14} /></span>
    </button>
  )
}

function FileCard({ block, style, onSend }: { block: Extract<AiBlock, { type: 'file' }>; style: CSSProperties; onSend?: (text: string, files: AiUpload[]) => void }) {
  const { t } = usePrefs()
  const [open, setOpen] = useState(false)
  // "Дидан" on a document: first, where to open it; then the viewer inside the app
  const [choosing, setChoosing] = useState(false)
  const [viewing, setViewing] = useState(false)
  const [busy, setBusy] = useState(false)
  const type = fileType(block.name)
  const kind = type?.kind ?? 'text'
  const ext = extOf(block.name)
  const hint = kind === 'pdf' ? t('ai.file_pdf') : kind === 'docx' ? t('ai.file_docx') : kind === 'pptx' ? t('ai.file_pptx') : t('ai.file_text').replace('{type}', type?.label ?? ext.toUpperCase())
  const save = async () => {
    setBusy(true)
    try {
      const { buildFile, saveFile } = await import('../files/build')
      await saveFile(block.name, await buildFile(block), block.title)
    } catch {
      showToast(t('ai.file_failed'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  /** a document: where to open it (here, or another app of the phone); text and code: shown here */
  const see = () => (kind === 'text' ? setOpen(!open) : setChoosing(true))
  const build = async () => (await import('../files/build')).buildFile(block)
  /** a presentation's fix: her words, and the presentation itself (as a text file) for Mahliyo to change */
  const edit = (change: string) => {
    if (!onSend) return
    // the presentation itself, its sample's look (if any) on its first line, so the fixed one keeps it
    const bytes = new TextEncoder().encode(`${block.look ? `<!-- look: ${JSON.stringify(block.look)} -->\n` : ''}${block.content}`)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    const style = block.style ? `\n#${block.style}` : ''
    onSend(withCommand('презентатсия', `${change}${style}`), [{ mime: 'text/plain', name: block.name.replace(/\.[^.]+$/, '') + '.md', data: btoa(bin) }])
    setViewing(false)
  }
  const other = async () => {
    setBusy(true)
    try {
      const { buildFile, openFile } = await import('../files/build')
      // no app on the phone opens it: here, in the app
      if ((await openFile(block.name, await buildFile(block), block.title)) === 'no_app') setViewing(true)
    } catch {
      showToast(t('ai.file_failed'), 'alert')
    } finally {
      setBusy(false)
    }
  }
  // what is inside: a document as it reads, code as code
  const shown = kind === 'text' && type?.lang !== 'markdown' ? `\`\`\`${type?.lang ?? ''}\n${block.content}\n\`\`\`` : (block.content ?? '').replace(/^\s*---+\s*$/gm, '\n---\n')
  return (
    <div className={`ai-card ai-file kind-${kind}`} style={style}>
      <div className="ai-file-row">
        <span className={`ai-file-ico kind-${kind}`} aria-hidden="true">
          {FILE_BADGE[kind] ? <b>{FILE_BADGE[kind]}</b> : <b className="is-ext">{ext.slice(0, 4).toUpperCase()}</b>}
        </span>
        <div className="grow">
          <b className="ai-file-name">{block.name}</b>
          <span className="ai-file-hint">{block.about || hint}</span>
        </div>
      </div>
      <div className="ai-file-acts">
        <button type="button" className="ai-file-get" onClick={() => void save()} disabled={busy}>
          <Icon name={busy ? 'refresh' : 'arrow-down'} size={16} />{busy ? t('ai.file_making') : t('ai.file_download')}
        </button>
        <button type="button" className="ai-file-see" aria-expanded={kind === 'text' ? open : undefined} disabled={busy} onClick={() => void see()}>{open ? t('ai.file_hide') : t('ai.file_preview')}</button>
      </div>
      {open ? <div className="ai-file-body ai-md"><AiMarkdown text={shown} /></div> : null}
      {choosing ? <OpenChoice name={block.name} onClose={() => setChoosing(false)} onInside={() => { setChoosing(false); setViewing(true) }} onOther={() => { setChoosing(false); void other() }} /> : null}
      {viewing ? (
        <DocViewer doc={{ name: block.name, file: build, kind: kind === 'pdf' ? 'pdf' : kind === 'pptx' ? 'slides' : 'markdown', content: block.content, style: kind === 'pptx' ? (block.look ? lookStyle(block.look) : slideStyle(block.style)) : undefined }}
          onClose={() => setViewing(false)} onEdit={kind === 'pptx' && onSend ? edit : undefined} />
      ) : null}
    </div>
  )
}

function FollowList({ block, onAsk, style }: { block: Extract<AiBlock, { type: 'follow' }>; onAsk?: (text: string) => void; style: CSSProperties }) {
  if (!onAsk) return null
  return (
    <div className="ai-follow" style={style}>
      {block.items.map((q, k) => (
        <button key={k} type="button" onClick={() => onAsk(q)}><Icon name="follow" size={18} aria-hidden="true" /><span>{emojify(q)}</span></button>
      ))}
    </div>
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

export function AnswerBlocks({ blocks, fresh, id, onQuiz, onAsk, onSend }: {
  blocks: AiBlock[]; fresh: boolean; id?: string; onQuiz?: (result: string) => void; onAsk?: (text: string) => void
  /** a question with files, from any answer (a presentation's fix, with the presentation itself) */
  onSend?: (text: string, files: AiUpload[]) => void
}) {
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
          case 'choices':
            return <ChoicesCard key={i} block={b} style={style} />
          case 'callout':
            return <CalloutCard key={i} block={b} style={style} />
          case 'calc':
            return <CalcCard key={i} block={b} style={style} />
          case 'clarify':
            return <ClarifyCard key={i} block={b} onAsk={onAsk} style={style} />
          case 'music':
            return <MusicCard key={i} block={b} style={style} />
          case 'file':
            return <FileCard key={i} block={b} style={style} onSend={onSend} />
          case 'follow':
            return <FollowList key={i} block={b} onAsk={onAsk} style={style} />
          case 'premium':
            return <PlanCard key={i} style={style} />
          case 'warning':
            // insults or pressure: only this, in red
            return <p key={i} className="ai-card ai-warning" role="alert" style={style}>{emojify(b.text || t('ai.warning'))}</p>
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
const siteMark = (site: string) => (/wikipedia/.test(site) ? 'W' : site === 'Китоби расмӣ' ? '📖' : site === 'Маводи ман' ? '🎓' : site.replace(/^www\./, '')[0]?.toUpperCase() ?? '•')

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
