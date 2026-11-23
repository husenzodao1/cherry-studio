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
const plugin = async () => (await import('@capacitor/geolocation')).Geolocation

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
      const st = await (await plugin()).checkPermissions()
      return st.location === 'granted' || st.coarseLocation === 'granted'
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
      const pos = await (await plugin()).getCurrentPosition({ enableHighAccuracy: false, maximumAge: FRESH_MS, timeout })
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
 * Asks for her rough place: the phone's own question the first time. Resolves whether it is allowed now
 * (once she said "no for ever", Android asks no more: false, and the app's settings are opened instead).
 */
export async function askPlace(timeout = 15_000): Promise<boolean> {
  if (await native()) {
    try {
      const geo = await plugin()
      let st = await geo.checkPermissions()
      if (st.location !== 'granted' && st.coarseLocation !== 'granted') st = await geo.requestPermissions({ permissions: ['coarseLocation'] })
      const ok = st.location === 'granted' || st.coarseLocation === 'granted'
      // allowed: her place is found in the background (location may be off; the permission is given all the same)
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
