'use client'

import type { LatLon } from '@/lib/navigation'

/**
 * Following her on the street for "Маро бубар": her precise place, again and again, while she goes. In the
 * phone app: the location switch must be on (its settings open for her otherwise) and the precise permission
 * given; in a browser: its own question.
 */

export interface Fix { at: LatLon; accuracy: number; heading: number | null; speed: number | null }
export type Ready = 'ok' | 'off' | 'refused'

const native = async () => (await import('@capacitor/core')).Capacitor.isNativePlatform()
interface PlaceState { place: string; precise?: string; services: boolean }
const dkPlace = async () => {
  const { registerPlugin } = await import('@capacitor/core')
  // wrapped: a plugin is a proxy, never what a promise resolves with
  return { p: registerPlugin<{ state(): Promise<PlaceState>; askPrecise(): Promise<PlaceState>; locationSettings(): Promise<void> }>('DkPlace') }
}

/** whether she can be followed now: the location switch on and the precise place allowed (asked here) */
export async function readyToFollow(): Promise<Ready> {
  if (!(await native())) return typeof navigator !== 'undefined' && navigator.geolocation ? 'ok' : 'refused'
  try {
    const { p } = await dkPlace()
    const before = await p.state()
    if (!before.services) return 'off'
    const st = before.precise === 'granted' ? before : await p.askPrecise()
    return st.precise === 'granted' || st.place === 'granted' ? 'ok' : 'refused'
  } catch {
    return 'refused'
  }
}

/** the phone's location switch, in its settings */
export async function openLocationSettings() {
  if (!(await native())) return
  try { await (await dkPlace()).p.locationSettings() } catch { /* nothing to open */ }
}

/** her place as it changes; the returned function stops it */
export async function follow(onFix: (f: Fix) => void, onError: (e: unknown) => void): Promise<() => void> {
  if (await native()) {
    const { Geolocation } = await import('@capacitor/geolocation')
    const geo = { g: Geolocation }
    const id = await geo.g.watchPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 2000 }, (pos, err) => {
      if (err || !pos) return onError(err)
      onFix({ at: [pos.coords.latitude, pos.coords.longitude], accuracy: pos.coords.accuracy, heading: pos.coords.heading ?? null, speed: pos.coords.speed ?? null })
    })
    return () => { void geo.g.clearWatch({ id }) }
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix({ at: [pos.coords.latitude, pos.coords.longitude], accuracy: pos.coords.accuracy, heading: pos.coords.heading, speed: pos.coords.speed }),
    onError,
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 2000 }
  )
  return () => navigator.geolocation.clearWatch(id)
}

/** her place once (to search near her and to start from) */
export async function hereOnce(): Promise<LatLon | null> {
  return new Promise((done) => {
    let stop: (() => void) | null = null
    let found = false
    const end = (at: LatLon | null) => {
      if (found) return
      found = true
      clearTimeout(timer)
      stop?.()
      done(at)
    }
    const timer = setTimeout(() => end(null), 15_000)
    // (a place can come before the watch is known: it is stopped as soon as it is)
    void follow((f) => end(f.at), () => undefined).then((s) => { stop = s; if (found) s() }).catch(() => end(null))
  })
}
