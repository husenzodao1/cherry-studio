'use client'

import { apiUrl } from './base'
import { browserSupabase } from '../supabase-browser'

/**
 * SOS, a walk home, and a fake call. Her trusted people (up to three, with their WhatsApp numbers) live on the
 * server with her code and on this phone (an SOS must not wait on the network to know who to tell). An alert
 * goes to the app's server, which writes to them on WhatsApp with a live map; when that fails, the phone's own
 * SMS app opens with her place written in. In the phone app the guard (SosGuard.java) keeps sending her place
 * while the app is away, and the power button pressed five times sends an SOS by itself.
 */

export interface Guardian { name: string; phone: string }
export type AlertKind = 'sos' | 'walk'
export interface Active { token: string; kind: AlertKind; link: string; dueAt: number | null; since: number }
export interface Place { lat: number; lng: number; accuracy: number }
export interface Started { token: string; link: string; kind: AlertKind; due_at: string | null; guardians: Guardian[]; sent: number; whatsapp: boolean }

const PEOPLE = 'dk.sos.people'
const ACTIVE = 'dk.sos.active'

const read = <T>(key: string): T | null => {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null } catch { return null }
}
const write = (key: string, v: unknown) => {
  try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)) } catch { /* not kept */ }
}

export const localPeople = (): Guardian[] => read<Guardian[]>(PEOPLE) ?? []
export const activeAlert = (): Active | null => read<Active>(ACTIVE)
export const keepActive = (a: Active | null) => write(ACTIVE, a)

/** "+992 90 123-45-67" → "992901234567"; not a number → null */
export function phoneDigits(v: string): string | null {
  const d = v.replace(/[\s()+.-]/g, '')
  return /^[1-9][0-9]{8,14}$/.test(d) ? d : null
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const sb = browserSupabase()
  if (!sb) throw new Error('offline')
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(/bad_phone|validation_failed/.exec(error.message)?.[0] ?? 'failed')
  return data as T
}

/** her people from the server (kept on the phone too); offline, the phone's copy */
export async function loadPeople(code: string): Promise<Guardian[]> {
  try {
    const list = await rpc<Guardian[]>('api_sos_guardians', { p_code: code })
    write(PEOPLE, list)
    return list
  } catch {
    return localPeople()
  }
}

export async function savePeople(code: string, list: Guardian[]): Promise<Guardian[]> {
  const saved = await rpc<Guardian[]>('api_sos_set_guardians', { p_code: code, p_list: list })
  write(PEOPLE, saved)
  return saved
}

const native = async () => (await import('@capacitor/core')).Capacitor.isNativePlatform()

/** her place as exactly as the phone can tell (an SOS wants the street, not the town) */
export async function exactPlace(timeout = 12_000): Promise<Place | null> {
  try {
    if (await native()) {
      const { Geolocation } = await import('@capacitor/geolocation')
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout, maximumAge: 20_000 })
      return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
    }
  } catch {
    return null
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null
  return new Promise((done) => navigator.geolocation.getCurrentPosition(
    (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
    () => done(null),
    { enableHighAccuracy: true, timeout, maximumAge: 20_000 }
  ))
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(String(res.status))
  return (await res.json()) as T
}

/** the words of the SMS her people get when WhatsApp could not be reached */
export function smsBody(template: string, name: string, place: Place | null, link?: string): string {
  const where = link || (place ? `https://maps.google.com/?q=${place.lat.toFixed(6)},${place.lng.toFixed(6)}` : '—')
  return template.replace('{name}', name).replace('{link}', where)
}

/** opens the phone's SMS app to all her people with the words written in */
export function openSms(people: Guardian[], body: string) {
  if (!people.length) return
  const to = people.map((p) => `+${p.phone}`).join(',')
  const url = `sms:${to}?body=${encodeURIComponent(body)}`
  // a test may stand in for the phone's SMS app
  const seam = (window as Window & { __dkOpen?: (url: string) => void }).__dkOpen
  if (seam) seam(url)
  else window.location.href = url
}

/**
 * Opens an alert. Resolves with the server's answer, or null when the server could not be reached (the caller
 * then opens the SMS). The phone's guard is told, so her place keeps going out while the app is away.
 */
export async function startAlert(o: { code: string; kind: AlertKind | 'late'; place: Place | null; minutes?: number; lang: string }): Promise<Started | null> {
  try {
    const r = await post<Started>('/sos/start', {
      code: o.code, kind: o.kind, lat: o.place?.lat ?? null, lng: o.place?.lng ?? null,
      ...(o.place ? { accuracy: Math.round(o.place.accuracy) } : {}), ...(o.minutes ? { minutes: o.minutes } : {}), lang: o.lang
    })
    const a: Active = { token: r.token, kind: r.kind, link: r.link, dueAt: r.due_at ? Date.parse(r.due_at) : null, since: Date.now() }
    keepActive(a)
    void guard().then((g) => g?.alert({ token: a.token, kind: a.kind, link: a.link, dueAt: a.dueAt ?? 0 })).catch(() => undefined)
    return r
  } catch {
    return null
  }
}

export async function sendPlace(code: string, a: Active, place: Place): Promise<boolean> {
  try {
    const battery = await batteryLevel()
    const r = await post<{ open: boolean }>('/sos/update', {
      code, token: a.token, lat: place.lat, lng: place.lng, accuracy: Math.round(place.accuracy), ...(battery !== null ? { battery } : {})
    })
    if (!r.open) keepActive(null)
    return r.open
  } catch {
    return true
  }
}

/** "I am safe" / "I arrived": the map closes and her people are told */
export async function stopAlert(code: string, lang: string): Promise<void> {
  const a = activeAlert()
  keepActive(null)
  void guard().then((g) => g?.clear()).catch(() => undefined)
  if (a) await post('/sos/stop', { code, token: a.token, lang }).catch(() => undefined)
}

async function batteryLevel(): Promise<number | null> {
  try {
    const b = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }).getBattery?.()
    return b ? Math.round(b.level * 100) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- the phone's guard (Android)

export interface GuardState { enabled: boolean; running: boolean; sms: boolean; place: boolean; token?: string | null; kind?: AlertKind | null; link?: string | null; walkDue?: number }
interface GuardPlugin {
  state(): Promise<GuardState>
  configure(o: { code: string; api: string; lang: string; name: string; guardians: Guardian[] }): Promise<GuardState>
  enable(o: { on: boolean }): Promise<GuardState>
  alert(o: { token: string; kind: AlertKind; link: string; dueAt: number }): Promise<GuardState>
  clear(): Promise<GuardState>
  askSms(): Promise<GuardState>
  addListener(event: 'change', f: (s: GuardState) => void): Promise<{ remove: () => Promise<void> }>
}

/** the native guard, or null in a browser (wrapped: a plugin proxy must not be what a promise resolves with) */
export async function guard(): Promise<GuardPlugin | null> {
  if (!(await native())) return null
  const { registerPlugin } = await import('@capacitor/core')
  return { ...wrap(registerPlugin<GuardPlugin>('SosGuard')) }
}
function wrap(p: GuardPlugin): GuardPlugin {
  return {
    state: () => p.state(), configure: (o) => p.configure(o), enable: (o) => p.enable(o), alert: (o) => p.alert(o),
    clear: () => p.clear(), askSms: () => p.askSms(), addListener: (e, f) => p.addListener(e, f)
  }
}

/** what the guard needs to send an SOS without the app: her code, the API, her language, name and people */
export async function configureGuard(o: { code: string; lang: string; name: string; people: Guardian[] }) {
  const g = await guard()
  if (!g) return null
  return g.configure({ code: o.code, api: apiUrl(''), lang: o.lang, name: o.name, guardians: o.people })
}
