'use client'

import { createStore, get, keys, set } from 'idb-keyval'
import { useEffect, useState } from 'react'

/**
 * Lesson images kept on the phone, so lessons look complete without a connection. Files live in their
 * own IndexedDB store keyed by URL (a replaced asset gets a new URL, so stale copies are never shown).
 * Shown images are saved on first view; after each content update the rest are fetched in the
 * background, up to a size budget.
 */

const store = typeof indexedDB === 'undefined' ? undefined : createStore('dk-media', 'files')
const BUDGET_BYTES = 150 * 1024 * 1024
const objectUrls = new Map<string, string>()

async function save(url: string): Promise<Blob | null> {
  if (!store) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    await set(url, blob, store)
    return blob
  } catch {
    return null
  }
}

/** `src` for an image: the phone's copy when there is one, otherwise the network (and keep a copy). */
export function useOfflineSrc(url?: string | null): string | undefined {
  const [src, setSrc] = useState<string | undefined>(() => (url ? objectUrls.get(url) : undefined))
  useEffect(() => {
    if (!url || !store) {
      setSrc(url ?? undefined)
      return
    }
    let alive = true
    const known = objectUrls.get(url)
    if (known) {
      setSrc(known)
      return
    }
    get<Blob>(url, store)
      .then(async (blob) => {
        if (!blob && navigator.onLine !== false) {
          if (alive) setSrc(url)
          blob = (await save(url)) ?? undefined
          return
        }
        if (blob && alive) {
          const local = URL.createObjectURL(blob)
          objectUrls.set(url, local)
          setSrc(local)
        }
      })
      .catch(() => alive && setSrc(url))
    return () => {
      alive = false
    }
  }, [url])
  return src
}

/** Background download of every image the content uses, skipping files already on the phone. */
export async function prefetchMedia(urls: string[]): Promise<void> {
  if (!store || navigator.onLine === false) return
  const have = new Set((await keys(store).catch(() => [])) as string[])
  let used = 0
  for (const url of urls) {
    if (have.has(url)) continue
    const blob = await save(url)
    if (!blob) continue
    used += blob.size
    if (used > BUDGET_BYTES) break
  }
}

/** Image URLs in a content bundle (lesson assets, school icons, achievement icons, quiz media). */
export function bundleImageUrls(value: unknown, out = new Set<string>()): string[] {
  if (Array.isArray(value)) value.forEach((v) => bundleImageUrls(v, out))
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.url === 'string' && (o.kind === 'image' || o.kind === undefined) && /^https:/.test(o.url) && !o.protected) out.add(o.url)
    Object.values(o).forEach((v) => bundleImageUrls(v, out))
  }
  return [...out]
}

/** Every downloadable file a course's lessons use (pictures, audio, attached files; YouTube streams stay online). */
export function courseMediaUrls(lessons: { assets: Record<string, { url: string | null; kind: string; protected?: boolean }> }[]): string[] {
  const out = new Set<string>()
  for (const l of lessons) for (const a of Object.values(l.assets)) {
    if (a.url && /^https:/.test(a.url) && !a.protected && ['image', 'audio', 'file'].includes(a.kind)) out.add(a.url)
  }
  return [...out]
}

/** How many of these files are already on the phone. */
export async function storedCount(urls: string[]): Promise<number> {
  if (!store || !urls.length) return 0
  const have = new Set((await keys(store).catch(() => [])) as string[])
  return urls.filter((u) => have.has(u)).length
}

/** Downloads the files that are missing, reporting progress; returns how many are on the phone at the end. */
export async function downloadAll(urls: string[], onProgress: (done: number, total: number) => void): Promise<number> {
  if (!store) return 0
  const have = new Set((await keys(store).catch(() => [])) as string[])
  let done = urls.filter((u) => have.has(u)).length
  onProgress(done, urls.length)
  for (const url of urls) {
    if (have.has(url)) continue
    if (await save(url)) done++
    onProgress(done, urls.length)
  }
  return done
}

/** True when the phone is on mobile data (where the browser can tell). */
export function onMobileData(): boolean {
  const c = (navigator as Navigator & { connection?: { type?: string } }).connection
  return c?.type === 'cellular'
}
