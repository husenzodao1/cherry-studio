'use client'

import type { LatLon } from '@/lib/navigation'

/**
 * "Эй Маҳлиё" in the app (the phone's HeyMahliyo plugin, see HeyMahliyo.java): its state, the models, listening
 * once (the enrolment phrases, a question), her voiceprint, the always-listening service, the phone's voice and
 * tools (a timer, a call). Only in the phone app; in a browser it is not there (`native()` is false).
 */

export interface HeyState { models: boolean; enrolled: boolean; enabled: boolean; running: boolean; mic: boolean; overlay: boolean }
export interface Heard { text: string; spk: number[] | null }
interface Listener { remove(): Promise<void> }
interface HeyPlugin {
  state(): Promise<HeyState>
  askMic(): Promise<HeyState>
  askOverlay(): Promise<void>
  prepare(): Promise<{ models: boolean }>
  listen(o: { seconds?: number; whole?: boolean }): Promise<Heard>
  stopListening(): Promise<void>
  saveVoice(o: { prints: number[][] }): Promise<{ threshold: number; least: number }>
  forgetVoice(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  resume(): Promise<void>
  takeWake(): Promise<{ woke: boolean }>
  speak(o: { text: string; lang: string }): Promise<void>
  stopSpeaking(): Promise<void>
  setTimer(o: { seconds: number; label?: string }): Promise<void>
  askCalls(): Promise<{ granted: boolean }>
  findContacts(o: { name: string }): Promise<{ contacts: { name: string; number: string }[] }>
  callNumber(o: { number: string }): Promise<void>
  assistantSettings(): Promise<void>
  addListener(event: 'progress', f: (e: { part: string; done: number; total: number }) => void): Promise<Listener>
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

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/х/g, 'ҳ').split(/\s+/).filter(Boolean)
/**
 * Whether a phrase was said well enough to learn her voice from: her name heard, and at least half of its
 * other words.
 */
export function phraseHeard(phrase: string, heard: string): boolean {
  const said = new Set(words(heard))
  const want = words(phrase)
  if (!said.has('маҳлиё')) return false
  const rest = want.filter((w) => w !== 'эй' && w !== 'маҳлиё')
  return rest.filter((w) => said.has(w)).length >= Math.ceil(rest.length / 2)
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
