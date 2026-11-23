'use client'

import { Capacitor } from '@capacitor/core'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { sunset } from '@/lib/sun'

import { alphaVideo, CLIPS } from '../mahliyo'
import { placeNote } from '../offline/place'
import { usePrefs } from '../prefs'
import type { UiKey } from '../i18n'
import { emojify } from './Emoji'

/**
 * Mahliyo's scenes for the time of day, once in each period (docs/mahliyo-scenes.md):
 * - night (22:00–05:00): go to sleep — "Барномаро пӯшидан ва хоб рафтан", a quiet "Рад кардан";
 * - early morning (05:00–07:40): the phone first thing harms the mind — "Барномаро пӯшидан", a quiet "Давом додан";
 * - breakfast (07:40–08:40), lunch (12:30–13:30), and dinner (from 30 to 90 minutes after sunset where she is:
 *   early in winter, late in summer) — eat first, learn after.
 * A scene's clip plays once (a transparent film), then she stays in its last moment and only its small effect goes
 * on (Z's, a sun, steam…). The other scenes are a picture of her (`art`) with that effect.
 */
type SceneId = 'night' | 'morning' | 'breakfast' | 'lunch' | 'dinner'
interface Scene {
  id: SceneId
  clip: { video: string; first: string; end: string } | null
  /** her picture for the scene (a transparent image), for a scene without a clip */
  art?: string
  /** the small effect that goes on after the clip */
  fx: string[]
  close: UiKey
  stay: UiKey
}
const SCENES: Record<SceneId, Scene> = {
  night: { id: 'night', clip: { video: '/assets/mahliyo/sleep.webm', first: '/assets/mahliyo/sleep.webp', end: '/assets/mahliyo/sleep-end.webp' }, fx: ['Z', 'z', 'z'], close: 'night.sleep', stay: 'night.refuse' },
  morning: { id: 'morning', clip: null, art: '/assets/mahliyo/morning.webp', fx: ['☀️', '✨', '✨'], close: 'scene.close', stay: 'scene.go_on' },
  breakfast: { id: 'breakfast', clip: null, art: '/assets/mahliyo/breakfast.webp', fx: ['☕', '🍳', '💛'], close: 'scene.close_eat', stay: 'scene.go_on' },
  lunch: { id: 'lunch', clip: null, art: '/assets/mahliyo/lunch.webp', fx: ['🍲', '🥗', '💚'], close: 'scene.close_eat', stay: 'scene.go_on' },
  dinner: { id: 'dinner', clip: null, art: '/assets/mahliyo/dinner.webp', fx: ['🍵', '🌙', '✨'], close: 'scene.close_eat', stay: 'scene.go_on' }
}
const KEY = 'dk.scene'
const DUSHANBE = { lat: 38.56, lon: 68.78 }

const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes()
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
/** where she is, roughly (only if she allowed it), else the capital */
function placeOf() {
  const p = placeNote()?.split(',').map(Number)
  return p && p.length === 2 && p.every(Number.isFinite) ? { lat: p[0], lon: p[1] } : DUSHANBE
}

/** The scene for this moment and the period it belongs to (shown once per period), or null. */
export function sceneAt(now: Date, place = DUSHANBE): { scene: SceneId; period: string } | null {
  const m = minutes(now)
  if (m >= 22 * 60 || m < 5 * 60) {
    const night = new Date(now)
    if (m < 5 * 60) night.setDate(night.getDate() - 1)
    return { scene: 'night', period: `night-${dayKey(night)}` }
  }
  const day = dayKey(now)
  if (m < 7 * 60 + 40) return { scene: 'morning', period: `morning-${day}` }
  if (m < 8 * 60 + 40) return { scene: 'breakfast', period: `breakfast-${day}` }
  if (m >= 12 * 60 + 30 && m < 13 * 60 + 30) return { scene: 'lunch', period: `lunch-${day}` }
  const set = sunset(now, place.lat, place.lon)
  if (set) {
    const from = minutes(set) + 30
    if (m >= from && m < Math.min(from + 60, 22 * 60)) return { scene: 'dinner', period: `dinner-${day}` }
  }
  return null
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function NightGuard() {
  const { t } = usePrefs()
  const path = usePathname() ?? '/'
  const [now, setNow] = useState<Date | null>(null)
  const [seen, setSeen] = useState<string | null>(null)
  const [bye, setBye] = useState(false)
  const [video, setVideo] = useState(false)
  const [ended, setEnded] = useState(false)

  useEffect(() => {
    try { setSeen(localStorage.getItem(KEY)) } catch { /* none */ }
    setVideo(alphaVideo())
    const tick = () => setNow(new Date())
    tick()
    const timer = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [])

  const at = now ? sceneAt(now, placeOf()) : null
  if (!now || !at || seen === at.period || seen === 'off' || /^\/(admin|start)(\/|$)/.test(path)) return null
  const scene = SCENES[at.scene]
  const stay = () => {
    try { localStorage.setItem(KEY, at.period) } catch { /* only for now */ }
    setSeen(at.period)
    setEnded(false)
  }
  const close = async () => {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app')
      return void App.exitApp()
    }
    setBye(true)
  }
  // without the clip (a picture scene, iPhone, less motion asked): her picture with the effect at once
  const still = !scene.clip || !video || ended
  const picture = scene.clip ? (still ? scene.clip.end : scene.clip.first) : scene.art ?? CLIPS.signin.still
  return (
    <div className={`night scene-${scene.id}`} role="dialog" aria-modal="true" aria-label={t(`scene.${scene.id}_title`)}>
      <div className="night-sky" aria-hidden="true"><i className="night-moon" /><i className="night-stars" /><i className="night-stars night-stars-2" /><i className="night-shoot" /></div>
      <h2 className="night-title">{emojify(t(`scene.${scene.id}_title`))}</h2>
      <div className={`night-art${scene.clip ? '' : scene.art ? ' is-art' : ' is-portrait'}`} aria-hidden="true">
        {still
          ? <img className="night-breathe" src={picture} alt="" />
          : <video src={scene.clip!.video} poster={scene.clip!.first} autoPlay muted playsInline onEnded={() => setEnded(true)} onError={() => setEnded(true)} />}
        {still ? <span className="night-z">{scene.fx.map((f, i) => <i key={i}>{f}</i>)}</span> : null}
      </div>
      {bye ? (
        <p className="night-text">{t(scene.id === 'night' ? 'night.bye' : 'scene.bye')}</p>
      ) : (
        <>
          <p className="night-text">{emojify(t(`scene.${scene.id}_text`).replace('{соат}', hhmm(now)))}</p>
          <div className="night-actions">
            <button type="button" className="night-sleep" onClick={() => void close()}>{t(scene.close)}</button>
            <button type="button" className="night-refuse" onClick={stay}>{t(scene.stay)}</button>
          </div>
        </>
      )}
    </div>
  )
}
