'use client'

import { apiUrl } from './offline/base'

/**
 * Self-healing for errors on the phone or in the browser. When a screen breaks, the app does not show
 * an error page at once; it climbs a short ladder and stops at the first step that works:
 *   1. draw the broken screen again (React reset) — enough for passing state glitches;
 *   2. reload the page — fixes code left stale by a new release, a lost chunk, a DOM disturbed from outside
 *      (translation tools, browser extensions);
 *   3. go to the home screen — leaves a page whose own data is broken;
 *   4. only then a calm screen with "try again" and "home" buttons.
 * Every step is counted in sessionStorage, so a page that breaks again and again can never loop; the count
 * forgets itself after a minute of calm. Each error is reported (no personal data) to the server log, so
 * it can be fixed at the source.
 */

const KEY = 'dk.heal'
const CALM_MS = 60_000

export type HealStep = 'reset' | 'reload' | 'home' | 'give_up'

interface Ladder { n: number; at: number }

function read(now: number): Ladder {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Ladder | null
    return v && now - v.at < CALM_MS ? v : { n: 0, at: now }
  } catch {
    return { n: 0, at: now }
  }
}

/** The next step for an error now (and records it). Pure apart from sessionStorage: tested in tests/unit. */
export function nextStep(now = Date.now(), path = '/'): HealStep {
  const cur = read(now)
  const n = cur.n + 1
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ n, at: now }))
  } catch {
    /* storage blocked: the steps still run, once each per page load */
  }
  if (n === 1) return 'reset'
  if (n === 2) return 'reload'
  if (n === 3 && path !== '/') return 'home'
  return 'give_up'
}

/** Code that a new release has replaced: the page must be reloaded to get the current files. */
export const isStaleCode = (msg: string) =>
  /ChunkLoadError|Loading chunk|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)

let lastReport = ''
/** Sends what broke (message, where, version) to the server log. Never personal data. */
export function report(error: unknown, where: string): void {
  const e = error as { message?: string; stack?: string; digest?: string } | null
  const message = String(e?.message ?? error ?? '').slice(0, 500)
  const sig = `${where}:${message}`
  if (!message || sig === lastReport) return
  lastReport = sig
  const body = JSON.stringify({
    message, where: where.slice(0, 40), path: location.pathname.slice(0, 200), stack: String(e?.stack ?? '').slice(0, 1500),
    version: process.env.NEXT_PUBLIC_APP_VERSION_NAME ?? 'web', agent: navigator.userAgent.slice(0, 200)
  })
  try {
    const url = apiUrl('/client-error')
    if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) {
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined)
    }
  } catch {
    /* reporting must never break anything */
  }
}

/** Carries out a step that leaves the page (reload or home). */
export function leave(step: HealStep): void {
  if (step === 'reload') location.reload()
  else if (step === 'home') location.replace('/')
}

/**
 * Errors outside React's screens: stale release code is fixed by one reload (at most once a minute);
 * everything is reported.
 */
export function installGlobalHealing(): () => void {
  const onError = (msg: string, err: unknown) => {
    report(err ?? msg, 'window')
    if (isStaleCode(msg)) {
      const step = nextStep(Date.now(), location.pathname)
      if (step === 'reset' || step === 'reload') location.reload()
    }
  }
  const error = (e: ErrorEvent) => onError(String(e.message ?? ''), e.error)
  const rejection = (e: PromiseRejectionEvent) => onError(String((e.reason as Error)?.message ?? e.reason ?? ''), e.reason)
  window.addEventListener('error', error)
  window.addEventListener('unhandledrejection', rejection)
  return () => {
    window.removeEventListener('error', error)
    window.removeEventListener('unhandledrejection', rejection)
  }
}
