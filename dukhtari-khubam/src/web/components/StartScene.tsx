'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Icon } from './Icon'
import { LOCALE_LABELS, LOCALES } from '../i18n'
import { usePrefs } from '../prefs'

/** The two girls standing at the scene's sides, looking towards each other (cut-out photos). */
export interface SceneGirls { left: string; right: string }
const GIRLS: SceneGirls = { left: '/assets/mascot/start-left.webp', right: '/assets/mascot/start-right.webp' }
/** where their eyes are, as a share of the pictures' height */
const EYES = 0.17

/**
 * The top of the sign-in screen: a soft many-coloured gradient that drifts slowly, with the live 3D
 * orbit of glass objects between two girls (orbit3d.ts, loaded only here); their lower half melts
 * into the page before the Google button.
 */
export function StartScene({ girls = GIRLS }: { girls?: SceneGirls | null }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const left = useRef<HTMLImageElement>(null)
  const refocus = useRef<() => void>(() => undefined)
  useEffect(() => {
    const el = canvas.current
    if (!el) return
    let stop: (() => void) | undefined
    let gone = false
    // the girls' eye line, as a share of the scene's height: the orbit circles there
    const focus = () => {
      const img = left.current
      if (!img?.complete || !img.naturalHeight) return 0.42
      const box = el.getBoundingClientRect()
      const r = img.getBoundingClientRect()
      // the picture is drawn whole inside its box (contain), standing on the box's bottom
      const drawn = r.height * Math.min(1, (r.width / r.height) / (img.naturalWidth / img.naturalHeight))
      return (r.bottom - drawn + drawn * EYES - box.top) / box.height
    }
    import('./orbit3d').then(({ mountOrbit }) => {
      if (gone) return
      try {
        const orbit = mountOrbit(el, {
          light: document.documentElement.classList.contains('lite'),
          still: matchMedia('(prefers-reduced-motion: reduce)').matches,
          focus
        })
        stop = orbit.stop
        refocus.current = orbit.refocus
      } catch {
        // no WebGL on this phone: the gradient alone stays
      }
    }).catch(() => undefined)
    return () => { gone = true; stop?.() }
  }, [])

  return (
    <div className="start-scene" aria-hidden="true">
      {/* the drifting sky is larger than the scene: its frame clips it and fades it at the bottom */}
      <div className="ss-bg"><div className="ss-sky" /></div>
      <canvas ref={canvas} className="ss-orbit" />
      {girls ? (
        <>
          <img ref={left} className="ss-girl is-left" src={girls.left} alt="" onLoad={() => refocus.current()} />
          <img className="ss-girl is-right" src={girls.right} alt="" />
        </>
      ) : null}
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
