'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { callLine, dueCall, hangUp, markRung, onNativeCall, ring, takeNative, useCall, type CallInfo, type CallLine } from '../offline/call'
import { useContent } from '../offline/content'
import { journeyOf } from '../offline/journey'
import { useLearner } from '../offline/learner'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/**
 * Mahliyo phones the learner (a reminder's time has come): a quiet, dark call screen — her picture with
 * soft rings going out from it, a gentle ringtone, "decline" and "answer". Taken, the line is silent for
 * three seconds (as a real call connecting), then she says one of her three recorded lines (chosen at
 * random) and her menu: "1" — back to the lesson, "0" — her chat, "3" — the call ends. The menu is said
 * again and again until a key is pressed on her keypad (after a while with no answer, the call ends).
 * Her voice comes from the earpiece at the top of the phone first; "Динамик" turns the speaker on. "Хомӯш"
 * mutes the learner's side, as on a phone. Her words appear as she says them. Not taken in 30 seconds,
 * it stops ringing.
 * Mounted once for the whole app; it also watches for a reminder that is due, and (in the phone app) for
 * the call the app was opened by — answered on the lock screen, the call is on at once.
 */

/** `girls`: said to a girl ("Эй духтарак"), never in boys' mode */
type Clip = { src: string; lines: [number, string][]; girls?: boolean; key?: string }
/** her recorded lines, with when each sentence starts (seconds) */
const VOICES: Clip[] = [
  { src: '/assets/call/voice-1.mp3', key: 'call.v1', girls: true, lines: [[0, 'Ау! Эй духтарак, шумо ҳамин ҷоед?'], [4.2, 'Лутфан баргардед, дарсҳо шуморо интизоранд.']] },
  { src: '/assets/call/voice-2.mp3', key: 'call.v2', lines: [[0, 'Салом, дӯстам! Шумо маро водор карда будед, ки занг занам.'], [4.1, 'Лутфан ба дарс баргардед.'], [6.1, 'Шуморо мавзӯъҳои нав интизоранд.']] },
  { src: '/assets/call/voice-3.mp3', key: 'call.v2', lines: [[0, 'Салом, дӯстам! Шумо маро водор карда будед, ки занг занам.'], [4.1, 'Лутфан ба дарс баргардед, шуморо мавзӯъҳои нав интизоранд.']] }
]
/** her menu, said again and again until a key is pressed */
const MENU: Clip = {
  src: '/assets/call/menu.mp3',
  key: 'call.menu',
  lines: [[0, 'Барои ба дарс баргаштан 1-ро пахш кунед.'], [2.8, 'Барои бо ман ҳамоҳанг шудан 0-ро пахш кунед.'], [5.75, 'Барои дарсро рад кардан 3-ро пахш кунед.'], [8.75, 'Интизори ҷавоби шумоям!']]
}
const RING_FOR = 30_000
/** the line connecting before she speaks; the pause between her words and the menu, and between menus */
const CONNECT_MS = 3000
const BETWEEN_MS = 900
const AGAIN_MS = 1800
/** the menu said this many times with no key pressed: the call ends */
const MENU_TIMES = 6
/** a vibration like a phone's: on, off, on, a pause */
const BUZZ = [500, 250, 500]
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
/** the two tones of each key (DTMF): row, column */
const DTMF: Record<string, [number, number]> = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477], '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477], '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
}

type Phase = 'ringing' | 'talking' | 'ended'

export function MahliyoCall() {
  const call = useCall()
  // a reminder that is due rings (looked for now and then, and when the app comes back)
  useEffect(() => {
    const look = async () => {
      if (document.hidden) return
      await takeNative()
      const due = dueCall()
      if (!due) return
      markRung(due.id)
      ring({ title: due.title, text: due.text })
    }
    const check = () => void look()
    check()
    const every = setInterval(check, 10_000)
    document.addEventListener('visibilitychange', check)
    const off = onNativeCall()
    return () => {
      clearInterval(every)
      document.removeEventListener('visibilitychange', check)
      off()
    }
  }, [])
  return call ? createPortal(<CallScreen info={call} />, document.body) : null
}

function play(src: string, loop = false): HTMLAudioElement {
  const a = new Audio(src)
  a.loop = loop
  a.play().catch(() => undefined)
  return a
}
const buzz = (pattern: number[] | number) => {
  try { navigator.vibrate?.(pattern) } catch { /* no vibration */ }
}
/** a key's tone, short, as a phone's keypad makes */
let tones: AudioContext | null = null
function beep(key: string) {
  const f = DTMF[key]
  if (!f) return
  try {
    tones ??= new AudioContext()
    const ctx = tones
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16)
    gain.connect(ctx.destination)
    for (const hz of f) {
      const o = ctx.createOscillator()
      o.frequency.value = hz
      o.connect(gain)
      o.start()
      o.stop(ctx.currentTime + 0.16)
    }
  } catch { /* no sound */ }
}

function CallScreen({ info }: { info: CallInfo }) {
  const { t, mode, locale } = usePrefs()
  const router = useRouter()
  const { bundle } = useContent()
  const { progress } = useLearner()
  const [phase, setPhase] = useState<Phase>('ringing')
  const [secs, setSecs] = useState(0)
  const [line, setLine] = useState('')
  const [speaker, setSpeaker] = useState(false)
  const [muted, setMuted] = useState(false)
  const [keypad, setKeypad] = useState(false)
  const [typed, setTyped] = useState('')
  // a boy never hears the line said to a girl
  const voices = VOICES.filter((v) => !(mode === 'boy' && v.girls))
  const voice = useRef(voices[Math.floor(Math.random() * voices.length)])
  const sound = useRef<CallLine | null>(null)
  /** the waits of the talk (before she speaks, between clips) and the subtitles' clock */
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const words = useRef<ReturnType<typeof setInterval> | null>(null)
  const over = useRef(false)

  // ringing: the tone, the vibration; unanswered, it stops
  useEffect(() => {
    if (phase !== 'ringing') return
    const tone = play('/assets/call/ring.mp3', true)
    buzz(BUZZ)
    const again = setInterval(() => buzz(BUZZ), 3000)
    const missed = setTimeout(() => end(false), RING_FOR)
    return () => {
      tone.pause()
      clearInterval(again)
      clearTimeout(missed)
      buzz(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // talking: the time on the line
  useEffect(() => {
    if (phase !== 'talking') return
    const started = Date.now()
    const tick = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(tick)
  }, [phase])

  const quiet = () => {
    for (const x of timers.current) clearTimeout(x)
    timers.current = []
    if (words.current) clearInterval(words.current)
    sound.current?.stop()
  }
  const later = (f: () => void, ms: number) => { timers.current.push(setTimeout(() => { if (!over.current) f() }, ms)) }

  /** says a clip on the line, its words on the screen as they come; then `next` */
  const say = (clip: Clip, next: () => void) => {
    const wire = sound.current
    if (!wire || over.current) return
    if (words.current) clearInterval(words.current)
    // another language than Tajik (her recordings are Tajik): her words in it, said by the phone's voice
    if (locale !== 'tg' && clip.key) {
      const text = t(clip.key as 'call.menu')
      setLine(text)
      wire.say(text, locale, () => { if (!over.current) next() }).catch(() => next())
      return
    }
    const started = Date.now()
    words.current = setInterval(() => {
      const at = (Date.now() - started) / 1000
      setLine([...clip.lines].reverse().find(([from]) => at >= from)?.[1] ?? '')
    }, 150)
    wire.play(clip.src, () => { if (!over.current) next() }).catch(() => next())
  }
  /** her menu, again and again until a key is pressed (then, unanswered, the call ends) */
  const menu = (n: number) => {
    if (n >= MENU_TIMES) return end()
    say(MENU, () => later(() => menu(n + 1), AGAIN_MS))
  }

  const end = (hangupTone = true) => {
    if (over.current) return
    over.current = true
    quiet()
    setPhase('ended')
    if (hangupTone) play('/assets/call/hangup.mp3')
    setTimeout(hangUp, hangupTone ? 1600 : 700)
  }
  const answer = () => {
    setPhase('talking')
    sound.current = callLine()
    // the line connects; then her words, and her menu
    later(() => say(voice.current, () => later(() => menu(0), BETWEEN_MS)), CONNECT_MS)
  }
  /** where "1" takes her: the lesson she left unfinished, or the next one on her map, or the schools */
  const lessonToGo = () => {
    const last = progress.last?.lesson
    if (last && bundle?.lessons[last] && !progress.lessons[last]?.done) return `/lesson?id=${encodeURIComponent(last)}`
    const next = journeyOf(bundle, progress).legs.flatMap((l) => l.stops).find((s) => s.next)
    return next ? `/lesson?id=${encodeURIComponent(next.id)}` : '/schools'
  }
  /** straight on, without the hang-up tones: the call closes and the page opens */
  const leaveTo = (href: string) => {
    over.current = true
    quiet()
    hangUp()
    if (href === '/mahliyo') {
      try { sessionStorage.setItem('dk.ai-from', window.location.pathname) } catch { /* home */ }
    }
    router.push(href)
  }
  const press = (key: string) => {
    beep(key)
    buzz(15)
    setTyped((x) => `${x}${key}`.slice(-12))
    if (phase !== 'talking') return
    if (key === '1') later(() => leaveTo(lessonToGo()), 250)
    else if (key === '0') later(() => leaveTo('/mahliyo'), 250)
    else if (key === '3') later(() => end(), 250)
  }
  const loud = () => {
    const on = !speaker
    setSpeaker(on)
    sound.current?.speaker(on)
  }

  // answered on the lock screen: the call is on at once
  useEffect(() => {
    if (info.answered) answer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // the app is closed meanwhile: the line goes quiet
  useEffect(() => () => { over.current = true; quiet() }, [])

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  return (
    <div className={`call is-${phase}${keypad ? ' has-keypad' : ''}`} role="dialog" aria-modal="true" aria-label={`${t('ai.call_app')}: ${info.title}`}>
      <div className="call-top">
        <span className="call-kind"><Icon name="phone" size={13} />{t('ai.call_app')}</span>
        <h2 className="call-name">{t('intro.name')}</h2>
        <span className="call-status" aria-live="polite">
          {phase === 'ringing' ? <>{t('ai.call_calling')}<i className="call-dots"><b /><b /><b /></i></> : phase === 'talking' ? mmss : t('ai.call_ended')}
        </span>
        {info.title && !keypad ? <span className="call-about">{info.title}</span> : null}
      </div>

      {keypad ? (
        <div className="call-keypad">
          <output className="call-typed" aria-live="polite">{typed || ' '}</output>
          {/* what she is saying (her menu) stays in view above the keys */}
          <p className="call-hint">{line || '\u00a0'}</p>
          <div className="call-keys" role="group" aria-label={t('ai.call_keypad')}>
            {KEYS.map((k) => <button key={k} type="button" className="call-key" onClick={() => press(k)}>{k}</button>)}
          </div>
        </div>
      ) : (
        <>
          <div className="call-face" aria-hidden="true">
            <i /><i /><i />
            <img src="/assets/mascot/salom.webp" alt="" />
          </div>
          <div className="call-say">
            {phase === 'talking' && line ? (
              <>
                <span className="call-wave" aria-hidden="true"><b /><b /><b /><b /><b /></span>
                <p key={line} className="call-line">{line}</p>
              </>
            ) : null}
          </div>
        </>
      )}

      {phase === 'talking' ? (
        <div className="call-tools">
          <button type="button" className={`call-tool${muted ? ' is-on' : ''}`} aria-pressed={muted} onClick={() => setMuted(!muted)}>
            <span><Icon name={muted ? 'mic-off' : 'mic'} size={26} /></span>{t('ai.call_mute')}
          </button>
          <button type="button" className={`call-tool is-keypad${keypad ? ' is-on' : ''}`} aria-pressed={keypad} onClick={() => setKeypad(!keypad)}>
            <span><Icon name="keypad" size={26} strokeWidth={3.4} /></span>{keypad ? t('ai.call_hide') : t('ai.call_keypad')}
          </button>
          <button type="button" className={`call-tool${speaker ? ' is-on' : ''}`} aria-pressed={speaker} onClick={loud}>
            <span><Icon name="volume" size={26} /></span>{t('ai.call_speaker')}
          </button>
        </div>
      ) : null}

      <div className="call-actions">
        {phase === 'ringing' ? (
          <>
            <button type="button" className="call-btn is-decline" onClick={() => end()}>
              <span><Icon name="phone" size={30} fill="currentColor" /></span>{t('ai.call_decline')}
            </button>
            <button type="button" className="call-btn is-accept" onClick={answer}>
              <span><Icon name="phone" size={30} fill="currentColor" /></span>{t('ai.call_accept')}
            </button>
          </>
        ) : phase === 'talking' ? (
          <button type="button" className="call-btn is-decline" onClick={() => end()}>
            <span><Icon name="phone" size={30} fill="currentColor" /></span>{t('ai.call_end')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
