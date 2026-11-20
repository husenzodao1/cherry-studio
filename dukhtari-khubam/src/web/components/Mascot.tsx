'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { ALL_POSES, greeting, type Memory, type Moment, nextSaying, POSES, sayingsFor, withName } from '@/lib/mascot'
import { useLearner } from '../offline/learner'
import { CLIPS } from '../mahliyo'
import { usePrefs } from '../prefs'
import { noDock } from './Dock'
import { Icon } from './Icon'

/**
 * The girl who speaks at the right moments: a card at the bottom with her standing on it, a little
 * taller than the card, and one short saying (lib/mascot.ts). Shown on every opening of the app, on
 * opening a course, at the end of a stage,
 * before and during tests (two wrong answers in a row: "stop"; three right ones: praise), after a test
 * and after a lesson. A tap closes it; it also leaves by itself once read.
 */

const poseUrl = (pose: string) => `/assets/mascot/${pose}.webp`
const loaded = new Map<string, Promise<void>>()
/** Loads (and decodes) one picture once; later calls get the same promise. */
function loadImage(src: string): Promise<void> {
  let p = loaded.get(src)
  if (!p) {
    const img = new Image()
    img.src = src
    p = img.decode().catch(() => undefined)
    loaded.set(src, p)
  }
  return p
}
const loadPose = (pose: string) => loadImage(poseUrl(pose))
/** All her pictures and her first look on the sign-in screen, loaded while the opening screen is up (Splash waits for them, briefly). */
export const preloadMascot = () => Promise.all([...ALL_POSES.map(loadPose), loadImage(CLIPS.signin.still)]).then(() => undefined)
const within = (p: Promise<void>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))])

const listeners = new Set<(m: Moment) => void>()
/** Lets her say something for this moment. */
export function say(moment: Moment) { listeners.forEach((f) => f(moment)) }

const KEY = 'dk.mascot'
interface Stored extends Memory { day?: string }
const load = (): Stored => {
  try { return { bags: {}, last: {}, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { bags: {}, last: {} } }
}
const store = (s: Stored) => { try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage blocked: sayings may repeat */ } }
const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Card { id: number; moment: Moment; text: string; pose: string }

export function Mascot() {
  const prefs = usePrefs()
  const { t } = prefs
  const { learner } = useLearner()
  const path = usePathname() ?? '/'
  const [card, setCard] = useState<Card | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [noGirl, setNoGirl] = useState(false)
  const name = useRef<string | undefined>(undefined)
  name.current = learner?.name
  const locale = useRef(prefs.locale)
  locale.current = prefs.locale

  useEffect(() => {
    let n = 0
    const on = (moment: Moment) => {
      const saved = load()
      const sayings = sayingsFor(locale.current)[moment]
      const { index, memory } = nextSaying(moment, sayings.length, saved)
      store({ ...saved, ...memory })
      const poses = POSES[moment]
      const pose = poses[Math.floor(Math.random() * poses.length)]
      const id = ++n
      // she appears with her picture already drawn, never as an empty card
      void within(loadPose(pose), 1500).then(() => {
        if (id !== n) return
        setNoGirl(false)
        setLeaving(false)
        setCard({ id, moment, text: withName(sayings[index], name.current), pose })
      })
    }
    listeners.add(on)
    return () => { listeners.delete(on) }
  }, [])

  // leaves by itself once read (longer words stay longer)
  useEffect(() => {
    if (!card) return
    const stay = Math.min(9000, 3200 + card.text.length * 55)
    const out = setTimeout(() => setLeaving(true), stay)
    return () => clearTimeout(out)
  }, [card])
  useEffect(() => {
    if (!leaving) return
    const gone = setTimeout(() => setCard(null), 320)
    return () => clearTimeout(gone)
  }, [leaving])

  // on every opening of the app, on the home screen, after the opening screen and the PIN
  useEffect(() => {
    if (path !== '/' || !learner) return
    try { if (sessionStorage.getItem('dk.greeted')) return } catch { /* storage blocked: greet */ }
    const saved = load()
    const today = localDay()
    const moment = greeting(today, saved.day ?? null)
    let timer: ReturnType<typeof setTimeout>
    const wait = () => {
      const splash = document.getElementById('splash')
      if ((splash && !splash.hidden) || document.documentElement.classList.contains('locked')) return void (timer = setTimeout(wait, 400))
      timer = setTimeout(() => {
        try { sessionStorage.setItem('dk.greeted', '1') } catch { /* storage blocked */ }
        store({ ...load(), day: today })
        say(moment)
      }, 1200)
    }
    wait()
    return () => clearTimeout(timer)
  }, [path, learner])

  if (!card) return null
  return (
    <div key={card.id} className={`mascot is-${card.moment}${noGirl ? ' no-girl' : ''}${leaving ? ' is-leaving' : ''}`}
      style={{ ['--mascot-bottom' as string]: noDock(path) ? '0px' : '86px' }}
      role="status" aria-live="polite" onClick={() => setLeaving(true)}>
      {noGirl ? null : (
        <span className="mascot-girl" aria-hidden="true">
          <img src={poseUrl(card.pose)} alt="" decoding="sync" onError={() => setNoGirl(true)} />
        </span>
      )}
      <p className="mascot-text">{card.text}</p>
      <button type="button" className="mascot-close" aria-label={t('action.close')}><Icon name="x" size={16} /></button>
    </div>
  )
}
