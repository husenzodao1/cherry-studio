'use client'

import { Capacitor, registerPlugin } from '@capacitor/core'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { useContent } from '../offline/content'
import { useLearner } from '../offline/learner'
import { widgetSummary } from '../offline/widgets'
import { usePrefs } from '../prefs'

const Widgets = registerPlugin<{ update(data: Record<string, unknown>): Promise<void> }>('Widgets')

/** Path inside the app from a widget link (tj.dukhtarikhubam.app://open/<path>). */
export function widgetPath(url: string): string | null {
  const m = url.match(/^[a-z.]+:\/\/open(\/[^#]*)?$/i)
  if (!m) return null
  const path = m[1] || '/'
  return /^\/[A-Za-z0-9/_?=&.-]*$/.test(path) ? path : '/'
}

/**
 * Android app: keeps the home-screen widgets up to date (streak, week, lessons, words of the day) and
 * opens the screen a widget was tapped for.
 */
/** the Mahliyo widget's scenes (DkWidgets.java) */
const WIDGET_SCENES = ['morning', 'win', 'fire', 'wait', 'worry', 'last', 'sad', 'sleep', 'party', 'cold'] as const

export function WidgetBridge() {
  const { t, locale } = usePrefs()
  const { bundle } = useContent()
  const { learner, progress } = useLearner()
  const router = useRouter()
  const native = typeof window !== 'undefined' && Capacitor.isNativePlatform()

  const data = useMemo(() => (learner ? widgetSummary(bundle, progress, {
    brand: t('app.name'), streak: t('profile.streak'), done: t('widget.done'), continueFallback: t('home.start_learning'),
    words: t('home.words'), quote: t('home.quote'),
    scenes: Object.fromEntries(WIDGET_SCENES.map((id) => [id, t(`widget.s_${id}`)])), go: t('widget.go')
  }, locale) : null), [bundle, progress, learner, t, locale])

  useEffect(() => {
    if (!native || !data) return
    const timer = setTimeout(() => Widgets.update(data).catch(() => undefined), 800)
    return () => clearTimeout(timer)
  }, [native, data])

  useEffect(() => {
    if (!native) return
    let remove: (() => void) | undefined
    let alive = true
    ;(async () => {
      const { App } = await import('@capacitor/app')
      const go = (url?: string | null) => {
        const path = url ? widgetPath(url) : null
        if (path) router.push(path)
      }
      go((await App.getLaunchUrl().catch(() => undefined))?.url)
      const handle = await App.addListener('appUrlOpen', ({ url }) => go(url))
      if (alive) remove = () => void handle.remove()
      else void handle.remove()
    })()
    return () => {
      alive = false
      remove?.()
    }
  }, [native, router])
  return null
}
