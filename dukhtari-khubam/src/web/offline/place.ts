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

/** whether she allowed it (the browser says so, or a place was found before) */
export async function placeAllowed(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return true
  try {
    const st = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (st?.state === 'granted') return true
    if (st?.state === 'denied') return false
  } catch { /* the question cannot be asked here */ }
  return read() !== null
}

/**
 * Asks for her rough place (the phone shows its own question the first time) and keeps it, rounded.
 * Resolves whether it was given.
 */
export function askPlace(timeout = 15_000): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(false)
  return new Promise((done) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const round = (x: number) => Math.round(x * 10) / 10
        try { localStorage.setItem(KEY, JSON.stringify({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude), at: Date.now() })) } catch { /* not kept */ }
        done(true)
      },
      () => done(false),
      { enableHighAccuracy: false, maximumAge: FRESH_MS, timeout }
    )
  })
}

/** Once she allowed it: her rough place is looked at again when it is a day old (never asks anew). */
export async function refreshPlace(): Promise<void> {
  const p = read()
  if (p && Date.now() - p.at < FRESH_MS) return
  if (!(await placeAllowed())) return
  await askPlace()
}
