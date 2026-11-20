'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_STRINGS, isRtl, LOCALES, type Locale, type UiKey } from './i18n'

/** Peach (the default), white, dark and three more colour themes; "dusk" is a dark one. */
export const THEMES = ['peach', 'light', 'dark', 'sakura', 'mint', 'dusk'] as const
export type Theme = (typeof THEMES)[number]
export const isDarkTheme = (t: Theme) => t === 'dark' || t === 'dusk'

export interface Prefs {
  locale: Locale
  theme: Theme
  textScale: number
}

interface PrefsApi extends Prefs {
  set: (patch: Partial<Prefs>) => void
  t: (key: UiKey) => string
  help: Record<string, { title?: string | null; body: string; icon: string }>
  /** CMS strings and help texts, supplied from the content bundle stored on the phone */
  setCms: (cms: { strings?: Record<string, string>; help?: PrefsApi['help'] }) => void
}

// standard look: the Peach theme and the smallest text size
export const MIN_TEXT_SCALE = 0.9
/** The two text sizes offered: small (the standard) and medium. */
export const TEXT_SIZES = [{ key: 'small', scale: 0.9 }, { key: 'medium', scale: 1 }] as const
const snapScale = (x: number) => (Number(x) >= 0.95 ? 1 : 0.9)
const DEFAULTS: Prefs = { locale: 'tg', theme: 'peach', textScale: MIN_TEXT_SCALE }
const VERSION = 3
const KEY = 'dk.prefs'
const PrefsContext = createContext<PrefsApi | null>(null)

function read(): Prefs {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const { locale, theme, textScale } = { ...DEFAULTS, ...stored }
    return {
      // Arabic was removed: such settings (and any unknown one) return to Tajik
      locale: LOCALES.includes(locale) ? locale : DEFAULTS.locale,
      // white was the standard theme before version 3: such settings move to the new standard, Peach
      theme: (THEMES as readonly string[]).includes(theme) && !(theme === 'light' && (stored.v ?? 0) < VERSION) ? theme : DEFAULTS.theme,
      // settings saved before version 2 carried the old default size (1): move it to the new default
      // only two sizes now: any older value goes to the nearer one
      textScale: snapScale((stored.v ?? 0) >= 2 ? textScale : textScale === 1 ? DEFAULTS.textScale : textScale)
    }
  } catch {
    return DEFAULTS
  }
}

/** Theme, language and text size; applied to <html> and stored on this device. Animations always play in full. */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [cms, setCms] = useState<{ strings: Record<string, string>; help: PrefsApi['help'] }>({ strings: {}, help: {} })

  useEffect(() => {
    setPrefs(read())
  }, [])

  useEffect(() => {
    const root = document.documentElement
    // data-theme is the light or dark base; data-palette recolours it
    root.dataset.theme = isDarkTheme(prefs.theme) ? 'dark' : 'light'
    if (prefs.theme === 'light' || prefs.theme === 'dark') delete root.dataset.palette
    else root.dataset.palette = prefs.theme
    root.lang = prefs.locale
    root.dir = isRtl(prefs.locale) ? 'rtl' : 'ltr'
    root.style.setProperty('--text-scale', String(prefs.textScale))
  }, [prefs])

  const applyCms = useCallback((c: { strings?: Record<string, string>; help?: PrefsApi['help'] }) => {
    setCms({ strings: c.strings ?? {}, help: c.help ?? {} })
  }, [])

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify({ ...next, v: VERSION }))
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
      // Uzbek, Turkish, Persian and Dari cover the main screens; the rest comes in English
      const wide = prefs.locale !== 'tg' && prefs.locale !== 'ru' ? DEFAULT_STRINGS.en[key] : undefined
      return local[key] ?? wide ?? cms.strings[key] ?? DEFAULT_STRINGS.tg[key] ?? key
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
