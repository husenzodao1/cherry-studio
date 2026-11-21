'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { BRAVO, INTRO, type Said, type Spoken, spokenBy, wordsAt } from '@/lib/intro'

import type { UiKey } from '../i18n'
import { alphaVideo, CLIPS, playWithSound } from '../mahliyo'
import { usePrefs } from '../prefs'
import { Icon } from './Icon'

type Phase = 'talk' | 'ask' | 'yes' | 'out'

/** Each of her two clips: the keys of what she says, how they group into lines, and when she says them. */
const SCRIPTS: Record<'talk' | 'bravo', { keys: UiKey[]; lines: number[][]; speech: readonly Spoken[] }> = {
  talk: { keys: ['intro.hello', 'intro.me', 'intro.here', 'intro.ready'], lines: [[0, 1], [2], [3]], speech: INTRO },
  bravo: { keys: ['intro.bravo', 'intro.go', 'intro.awaits'], lines: [[0, 1], [2]], speech: BRAVO }
}
const NONE: Said = { shown: [], now: null, speaking: false }
const same = (a: Said, b: Said) => a.speaking === b.speaking && a.now?.join() === b.now?.join() && a.shown.join() === b.shown.join()

/**
 * Mahliyo meets a new learner right after sign-in, before the welcome questions. She comes in from the
 * left and speaks in Tajik (her clip, with its sound) while her words appear above her one by one as she
 * says them: each rises softly out of a blur, the word she is saying glows, and her name over them has a
 * little voice wave that moves while she speaks. The clip's own time drives the words, so they never run
 * ahead of her voice. "Бале" comes when she has finished (a tap on her or her words shows them all at
 * once); then she says "Офарин! Пас, рафтем! …" the same way, claps with joy, and the questions open.
 * Where her clip cannot play, her still picture speaks with the same timing.
 */
export function MahliyoIntro({ onDone }: { onDone: () => void }) {
  const { t } = usePrefs()
  const [moving, setMoving] = useState<boolean | null>(null)
  const [phase, setPhase] = useState<Phase>('talk')
  const [said, setSaid] = useState<Said>(NONE)
  const [yesOn, setYesOn] = useState(false)
  const talk = useRef<HTMLVideoElement>(null)
  const yes = useRef<HTMLVideoElement>(null)
  const ask = useRef<HTMLButtonElement>(null)
  const all = useRef(false)
  const done = useRef(onDone)
  done.current = onDone

  const bravo = phase === 'yes' || phase === 'out'
  const script = SCRIPTS[bravo ? 'bravo' : 'talk']
  const words = useMemo(() => script.keys.map((k) => t(k).split(' ')), [script, t])
  const wordsRef = useRef(words)
  wordsRef.current = words

  // she starts once the opening screen has gone (opened afresh on this page, it would hide her first words)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const ready = () => {
      const splash = document.getElementById('splash')
      if (splash && !splash.hidden) return void (timer = setTimeout(ready, 150))
      setMoving(alphaVideo())
    }
    ready()
    return () => clearTimeout(timer)
  }, [])

  // one loop for whichever clip is speaking: her clip's time; if it stalls, a clock a little behind carries on
  useEffect(() => {
    if (moving === null || (phase !== 'talk' && phase !== 'yes')) return
    const speech = SCRIPTS[phase === 'yes' ? 'bravo' : 'talk'].speech
    const v = moving ? (phase === 'yes' ? yes.current : talk.current) : null
    if (v && phase === 'talk') void playWithSound(v)
    const end = spokenBy(speech)
    const t0 = performance.now()
    let raf = 0
    const tick = () => {
      const clock = (performance.now() - t0) / 1000
      const time = phase === 'talk' && all.current ? Infinity : Math.max(v?.currentTime ?? 0, v ? clock - 1.5 : clock)
      const next = wordsAt(wordsRef.current, time, speech)
      setSaid((prev) => (same(prev, next) ? prev : next))
      if (time >= end) {
        if (phase === 'talk') setPhase('ask')
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [moving, phase])

  useEffect(() => {
    if (phase === 'ask') ask.current?.focus({ preventScroll: true })
    if (phase === 'yes') {
      // her clip ends by itself (then the questions); this only guards against one that never ends
      const guard = setTimeout(() => setPhase('out'), moving ? 10_000 : (spokenBy(BRAVO) + 1.2) * 1000)
      return () => clearTimeout(guard)
    }
    if (phase === 'out') {
      const gone = setTimeout(() => done.current(), 420)
      return () => clearTimeout(gone)
    }
  }, [phase, moving])

  const onYes = () => {
    if (phase !== 'ask') return
    setSaid(NONE)
    setPhase('yes')
    const y = moving ? yes.current : null
    if (!y) return
    talk.current?.pause()
    y.currentTime = 0
    void playWithSound(y)
  }
  const showAll = () => { all.current = true }

  // a line is laid out whole once she starts it (words still to come keep their place, unseen), so no
  // word ever jumps; the bubble grows upwards a line at a time
  const started = (line: number[]) => line.some((i) => (said.shown[i] ?? 0) > 0)
  const line = (sentences: number[], n: number) => (
    <p key={n} className={sentences.includes(3) && !bravo ? 'mi-ask' : undefined}>
      {sentences.map((i) => words[i].map((w, j) => {
        const cls = `mi-w${j < (said.shown[i] ?? 0) ? ' is-in' : ''}${said.now?.[0] === i && said.now[1] === j ? ' is-now' : ''}`
        return <span key={`${i}-${j}`}><span className={cls}>{w}</span>{' '}</span>
      }))}
    </p>
  )
  const lines = script.lines.filter(started)
  if (moving === null) return <div className="mahliyo-intro" />
  return (
    <div className={`mahliyo-intro is-${phase}${yesOn ? ' is-yes-on' : ''}`}>
      <div className="mi-say" onClick={showAll}>
        <div className="mi-who">
          <span className="mi-name">{t('intro.name')}</span>
          <span className={`mi-wave${said.speaking ? ' is-on' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
        </div>
        <p className="sr-only" aria-live="polite">{bravo ? words.map((w) => w.join(' ')).join(' ') : SCRIPTS.talk.keys.map((k) => t(k)).join(' ')}</p>
        <div key={bravo ? 'bravo' : 'talk'} className="mi-lines" aria-hidden="true">
          {lines.length ? lines.map((l, n) => line(l, n)) : <span className="mi-dots"><i /><i /><i /></span>}
        </div>
      </div>
      <div className="mi-stage" onClick={showAll}>
        {moving ? (
          <>
            <video ref={talk} className="mi-clip is-talk" src={CLIPS.intro.video} poster={CLIPS.intro.still} playsInline preload="auto" disableRemotePlayback />
            <video ref={yes} className="mi-clip is-yes" src={CLIPS.yes.video} playsInline preload="auto" disableRemotePlayback
              onPlaying={() => setYesOn(true)} onEnded={() => setPhase('out')} />
          </>
        ) : (
          <img className="mi-clip" src={bravo ? CLIPS.yes.still : CLIPS.intro.still} alt="" />
        )}
      </div>
      <button ref={ask} type="button" className="btn btn-block btn-lg mi-yes" disabled={phase !== 'ask'} aria-hidden={phase === 'talk'} onClick={onYes}>
        {t('intro.yes')} <Icon name="arrow" size={18} />
      </button>
    </div>
  )
}
