import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { useSyncExternalStore } from 'react'

/**
 * Mahliyo calls: at a reminder's time she "phones" the learner — a call screen rings (web/components/
 * MahliyoCall.tsx), and taken, it plays one of her recorded lines on a phone line. The reminders she set
 * are kept here; a reminder whose time has come (within the last 10 minutes: the app may have been
 * opened from its notification) rings once.
 * In the phone app the call is also planned natively (MahliyoCall.java): it rings at its time even with the
 * app closed and the phone locked — an incoming-call notification over the lock screen; answered there, the
 * app opens straight into the call.
 */

export interface PlannedCall { id: number; at: string; title: string; text: string; rung?: boolean }
export interface CallInfo { title: string; text: string; answered?: boolean }

interface NativeCalls {
  plan(o: { id: number; at: number; title: string; text: string }): Promise<void>
  cancel(o: { id: number }): Promise<void>
  /** the call the app was opened by (once), and the calls that rang natively (once) */
  taken(): Promise<{ opened?: NativeOpened; rang?: number[] }>
  stop(): Promise<void>
  done(): Promise<void>
  /** her words on the call line: the earpiece, or the speaker */
  voice(o: { src: string; speaker: boolean }): Promise<void>
  speaker(o: { on: boolean }): Promise<void>
  hush(): Promise<void>
  /** whether her call may cover the lock screen (Android 14+ asks the learner) */
  canFullScreen(): Promise<{ granted: boolean }>
  askFullScreen(): Promise<void>
  addListener(event: 'opened', f: (c: NativeOpened) => void): Promise<PluginListenerHandle>
  addListener(event: 'voiceEnded', f: () => void): Promise<PluginListenerHandle>
}
interface NativeOpened { call: { id: number; title: string; text: string }; answered: boolean }
const Native = registerPlugin<NativeCalls>('MahliyoCall')
const native = () => Capacitor.isNativePlatform()

const KEY = 'dk.ai-calls'
/** a reminder older than this has gone by: no call */
const LATE = 10 * 60_000

function read(): PlannedCall[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]') as PlannedCall[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
function write(list: PlannedCall[]) {
  try {
    // the ones long gone are forgotten
    localStorage.setItem(KEY, JSON.stringify(list.filter((c) => Date.parse(c.at) > Date.now() - 24 * 3600_000).slice(-50)))
  } catch { /* storage blocked: no calls */ }
}

/** A reminder she set: she calls at its time. */
export function planCall(c: Omit<PlannedCall, 'rung'>) {
  write([...read().filter((x) => x.id !== c.id), c])
  if (native()) void Native.plan({ id: c.id, at: Date.parse(c.at), title: c.title, text: c.text }).catch(() => undefined)
}
/** A reminder taken back: no call. */
export function unplanCall(id: number) {
  write(read().filter((x) => x.id !== id))
  if (native()) void Native.cancel({ id }).catch(() => undefined)
}
/** The reminder whose call is due now (not rung yet), if any. */
export function dueCall(now = Date.now()): PlannedCall | null {
  return read().find((c) => !c.rung && Date.parse(c.at) <= now && now - Date.parse(c.at) < LATE) ?? null
}
export function markRung(id: number) {
  write(read().map((c) => (c.id === id ? { ...c, rung: true } : c)))
}

/* the call on the screen now */
let current: CallInfo | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const l of listeners) l() }

/** She calls now (her own screen: a notification still ringing for it stops). */
export function ring(info: CallInfo) {
  if (current) return
  current = info
  if (native()) void Native.stop().catch(() => undefined)
  emit()
}
/** The call is over (taken and ended, or declined). */
export function hangUp() {
  current = null
  if (native()) void Native.done().catch(() => undefined)
  emit()
}

/**
 * The phone app: a call that rang natively is not rung again here; the call the app was opened by (from
 * its notification) rings here — straight into the conversation when it was answered there.
 */
export async function takeNative() {
  if (!native()) return
  const { opened, rang } = await Native.taken().catch(() => ({ opened: undefined, rang: [] as number[] }))
  for (const id of rang ?? []) markRung(id)
  if (opened) openedNatively(opened)
}
function openedNatively(o: NativeOpened) {
  markRung(o.call.id)
  ring({ title: o.call.title, text: o.call.text, answered: o.answered })
}
/** The app, already open, is brought up by her call. */
export function onNativeCall(): () => void {
  if (!native()) return () => undefined
  let handle: PluginListenerHandle | null = null
  void Native.addListener('opened', openedNatively).then((h) => { handle = h })
  return () => { void handle?.remove() }
}
export function useCall(): CallInfo | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => current, () => null)
}

/** Whether her call may cover the lock screen like a real call (always, outside the phone app). */
export async function lockScreenAllowed(): Promise<boolean> {
  if (!native()) return true
  return (await Native.canFullScreen().catch(() => ({ granted: true }))).granted
}
/** Opens the phone's setting that lets her call cover the lock screen. */
export function allowLockScreen() {
  if (native()) void Native.askFullScreen().catch(() => undefined)
}

/**
 * The call line: her recorded words, first from the earpiece at the top of the phone (as a real call),
 * from the speaker when it is turned on. In the browser, the earpiece is her voice played quietly.
 */
export interface CallLine {
  play(src: string, ended: () => void): Promise<void>
  speaker(on: boolean): void
  stop(): void
}
const EARPIECE_VOLUME = 0.3
export function callLine(): CallLine {
  let loud = false
  if (native()) {
    let handle: PluginListenerHandle | null = null
    return {
      async play(src, ended) {
        await handle?.remove()
        handle = await Native.addListener('voiceEnded', ended)
        await Native.voice({ src, speaker: loud })
      },
      speaker(on) { loud = on; void Native.speaker({ on }).catch(() => undefined) },
      stop() { void handle?.remove(); void Native.hush().catch(() => undefined) }
    }
  }
  let audio: HTMLAudioElement | null = null
  return {
    async play(src, ended) {
      audio?.pause()
      audio = new Audio(src)
      audio.volume = loud ? 1 : EARPIECE_VOLUME
      audio.onended = ended
      audio.onerror = ended
      await audio.play()
    },
    speaker(on) { loud = on; if (audio) audio.volume = on ? 1 : EARPIECE_VOLUME },
    stop() { audio?.pause(); audio = null }
  }
}
