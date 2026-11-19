import { useSyncExternalStore } from 'react'

/**
 * The learner's profile photo. It stays on this phone only (never sent to the server): a square JPEG
 * cut in the photo editor (PhotoEditor.tsx), or from the middle of a Google photo, kept in local storage.
 */
const KEY = 'dk.photo'
const EVENT = 'dk-photo'

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Keeps a ready picture (a data URL cut in the photo editor). */
export const writePhoto = (value: string) => write(value)

function write(value: string | null) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    /* storage full or blocked: the letter avatar stays */
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function usePhoto(): string | null {
  return useSyncExternalStore(subscribe, read, () => null)
}

/** Crops the middle square of a picture, scales it to 256 px and keeps it. */
export async function savePhoto(file: File): Promise<boolean> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    if (!side) return false
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256)
    write(canvas.toDataURL('image/jpeg', 0.86))
    return true
  } catch {
    return false
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const clearPhoto = () => write(null)
