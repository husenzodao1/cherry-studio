'use client'

import type { LatLon } from '@/lib/navigation'

/**
 * "Эй Маҳлиё" in the app (the phone's HeyMahliyo plugin, see HeyMahliyo.java): its state, the models, listening
 * once (the enrolment phrases, a question), her voiceprint, the always-listening service, the phone's voice and
 * tools (a timer, a call). Only in the phone app; in a browser it is not there (`native()` is false).
 */

export interface HeyState {
  models: boolean; enrolled: boolean; enabled: boolean; running: boolean; mic: boolean; overlay: boolean
  /** the speech models on the phone (Tajik always, once downloaded), a download going on, headphones on */
  langs?: string[]; downloading?: boolean; percent?: number; headset?: boolean
}
/** `wav`: the recording (asked with `audio`), for the server's AI */
export interface Heard { text: string; spk: number[] | null; wav?: string }

/** the speech models she can choose, with their size (MB) and name */
export const VOICE_LANGS: { lang: string; mb: number; name: string }[] = [
  { lang: 'tg', mb: 66, name: 'Тоҷикӣ' }, { lang: 'ru', mb: 46, name: 'Русский' }, { lang: 'en', mb: 41, name: 'English' },
  { lang: 'uz', mb: 51, name: "O'zbekcha" }, { lang: 'tr', mb: 37, name: 'Türkçe' }, { lang: 'fa', mb: 53, name: 'فارسی / دری' }
]
/** the app's language as a speech model's (Dari is heard by the Persian one) */
export const voiceLang = (locale: string) => (locale === 'prs' ? 'fa' : locale)
interface Listener { remove(): Promise<void> }
interface HeyPlugin {
  state(): Promise<HeyState>
  askMic(): Promise<HeyState>
  askOverlay(): Promise<void>
  prepare(o?: { langs?: string[]; title?: string; done?: string; failed?: string }): Promise<{ models: boolean; langs?: string[] }>
  removeLang(o: { lang: string }): Promise<HeyState>
  listen(o: { seconds?: number; whole?: boolean; lang?: string; audio?: boolean }): Promise<Heard>
  stopListening(): Promise<void>
  saveVoice(o: { prints: number[][]; note?: string }): Promise<{ threshold: number; least: number }>
  forgetVoice(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  resume(): Promise<void>
  pause(): Promise<void>
  takeWake(): Promise<{ woke: boolean }>
  speak(o: { text: string; lang: string; speaker?: boolean }): Promise<void>
  stopSpeaking(): Promise<void>
  setTimer(o: { seconds: number; label?: string }): Promise<void>
  askCalls(): Promise<{ granted: boolean }>
  contacts(): Promise<{ contacts: { name: string; number: string }[] }>
  callNumber(o: { number: string }): Promise<void>
  assistantSettings(): Promise<void>
  addListener(event: 'progress', f: (e: { part: string; done: number; total: number; percent?: number }) => void): Promise<Listener>
  addListener(event: 'prepared', f: (e: { ok: boolean }) => void): Promise<Listener>
  addListener(event: 'partial', f: (e: { text: string }) => void): Promise<Listener>
  addListener(event: 'wake', f: () => void): Promise<Listener>
}

export const native = () => typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

/** the plugin, wrapped (a plugin is a proxy: no promise may resolve with it) */
export async function hey(): Promise<{ p: HeyPlugin }> {
  const { registerPlugin } = await import('@capacitor/core')
  return { p: registerPlugin<HeyPlugin>('HeyMahliyo') }
}

/** the enrolment: three phrases with her name, said in her own voice */
export const PHRASES = ['Эй Маҳлиё, имрӯз обу ҳаво чӣ гуна аст?', 'Эй Маҳлиё, соат чанд шуд?', 'Эй Маҳлиё, маро ба хона бубар.']

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean)
/**
 * A word by its consonants only ("маҳлиё" → "мхл", "моро" → "мр"): the phone's small model often hears the
 * vowels wrong ("моро" for "маро", "бо" for "ба"), rarely the consonants. Tajik letters as Russian ones.
 */
export const skeleton = (w: string) => w.toLowerCase().replace(/ҳ/g, 'х').replace(/қ/g, 'к').replace(/ҷ/g, 'ч').replace(/ғ/g, 'г')
  .replace(/[аоуэеиёюяыӣӯьъйa-z]/g, '')
const near = (a: string, b: string) => {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  // one letter more, less or different
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
}
/** her name, as a small model may hear it: "маҳлиё", "махлие", "моҳи" … (м-х-л, or м-х after "эй") */
export function nameHeard(heard: string): boolean {
  const ws = words(heard)
  return ws.some((w, i) => {
    const k = skeleton(w)
    return k === 'мхл' || k === 'млх' || (k === 'мх' && /^(эй|ей|ҳей|хей|ай|hey)$/.test(ws[i - 1] ?? '')) || /^mah?l/.test(w)
  })
}
/**
 * Whether a phrase was said well enough to learn her voice from: her name heard (as a small model hears it),
 * and at least half of its other words alike in their consonants.
 */
export function phraseHeard(phrase: string, heard: string): boolean {
  if (!nameHeard(heard)) return false
  const said = words(heard).map(skeleton).filter(Boolean)
  const rest = words(phrase).filter((w) => !/^(эй|маҳлиё)$/.test(w)).map(skeleton).filter(Boolean)
  const found = rest.filter((k) => said.some((s) => near(k, s))).length
  return found >= Math.ceil(rest.length / 2)
}

/** the weather where she is now (Open-Meteo, no key): degrees, wind, and what the sky does */
export interface Weather { temp: number; wind: number; code: number; max?: number; min?: number }
export async function weatherAt(at: LatLon, when: 'now' | 'tomorrow'): Promise<Weather> {
  const q = new URLSearchParams({
    latitude: at[0].toFixed(2), longitude: at[1].toFixed(2), timezone: 'auto', forecast_days: '2',
    current: 'temperature_2m,weather_code,wind_speed_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min'
  })
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(10_000) })
  if (!r.ok) throw new Error(`weather ${r.status}`)
  const d = (await r.json()) as { current: { temperature_2m: number; weather_code: number; wind_speed_10m: number }; daily: { weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } }
  if (when === 'tomorrow') return { temp: Math.round((d.daily.temperature_2m_max[1] + d.daily.temperature_2m_min[1]) / 2), wind: 0, code: d.daily.weather_code[1], max: Math.round(d.daily.temperature_2m_max[1]), min: Math.round(d.daily.temperature_2m_min[1]) }
  return { temp: Math.round(d.current.temperature_2m), wind: Math.round(d.current.wind_speed_10m / 3.6), code: d.current.weather_code, max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]) }
}

/** WMO weather codes as the app's words (keys of the texts: wx.clear, wx.cloudy, …) */
export function skyKey(code: number): string {
  if (code === 0) return 'wx.clear'
  if (code <= 2) return 'wx.partly'
  if (code === 3) return 'wx.cloudy'
  if (code === 45 || code === 48) return 'wx.fog'
  if (code >= 51 && code <= 67) return 'wx.rain'
  if (code >= 71 && code <= 77) return 'wx.snow'
  if (code >= 80 && code <= 82) return 'wx.showers'
  if (code >= 85 && code <= 86) return 'wx.snow'
  if (code >= 95) return 'wx.storm'
  return 'wx.cloudy'
}

/** what Mahliyo said, as words to speak: no marks of formatting, no links, no emoji */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#>`|]+/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)
}
