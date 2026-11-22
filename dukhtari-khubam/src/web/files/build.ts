/**
 * Mahliyo's files made on the phone from what she wrote: a PDF, a Word document, a PowerPoint
 * presentation, or a text file as it is. The big makers load only when a file is made.
 */
import { fileType } from '@/lib/aiFiles'

export interface FileSpec { name: string; title: string; content: string; style?: string }

/** The file as bytes, ready to save or share. */
export async function buildFile(f: FileSpec): Promise<Blob> {
  const type = fileType(f.name)
  if (!type || type.kind === 'text') return new Blob([f.content], { type: `${type?.mime ?? 'text/plain'};charset=utf-8` })
  if (type.kind === 'pdf') return (await import('./pdf')).makePdf(f)
  if (type.kind === 'docx') return (await import('./docx')).makeDocx(f)
  return (await import('./pptx')).makePptx(f)
}

/** The file saved: on the phone, through its share sheet (to Files, a messenger…); in the browser, downloaded. */
export async function saveFile(name: string, blob: Blob, title: string): Promise<void> {
  const { Capacitor } = await import('@capacitor/core')
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const data = await base64Of(blob)
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
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
