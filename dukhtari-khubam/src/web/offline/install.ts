'use client'

import type { Bundle } from './content'
import { bundleImageUrls, courseMediaUrls, downloadAll, storedCount } from './media'

/**
 * "Install for offline": the texts of every lesson are already on the phone (the content bundle); this
 * keeps every picture, audio and file the lessons use, so the newest lessons open fully without a
 * connection. The phone is asked to keep this storage for good (navigator.storage.persist), so it is
 * not cleared between launches. Once installed, content updates bring their new files in by themselves.
 */
const KEY = 'dk.install'

interface Stored { version: string; at: string }

function read(): Stored | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

/** Every file the published lessons and the catalogue use. */
export function installUrls(bundle: Bundle): string[] {
  return [...new Set([...courseMediaUrls(Object.values(bundle.lessons)), ...bundleImageUrls(bundle)])]
}

/** Whether the phone has every file of this catalogue (and the install was asked for). */
export async function installState(bundle: Bundle): Promise<{ installed: boolean; have: number; total: number; chosen: boolean }> {
  const urls = installUrls(bundle)
  const have = await storedCount(urls)
  const chosen = read() !== null
  return { installed: chosen && have >= urls.length, have, total: urls.length, chosen }
}

export async function keepStorage(): Promise<void> {
  try {
    if (!(await navigator.storage?.persisted?.())) await navigator.storage?.persist?.()
  } catch {
    /* the browser decides */
  }
}

/** Downloads what is missing; true when every file is on the phone at the end. */
export async function installAll(bundle: Bundle, onProgress?: (done: number, total: number) => void): Promise<boolean> {
  await keepStorage()
  const urls = installUrls(bundle)
  const done = await downloadAll(urls, (d, t) => onProgress?.(d, t))
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: bundle.version, at: new Date().toISOString() } satisfies Stored))
  } catch {
    /* storage blocked */
  }
  return done >= urls.length
}

/** After a content update: an installed phone fetches the new files quietly. */
export async function keepInstalledFresh(bundle: Bundle): Promise<void> {
  const stored = read()
  if (!stored || stored.version === bundle.version || navigator.onLine === false) return
  await installAll(bundle)
}
