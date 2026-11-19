'use client'

import { Capacitor } from '@capacitor/core'

import { formatCode } from '@/lib/progress'

import { ART } from '../art'

/**
 * Pictures made on the phone and saved or shared as PNG: the course certificate and the personal code
 * card (so the 15-digit code lives in the gallery, not only in memory). Drawn on a canvas with the
 * app's fonts and rendered glass art; nothing is sent to a server.
 */

const W = 1080
const H = 1350

/** Font family behind a next/font CSS variable, loaded before drawing. */
async function font(variable: string, fallback: string, sample: string) {
  const family = getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback
  await document.fonts.load(`48px ${family}`, sample).catch(() => undefined)
  return family
}

function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function backdrop(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#f6f1fe')
  g.addColorStop(0.55, '#e9dffb')
  g.addColorStop(1, '#d8c9f4')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.08, 10, W * 0.82, H * 0.08, 520)
  glow.addColorStop(0, 'rgba(255,255,255,0.9)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
}

function frame(ctx: CanvasRenderingContext2D) {
  ctx.save()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#d4a85a'
  ctx.beginPath(); ctx.roundRect(48, 48, W - 96, H - 96, 46); ctx.stroke()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(122, 79, 216, 0.55)'
  ctx.beginPath(); ctx.roundRect(70, 70, W - 140, H - 140, 34); ctx.stroke()
  ctx.restore()
}

function glassPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(86, 56, 160, 0.25)'
  ctx.shadowBlur = 40
  ctx.shadowOffsetY = 16
  const g = ctx.createLinearGradient(x, y, x + w, y + h)
  g.addColorStop(0, 'rgba(255,255,255,0.82)')
  g.addColorStop(1, 'rgba(255,255,255,0.5)')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 40); ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.restore()
}

/** Writes text centred, wrapping to at most `lines` lines and shrinking until it fits. */
function centred(ctx: CanvasRenderingContext2D, text: string, y: number, size: number, family: string, color: string, maxW = W - 220, lines = 2, weight = '') {
  let s = size
  let rows: string[] = []
  for (; s > 20; s -= 4) {
    ctx.font = `${weight} ${s}px ${family}`.trim()
    rows = []
    let line = ''
    for (const word of text.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxW && line) { rows.push(line); line = word } else line = test
    }
    if (line) rows.push(line)
    if (rows.length <= lines && rows.every((r) => ctx.measureText(r).width <= maxW)) break
  }
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  rows.forEach((r, i) => ctx.fillText(r, W / 2, y + i * s * 1.25))
  return y + (rows.length - 1) * s * 1.25
}

async function canvas() {
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  backdrop(ctx)
  return { c, ctx }
}

const blob = (c: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png'))

export interface CertificateText {
  heading: string; awardedTo: string; forCourse: string; brand: string
  name: string; course: string; school: string; date: string
}

export async function drawCertificate(t: CertificateText): Promise<Blob> {
  const [brand, ui, serif] = await Promise.all([
    font('--font-pacifico', 'cursive', t.name + t.brand),
    font('--font-geologica', 'sans-serif', t.course + t.school),
    font('--font-lora', 'serif', t.heading)
  ])
  const [flower, lotus, leaves, crystals] = await Promise.all([image(ART.flower.src), image(ART.lotus.src), image(ART.leaves.src), image(ART.crystals.src)])
  const { c, ctx } = await canvas()
  ctx.drawImage(leaves, -40, 760, 300, 385)
  ctx.drawImage(crystals, W - 210, 860, 190, 288)
  frame(ctx)
  glassPanel(ctx, 120, 330, W - 240, 760)
  ctx.drawImage(flower, W / 2 - 260, 70, 520, 335)
  centred(ctx, t.heading, 455, 76, serif, '#5b3a9e', W - 300, 1, 'italic 600')
  centred(ctx, t.awardedTo, 545, 34, ui, '#7a6d9e')
  centred(ctx, t.name, 655, 96, brand, '#6a3fc9', W - 320, 1)
  centred(ctx, t.forCourse, 755, 34, ui, '#7a6d9e')
  const end = centred(ctx, `«${t.course}»`, 835, 54, ui, '#2a1d4f', W - 320, 2, '600')
  centred(ctx, t.school, end + 80, 36, ui, '#5b3a9e')
  ctx.drawImage(lotus, W / 2 - 90, 990, 180, 148)
  centred(ctx, t.date, 1205, 32, ui, '#4a3c74')
  centred(ctx, t.brand, 1262, 40, brand, '#7a4fd8')
  return blob(c)
}

export interface CodeCardText { title: string; hint: string; brand: string; name: string; code: string }

export async function drawCodeCard(t: CodeCardText): Promise<Blob> {
  const [brand, ui] = await Promise.all([font('--font-pacifico', 'cursive', t.brand + t.name), font('--font-geologica', 'sans-serif', t.title + t.hint)])
  const [flower, bubble, petals] = await Promise.all([image(ART.flower.src), image(ART.bubble.src), image(ART.petals.src)])
  const { c, ctx } = await canvas()
  ctx.drawImage(bubble, W - 230, 120, 200, 200)
  ctx.drawImage(petals, 60, 1080, 320, 177)
  frame(ctx)
  ctx.drawImage(flower, W / 2 - 300, 110, 600, 386)
  centred(ctx, t.brand, 590, 84, brand, '#6a3fc9', W - 300, 1)
  centred(ctx, t.name, 680, 44, ui, '#4a3c74', W - 300, 1, '500')
  glassPanel(ctx, 140, 740, W - 280, 260)
  centred(ctx, t.title, 820, 36, ui, '#7a6d9e')
  centred(ctx, formatCode(t.code), 920, 84, ui, '#2a1d4f', W - 340, 1, '700')
  centred(ctx, t.hint, 1080, 32, ui, '#4a3c74', W - 300, 3)
  return blob(c)
}

const toBase64 = (b: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
  r.onerror = reject
  r.readAsDataURL(b)
})

/**
 * Saves or shares a picture: in the Android app through the system share sheet (save to gallery,
 * send to a chat…), in a browser through Web Share when it can carry files, otherwise as a download.
 */
export async function savePicture(b: Blob, fileName: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const written = await Filesystem.writeFile({ path: fileName, data: await toBase64(b), directory: Directory.Cache })
    await Share.share({ title, files: [written.uri] })
    return
  }
  const file = new File([b], fileName, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title, files: [file] }).catch(() => undefined)
    return
  }
  const url = URL.createObjectURL(b)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

interface GalleryPlugin { savePng(o: { data: string; fileName: string }): Promise<{ uri: string }> }
let gallery: GalleryPlugin | null = null

/**
 * Saves a picture straight into the phone's gallery without asking (Android app: Pictures/Духтари хубам,
 * through the app's own GallerySaver plugin); in a browser it is downloaded. True when it was saved.
 */
export async function savePictureToGallery(b: Blob, fileName: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      gallery ??= Capacitor.registerPlugin<GalleryPlugin>('GallerySaver')
      await gallery.savePng({ data: await toBase64(b), fileName })
      return true
    }
    const url = URL.createObjectURL(b)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
    return true
  } catch {
    return false
  }
}
