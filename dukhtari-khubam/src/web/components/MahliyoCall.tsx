'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { dueCall, hangUp, markRung, onNativeCall, ring, takeNative, useCall, type CallInfo } from '../offline/call'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

/**
 * Mahliyo phones the learner (a reminder's time has come): a quiet, dark call screen — her picture with
 * soft rings going out from it, a gentle ringtone, "decline" and "answer". Taken, she speaks one of her
 * three recorded lines on a phone line (chosen at random), her words appear as she says them; then the
 * line's "дн-дн-дннн" and the call ends by itself. Not taken in 30 seconds, it stops ringing.
 * Mounted once for the whole app; it also watches for a reminder that is due, and (in the phone app) for
 * the call the app was opened by — answered on the lock screen, she speaks at once.
 */

/** her recorded lines, with when each sentence starts (seconds) */
const VOICES: { src: string; lines: [number, string][] }[] = [
  { src: '/assets/call/voice-1.mp3', lines: [[0, 'Ау! Эй духтарак, шумо ҳамин ҷоед?'], [4.2, 'Лутфан баргардед, дарсҳо шуморо интизоранд.'], [8.2, 'Хайр!']] },
  { src: '/assets/call/voice-2.mp3', lines: [[0, 'Салом, дӯстам! Шумо маро водор карда будед, ки занг занам.'], [4.1, 'Лутфан ба дарс баргардед.'], [6.1, 'Шуморо мавзӯъҳои нав интизоранд.'], [8.1, 'То дидор!']] },
  { src: '/assets/call/voice-3.mp3', lines: [[0, 'Салом, дӯстам! Шумо маро водор карда будед, ки занг занам.'], [4.1, 'Лутфан ба дарс баргардед, шуморо мавзӯъҳои нав интизоранд.'], [8.1, 'То дидор!']] }
]
const RING_FOR = 30_000
/** a vibration like a phone's: on, off, on, a pause */
const BUZZ = [500, 250, 500]

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

function CallScreen({ info }: { info: CallInfo }) {
  const { t } = usePrefs()
  const [phase, setPhase] = useState<Phase>('ringing')
  const [secs, setSecs] = useState(0)
  const [line, setLine] = useState('')
  const voice = useRef(VOICES[Math.floor(Math.random() * VOICES.length)])
  const audio = useRef<HTMLAudioElement | null>(null)

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

  // talking: the time on the line, and her words as she says them
  useEffect(() => {
    if (phase !== 'talking') return
    const started = Date.now()
    const tick = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 250)
    return () => clearInterval(tick)
  }, [phase])

  const end = (hangupTone = true) => {
    audio.current?.pause()
    setPhase('ended')
    if (hangupTone) play('/assets/call/hangup.mp3')
    setTimeout(hangUp, hangupTone ? 1600 : 700)
  }
  const answer = () => {
    setPhase('talking')
    const v = voice.current
    const a = play(v.src)
    audio.current = a
    a.ontimeupdate = () => {
      const now = [...v.lines].reverse().find(([at]) => a.currentTime >= at)
      setLine(now?.[1] ?? '')
    }
    a.onended = () => end()
    a.onerror = () => end()
  }
  // answered on the lock screen: she speaks at once
  useEffect(() => {
    if (info.answered) answer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // the app is closed meanwhile: the line goes quiet
  useEffect(() => () => { audio.current?.pause() }, [])

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  return (
    <div className={`call is-${phase}`} role="dialog" aria-modal="true" aria-label={`${t('ai.call_app')}: ${info.title}`}>
      <div className="call-top">
        <span className="call-kind"><Icon name="phone" size={13} />{t('ai.call_app')}</span>
        <h2 className="call-name">Маҳлиё</h2>
        <span className="call-status" aria-live="polite">
          {phase === 'ringing' ? <>{t('ai.call_calling')}<i className="call-dots"><b /><b /><b /></i></> : phase === 'talking' ? mmss : t('ai.call_ended')}
        </span>
        {info.title ? <span className="call-about">{info.title}</span> : null}
      </div>

      <div className="call-face" aria-hidden="true">
        <i /><i /><i />
        <img src="/assets/mascot/salom.webp" alt="" />
      </div>

      <div className="call-say">
        {phase === 'talking' ? (
          <>
            <span className="call-wave" aria-hidden="true"><b /><b /><b /><b /><b /></span>
            {line ? <p key={line} className="call-line">{line}</p> : null}
          </>
        ) : null}
      </div>

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
