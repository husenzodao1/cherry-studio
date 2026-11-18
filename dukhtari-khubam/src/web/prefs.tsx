'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_STRINGS, type Locale, type UiKey } from './i18n'

export interface Prefs {
  locale: Locale
  theme: 'light' | 'dark' | 'system'
  textScale: number
}

interface PrefsApi extends Prefs {
  set: (patch: Partial<Prefs>) => void
  t: (key: UiKey) => string
  help: Record<string, { title?: string | null; body: string; icon: string }>
  /** CMS strings and help texts, supplied from the content bundle stored on the phone */
  setCms: (cms: { strings?: Record<string, string>; help?: PrefsApi['help'] }) => void
}

const DEFAULTS: Prefs = { locale: 'tg', theme: 'system', textScale: 1 }
const KEY = 'dk.prefs'
const PrefsContext = createContext<PrefsApi | null>(null)

function read(): Prefs {
  try {
    const { locale, theme, textScale } = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    return { locale, theme, textScale }
  } catch {
    return DEFAULTS
  }
}

/** Theme, language and text size; applied to <html> and stored on this device. Animations always play in full. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [systemDark, setSystemDark] = useState(false)
  const [cms, setCms] = useState<{ strings: Record<string, string>; help: PrefsApi['help'] }>({ strings: {}, help: {} })

  useEffect(() => {
    setPrefs(read())
    const dark = matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(dark.matches)
    const onDark = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    dark.addEventListener('change', onDark)
    return () => dark.removeEventListener('change', onDark)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme
    root.lang = prefs.locale
    root.dir = prefs.locale === 'ar' ? 'rtl' : 'ltr'
    root.style.setProperty('--text-scale', String(prefs.textScale))
  }, [prefs, systemDark])

  const applyCms = useCallback((c: { strings?: Record<string, string>; help?: PrefsApi['help'] }) => {
    setCms({ strings: c.strings ?? {}, help: c.help ?? {} })
  }, [])

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
    return { ...prefs, set, t, help: cms.help, setCms: applyCms }
  }, [prefs, set, cms, applyCms])

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsApi {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs outside PrefsProvider')
  return ctx
}
