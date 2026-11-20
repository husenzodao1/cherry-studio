'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { SPOKEN_BY, typedAt } from '@/lib/intro'
import { withName } from '@/lib/mascot'

import { alphaVideo, CLIPS, playWithSound } from '../mahliyo'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

type Phase = 'talk' | 'ask' | 'yes' | 'out'

/**
 * Mahliyo meets a new learner right after sign-in, before the welcome questions. She comes in from the
 * left and speaks (her clip, with its sound) while her words are written above her, each sentence as she
 * says it — the clip's own time drives the letters, so they never run ahead of her voice. "Бале" comes
 * when she has finished (a tap on her or her words writes them all at once); then she claps with joy and
 * the questions open. Where her clip cannot play, her still picture speaks with the same timing.
 */
export function MahliyoIntro({ name, onDone }: { name?: string; onDone: () => void }) {
  const { t } = usePrefs()
  const sentences = useMemo(() => [withName(t('intro.hello'), name), t('intro.me'), t('intro.here'), t('intro.ready')].map((s) => [...s]), [t, name])
  const [moving, setMoving] = useState<boolean | null>(null)
  const [shown, setShown] = useState<number[]>([0, 0, 0, 0])
  const [phase, setPhase] = useState<Phase>('talk')
  const [yesOn, setYesOn] = useState(false)
  const talk = useRef<HTMLVideoElement>(null)
  const yes = useRef<HTMLVideoElement>(null)
  const ask = useRef<HTMLButtonElement>(null)
  const all = useRef(false)
  const lengths = useRef<number[]>([])
  lengths.current = sentences.map((s) => s.length)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => setMoving(alphaVideo()), [])

  useEffect(() => {
    if (moving === null || phase !== 'talk') return
    const v = moving ? talk.current : null
    if (v) void playWithSound(v)
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      // her clip's time; if it stalls, a clock a little behind it carries on
      const clock = (performance.now() - t0) / 1000
      const time = all.current ? Infinity : Math.max(v?.currentTime ?? 0, v ? clock - 1.5 : clock)
      const now = typedAt(lengths.current, time)
      setShown((prev) => (prev.every((n, i) => n === now[i]) ? prev : now))
      if (time >= SPOKEN_BY) return setPhase('ask')
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [moving, phase])

  useEffect(() => {
    if (phase === 'ask') ask.current?.focus({ preventScroll: true })
    if (phase === 'yes') {
      // the clap ends by itself; this only guards against a clip that never ends
      const guard = setTimeout(() => setPhase('out'), moving ? 7000 : 1700)
      return () => clearTimeout(guard)
    }
    if (phase === 'out') {
      const gone = setTimeout(() => done.current(), 420)
      return () => clearTimeout(gone)
    }
  }, [phase, moving])

  const onYes = () => {
    if (phase !== 'ask') return
    setPhase('yes')
    const y = moving ? yes.current : null
    if (!y) return
    talk.current?.pause()
    y.currentTime = 0
    void playWithSound(y)
  }

  // a paragraph is laid out whole once she starts it (its rest still clear), so no word jumps lines
  // while it is written; the bubble grows upwards a paragraph at a time
  const part = (i: number) => (
    <span key={i}><span className="mi-typed">{sentences[i].slice(0, shown[i]).join('')}</span><span className="mi-rest">{sentences[i].slice(shown[i]).join('')}</span></span>
  )
  const started = (i: number) => shown[i] > 0
  const writeAll = () => { all.current = true }
  const open = shown[0] > 0 || phase !== 'talk'
  return (
    <div className={`mahliyo-intro is-${phase}${yesOn ? ' is-yes-on' : ''}`}>
      <div className={`mi-say${open ? ' is-open' : ''}`} onClick={writeAll}>
        <p className="sr-only">{sentences.map((s) => s.join('')).join(' ')}</p>
        <div aria-hidden="true">
          <p>{part(0)} {part(1)}</p>
          {started(2) ? <p>{part(2)}</p> : null}
          {started(3) ? <p className="mi-ask">{part(3)}</p> : null}
        </div>
      </div>
      <div className="mi-stage" onClick={writeAll}>
        {moving ? (
          <>
            <video ref={talk} className="mi-clip is-talk" src={CLIPS.intro.video} poster={CLIPS.intro.still} playsInline preload="auto" disableRemotePlayback />
            <video ref={yes} className="mi-clip is-yes" src={CLIPS.yes.video} playsInline preload="auto" disableRemotePlayback
              onPlaying={() => setYesOn(true)} onEnded={() => setPhase('out')} />
          </>
        ) : moving === false ? (
          <img className="mi-clip" src={phase === 'talk' || phase === 'ask' ? CLIPS.intro.still : CLIPS.yes.still} alt="" />
        ) : null}
      </div>
      <button ref={ask} type="button" className="btn btn-block btn-lg mi-yes" disabled={phase !== 'ask'} aria-hidden={phase === 'talk'} onClick={onYes}>
        {t('intro.yes')} <Icon name="arrow" size={18} />
      </button>
    </div>
  )
}
