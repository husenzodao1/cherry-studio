'use client'

import { Capacitor } from '@capacitor/core'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { usePrefs } from '../prefs'

/** Pages where the back button leaves the app (after a second press) instead of going back. */
const ROOTS = /^\/(start\/?)?$/
const EXIT_WINDOW_MS = 2000

/**
 * Overlays (photo choices, cropper, dialogs) close themselves on the phone's back button: they listen
 * for this event and call preventDefault().
 */
export const BACK_EVENT = 'dk-back'
export function onBack(handler: () => void): () => void {
  const fn = (e: Event) => {
    e.preventDefault()
    handler()
  }
  window.addEventListener(BACK_EVENT, fn)
  return () => window.removeEventListener(BACK_EVENT, fn)
}

/**
 * The Android back button: an open overlay closes first; then the app goes back one screen at a time;
 * on the home screen the first press shows the system note "press again to leave" and a second press
 * within two seconds closes the app. Behind the PIN screen it leaves the app at once.
 */
export function BackButton() {
  const { t } = usePrefs()
  const router = useRouter()
  const path = usePathname() ?? '/'
  const pathRef = useRef(path)
  pathRef.current = path
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let last = 0
    let remove: (() => void) | undefined
    let alive = true
    ;(async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('backButton', async ({ canGoBack }) => {
        // an open overlay takes the press and closes
        const evt = new Event(BACK_EVENT, { cancelable: true })
        if (!window.dispatchEvent(evt)) return
        if (document.documentElement.classList.contains('locked')) return App.minimizeApp()
        const here = pathRef.current
        if (!ROOTS.test(here)) {
          if (canGoBack && window.history.length > 1) window.history.back()
          else router.replace('/')
          return
        }
        const now = Date.now()
        if (now - last < EXIT_WINDOW_MS) return App.exitApp()
        last = now
        const { Toast } = await import('@capacitor/toast')
        Toast.show({ text: tRef.current('app.exit_again'), duration: 'short', position: 'bottom' }).catch(() => undefined)
      })
      if (alive) remove = () => void handle.remove()
      else void handle.remove()
    })()
    return () => {
      alive = false
      remove?.()
    }
  }, [router])
  return null
}
