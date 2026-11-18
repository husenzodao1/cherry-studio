'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_STRINGS, type Locale, type UiKey } from './i18n'

export interface Prefs {
  locale: Locale
  theme: 'light' | 'dark' | 'system'
  motion: 'full' | 'reduce' | 'system'
  textScale: number
}

interface PrefsApi extends Prefs {
  set: (patch: Partial<Prefs>) => void
  reducedMotion: boolean
  t: (key: UiKey) => string
  help: Record<string, { title?: string | null; body: string; icon: string }>
}

const DEFAULTS: Prefs = { locale: 'tg', theme: 'system', motion: 'system', textScale: 1 }
const KEY = 'dk.prefs'
const PrefsContext = createContext<PrefsApi | null>(null)

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

/** Theme, language, motion and text size; applied to <html> and stored on this device. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [systemDark, setSystemDark] = useState(false)
  const [systemReduce, setSystemReduce] = useState(false)
  const [cms, setCms] = useState<{ strings: Record<string, string>; help: PrefsApi['help'] }>({ strings: {}, help: {} })

  useEffect(() => {
    setPrefs(read())
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    setSystemDark(dark.matches)
    setSystemReduce(reduce.matches)
    const onDark = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    const onReduce = (e: MediaQueryListEvent) => setSystemReduce(e.matches)
    dark.addEventListener('change', onDark)
    reduce.addEventListener('change', onReduce)
    return () => {
      dark.removeEventListener('change', onDark)
      reduce.removeEventListener('change', onReduce)
    }
  }, [])

  const reducedMotion = prefs.motion === 'reduce' || (prefs.motion === 'system' && systemReduce)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme
    root.dataset.motion = reducedMotion ? 'reduce' : 'full'
    root.lang = prefs.locale
    root.dir = prefs.locale === 'ar' ? 'rtl' : 'ltr'
    root.style.setProperty('--text-scale', String(prefs.textScale))
  }, [prefs, systemDark, reducedMotion])

  useEffect(() => {
    let alive = true
    fetch(`/api/v1/ui?locale=${prefs.locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => alive && data && setCms({ strings: data.strings ?? {}, help: data.help ?? {} }))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [prefs.locale])

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable: keep in memory */
      }
      return next
    })
  }, [])

  const value = useMemo<PrefsApi>(() => {
    const local = DEFAULT_STRINGS[prefs.locale]
    const t = (key: UiKey) => {
      if (prefs.locale === 'tg' && cms.strings[key]) return cms.strings[key]
      return local[key] ?? cms.strings[key] ?? DEFAULT_STRINGS.tg[key] ?? key
    }
    return { ...prefs, set, reducedMotion, t, help: cms.help }
  }, [prefs, set, reducedMotion, cms])

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsApi {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs outside PrefsProvider')
  return ctx
}
