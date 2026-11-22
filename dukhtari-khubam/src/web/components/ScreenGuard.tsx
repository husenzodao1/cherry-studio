'use client'

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { usePrefs } from '../prefs'
import { showToast } from './Toast'

/**
 * The lessons stay private. On a lesson, a test or the day's review:
 * - in the phone app, the window is secure (android ScreenGuard.java): a screenshot or a screen recording
 *   shows it black; when the phone tells of one, the learner is told it is forbidden;
 * - in the browser (which cannot forbid it), the words cannot be selected or copied, nothing can be
 *   printed, the lesson hides while the window is not in front (a snipping tool), and the screenshot keys
 *   are met with the same message.
 */

interface NativeGuard {
  secure(o: { on: boolean }): Promise<void>
  addListener(event: 'capture' | 'shot', f: (e: { kind: string }) => void): Promise<PluginListenerHandle>
  watchShots(o: { on: boolean }): Promise<void>
}
const Native = registerPlugin<NativeGuard>('ScreenGuard')

/** the screens whose content is guarded */
export const guarded = (path: string) => /^\/(lesson|quiz|review)(\/|$)/.test(path)

export function ScreenGuard() {
  const path = usePathname() ?? '/'
  const { t } = usePrefs()
  const on = guarded(path)
  useEffect(() => {
    if (!on) return
    const say = () => showToast(t('guard.no_capture'), 'lock', 4000)
    const root = document.documentElement
    root.classList.add('no-capture')
    if (Capacitor.isNativePlatform()) {
      void Native.secure({ on: true }).catch(() => undefined)
      let handle: PluginListenerHandle | null = null
      void Native.addListener('capture', say).then((h) => { handle = h })
      return () => {
        root.classList.remove('no-capture')
        void Native.secure({ on: false }).catch(() => undefined)
        void handle?.remove()
      }
    }
    const keys = (e: KeyboardEvent) => {
      const shot = e.key === 'PrintScreen' || ((e.metaKey || e.ctrlKey) && e.shiftKey && /^[345s]$/i.test(e.key))
      const out = (e.metaKey || e.ctrlKey) && /^[psc]$/i.test(e.key) && !e.shiftKey
      if (!shot && !out) return
      e.preventDefault()
      if (shot) void navigator.clipboard?.writeText('').catch(() => undefined)
      say()
    }
    const block = (e: Event) => e.preventDefault()
    const away = () => root.classList.add('is-away')
    const back = () => root.classList.remove('is-away')
    window.addEventListener('keydown', keys, true)
    window.addEventListener('keyup', keys, true)
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    window.addEventListener('blur', away)
    window.addEventListener('focus', back)
    return () => {
      root.classList.remove('no-capture', 'is-away')
      window.removeEventListener('keydown', keys, true)
      window.removeEventListener('keyup', keys, true)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      window.removeEventListener('blur', away)
      window.removeEventListener('focus', back)
    }
  }, [on, t])
  return null
}

/**
 * A screenshot of the screen this is used on (Mahliyo's chat): in the phone app the phone tells of it
 * (Android 14+, or a new picture in the Screenshots folder before); in the browser, the PrintScreen key.
 */
export function useScreenshot(on: boolean, onShot: () => void) {
  const shot = useRef(onShot)
  shot.current = onShot
  useEffect(() => {
    if (!on) return
    if (Capacitor.isNativePlatform()) {
      let handle: PluginListenerHandle | null = null
      let live = true
      void Native.watchShots({ on: true }).catch(() => undefined)
      void Native.addListener('shot', () => shot.current()).then((h) => { if (live) handle = h; else void h.remove() })
      return () => {
        live = false
        void Native.watchShots({ on: false }).catch(() => undefined)
        void handle?.remove()
      }
    }
    const key = (e: KeyboardEvent) => { if (e.key === 'PrintScreen') shot.current() }
    window.addEventListener('keyup', key)
    return () => window.removeEventListener('keyup', key)
  }, [on])
}
