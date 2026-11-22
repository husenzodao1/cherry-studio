'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon'
import { LOCALE_LABELS, LOCALES } from '../i18n'
import { alphaVideo, CLIPS, playWithSound } from '../mahliyo'
import { usePrefs } from '../prefs'

/**
 * The eight small 3D objects of what she teaches and where each settles around her head and shoulders,
 * as the owner drew it: offsets from the middle of her face, in widths of her hijab.
 */
const OBJECTS: [string, number, number][] = [
  ['obj-moon', -1.24, -0.73],
  ['school-religion', -0.62, -0.9],
  ['school-family', 0.64, -0.99],
  ['school-modern', 1.06, -0.42],
  ['school-culture', -0.96, 0.36],
  ['school-growth', 0.81, 0.33],
  ['school-health', -1.23, 1.07],
  ['school-ethics', 1.21, 0.87]
]

/**
 * The top of the sign-in screen: a soft many-coloured gradient that drifts slowly; Mahliyo with her book
 * comes up from the middle, leafs through it, looks up and waves (a looping clip with its sound), while
 * the objects come out from behind her head one after another and settle around her, floating all the
 * while. The scene's lower half melts into the page before the Google button.
 */
export function StartScene() {
  const scene = useRef<HTMLDivElement>(null)
  const girl = useRef<HTMLDivElement>(null)
  const safe = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const [moving, setMoving] = useState(false)
  useEffect(() => setMoving(alphaVideo()), [])

  useEffect(() => {
    const v = video.current
    if (moving && v) void playWithSound(v)
  }, [moving])

  useEffect(() => {
    const box = scene.current
    const her = girl.current
    if (!box || !her) return
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    const items = [...box.querySelectorAll<HTMLElement>('.ss-obj')]
    let flights: Animation[] = []

    // her layout box (her coming-up animation does not move it) gives their places
    const place = (fly: boolean) => {
      const W = box.clientWidth
      const H = box.clientHeight
      const gw = her.offsetWidth
      const gh = her.offsetHeight
      const top = (safe.current?.offsetHeight ?? 24) + 4
      const unit = gw * 0.34 // her hijab's width
      const size = Math.round(Math.min(46, Math.max(30, unit * 0.4)))
      const cx = W / 2
      const cy = H - gh + gh * 0.21 // the middle of her face
      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
      const at = (x: number, y: number, k: number) => `translate(${x - size / 2}px, ${y - size / 2}px) scale(${k})`
      flights = items.flatMap((el, i) => {
        const [, dx, dy] = OBJECTS[i]
        const x = clamp(cx + dx * unit, size / 2 + 4, W - size / 2 - 4)
        const y = clamp(cy + dy * unit, top + size / 2, H - size / 2)
        const end = at(x, y, 1)
        el.style.width = el.style.height = `${size}px`
        el.style.transform = end
        el.style.opacity = '1'
        if (!fly) return []
        if (still) return [el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: i * 80, fill: 'backwards' })]
        // out from behind her head, on a soft arc, one after another
        return [el.animate([
          { transform: at(cx, cy, 0.25), opacity: 0 },
          { transform: at(cx + (x - cx) * 0.7, cy + (y - cy) * 0.7 - 12, 1.08), opacity: 1, offset: 0.65 },
          { transform: end, opacity: 1 }
        ], { duration: 1100, delay: 700 + i * 120, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'backwards' })]
      })
    }
    place(true)

    // the keyboard or a turn of the phone changes the scene's size: they follow her, gently
    let size = `${box.clientWidth}x${box.clientHeight}`
    const ro = new ResizeObserver(() => {
      const now = `${box.clientWidth}x${box.clientHeight}`
      if (now === size) return
      size = now
      flights.forEach((f) => f.finish())
      box.classList.add('is-moving')
      place(false)
    })
    ro.observe(box)
    return () => {
      ro.disconnect()
      flights.forEach((f) => f.cancel())
    }
  }, [])

  const clip = CLIPS.signin
  return (
    <div ref={scene} className="start-scene" aria-hidden="true">
      {/* the drifting sky is larger than the scene: its frame clips it and fades it at the bottom */}
      <div className="ss-bg"><div className="ss-sky" /></div>
      <div ref={safe} className="ss-safe" />
      {/* behind her: they come out from behind her head */}
      <div className="ss-flight">
        {OBJECTS.map(([name], i) => <span key={name} className="ss-obj" style={{ ['--i' as string]: i }}><img src={`/assets/3d/${name}.webp`} alt="" decoding="async" /></span>)}
      </div>
      <div ref={girl} className="ss-mahliyo">
        {moving
          ? <video ref={video} src={clip.video} poster={clip.still} loop playsInline preload="auto" disableRemotePlayback />
          : <img src={clip.still} alt="" />}
      </div>
    </div>
  )
}

/** The language, top right of the sign-in screen: a bare icon; a tap opens a small centred list. */
export function StartLanguage() {
  const prefs = usePrefs()
  const { t } = prefs
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <>
      <button type="button" className="start-lang" aria-label={t('settings.language')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Icon name="globe" size={24} />
      </button>
      {open ? createPortal(
        <div className="lang-scrim" onClick={() => setOpen(false)}>
          <div className="lang-box" role="dialog" aria-modal="true" aria-label={t('settings.language')} onClick={(e) => e.stopPropagation()}>
            <span className="eyebrow">{t('settings.language')}</span>
            <div className="lang-box-list" role="radiogroup">
              {LOCALES.map((l, i) => (
                <button key={l} type="button" role="radio" aria-checked={prefs.locale === l} lang={l} className="lang-row" style={{ ['--i' as string]: i }}
                  onClick={() => { prefs.set({ locale: l }); setTimeout(() => setOpen(false), 220) }}>
                  <span>{LOCALE_LABELS[l]}</span>
                  {prefs.locale === l ? <Icon name="check" size={18} /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>,
        // on the page itself the scrim would be held inside the screen's moving box
        document.body
      ) : null}
    </>
  )
}
