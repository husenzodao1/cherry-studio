'use client'

/**
 * Where the learner is, roughly (only with her leave): Mahliyo answers with what is true where she lives
 * (her country's customs, time, places, prices). Only about 10 km exact (one decimal), kept on this phone,
 * and sent with a question — never the exact place.
 */

const KEY = 'dk.place'
/** looked at again once a day at most */
const FRESH_MS = 24 * 3600_000

interface Place { lat: number; lon: number; at: number }

const read = (): Place | null => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Place | null
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) ? p : null
  } catch {
    return null
  }
}

/** her rough place for Mahliyo ("38.6, 68.8"), or nothing */
export function placeNote(): string | undefined {
  const p = read()
  return p ? `${p.lat.toFixed(1)}, ${p.lon.toFixed(1)}` : undefined
}

const native = async () => (await import('@capacitor/core')).Capacitor.isNativePlatform()

/**
 * The permission, read and asked by the app's own small plugin (DkPlace): the Geolocation plugin answers
 * "location services are not enabled" instead whenever the phone's location switch is off, which the app
 * took for "not allowed". `services`: the switch is on (only then can her place be found).
 */
interface PlaceState { place: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'; services: boolean }
const dkPlace = async () => {
  const { registerPlugin } = await import('@capacitor/core')
  // wrapped: a plugin is a proxy that turns any property into a native call, so no promise may resolve with it
  return { p: registerPlugin<{ state(): Promise<PlaceState>; ask(): Promise<PlaceState> }>('DkPlace') }
}
/** The Geolocation plugin (for her place itself), wrapped for the same reason */
const plugin = async () => {
  const { Geolocation } = await import('@capacitor/geolocation')
  return { geo: Geolocation }
}

/** keeps her place, rounded (about 10 km) */
function keep(lat: number, lon: number) {
  const round = (x: number) => Math.round(x * 10) / 10
  try { localStorage.setItem(KEY, JSON.stringify({ lat: round(lat), lon: round(lon), at: Date.now() })) } catch { /* not kept */ }
}

/**
 * Whether she allowed it. In the phone app: Android's own permission (the web view's answer is no use
 * there — it says "ask" even after the permission was given in the settings); in a browser: its answer,
 * or a place found before.
 */
export async function placeAllowed(): Promise<boolean> {
  if (await native()) {
    try {
      const { p } = await dkPlace()
      return (await p.state()).place === 'granted'
    } catch {
      return read() !== null
    }
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) return true
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (st?.state === 'granted') return true
    if (st?.state === 'denied') return false
  } catch { /* the question cannot be asked here */ }
  return read() !== null
}

/** her place now, kept rounded (in the background: the permission is what counts) */
async function locate(timeout: number): Promise<boolean> {
  if (await native()) {
    try {
      // the phone's location switched off: nothing to find now (looked at again another day)
      const { p } = await dkPlace()
      if (!(await p.state()).services) return false
      const { geo } = await plugin()
      const pos = await geo.getCurrentPosition({ enableHighAccuracy: false, maximumAge: FRESH_MS, timeout })
      keep(pos.coords.latitude, pos.coords.longitude)
      return true
    } catch {
      return false
    }
  }
  return new Promise((done) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => { keep(pos.coords.latitude, pos.coords.longitude); done(true) },
      () => done(false),
      { enableHighAccuracy: false, maximumAge: FRESH_MS, timeout }
    )
  })
}

/**
 * Asks for her rough place: the phone's own question. Resolves whether it is allowed now. Once she said
 * "never", Android asks no more: with `settings`, the app's settings are opened then (only then — a "no" to
 * the question just asked is her answer, and no settings open by themselves).
 */
export async function askPlace(timeout = 15_000, settings = false): Promise<boolean> {
  if (await native()) {
    try {
      const { p } = await dkPlace()
      const before = await p.state()
      const st = before.place === 'granted' ? before : before.place === 'denied' ? null : await p.ask()
      if (!st) {
        if (settings) (await import('./call')).openAppSettings()
        return false
      }
      const ok = st.place === 'granted'
      // allowed: her place is found in the background (when the location switch is on)
      if (ok) void locate(timeout)
      return ok
    } catch {
      return false
    }
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) return false
  return locate(timeout)
}

/** Once she allowed it: her rough place is looked at again when it is a day old (never asks anew). */
export async function refreshPlace(): Promise<void> {
  const p = read()
  if (p && Date.now() - p.at < FRESH_MS) return
  if (!(await placeAllowed())) return
  await askPlace()
}
