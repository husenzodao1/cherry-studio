/**
 * Mahliyo's files made on the phone from what she wrote: a PDF, a Word document, a PowerPoint
 * presentation, or a text file as it is. The big makers load only when a file is made.
 */
import { fileType } from '@/lib/aiFiles'
import type { SlideLook } from '@/lib/slideStyles'

export interface FileSpec { name: string; title: string; content: string; style?: string; look?: SlideLook }

/** The file as bytes, ready to save or share. */
export async function buildFile(f: FileSpec): Promise<Blob> {
  const type = fileType(f.name)
  if (!type || type.kind === 'text') return new Blob([f.content], { type: `${type?.mime ?? 'text/plain'};charset=utf-8` })
  const made = type.kind === 'pdf' ? await (await import('./pdf')).makePdf(f)
    : type.kind === 'docx' ? await (await import('./docx')).makeDocx(f)
    : await (await import('./pptx')).makePptx(f)
  // the file's own type (the makers may say "zip", and the phone would then save a .zip)
  return new Blob([made], { type: type.mime })
}

/** The file written to the app's cache on the phone (its address), to share or open. */
async function cached(name: string, blob: Blob): Promise<string> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { uri } = await Filesystem.writeFile({ path: name, data: await base64Of(blob), directory: Directory.Cache })
  return uri
}

/**
 * The file opened in another app: on the phone, it asks which one ("Open with…"); in the browser, a new
 * tab (PDF and text show there; Word and PowerPoint are downloaded by it).
 */
export async function openFile(name: string, blob: Blob, title: string): Promise<'opened' | 'no_app'> {
  const { Capacitor, registerPlugin } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const opener = registerPlugin<{ open(o: { path: string; mime: string; title: string }): Promise<void> }>('FileOpener')
    try {
      await opener.open({ path: await cached(name, blob), mime: blob.type || 'application/octet-stream', title })
      return 'opened'
    } catch (e) {
      return (e as { code?: string })?.code === 'NO_APP' ? 'no_app' : 'opened'
    }
  }
  const url = URL.createObjectURL(blob)
  const tab = window.open(url, '_blank')
  if (!tab) await saveFile(name, blob, title)
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'opened'
}

/** The file saved: on the phone, through its share sheet (to Files, a messenger…); in the browser, downloaded. */
export async function saveFile(name: string, blob: Blob, title: string): Promise<void> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    const uri = await cached(name, blob)
    await Share.share({ title, files: [uri], dialogTitle: title }).catch(() => undefined)
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** the app's colours in the files */
export const INK = '#2a1d4a'
export const PLUM = '#5b3fd6'
export const LILAC = '#8b6cf0'
export const SOFT = '#f3eeff'
export const GREY = '#6b6480'
