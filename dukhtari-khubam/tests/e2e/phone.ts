import type { Page } from '@playwright/test'

/**
 * The page as the phone app with a fake HeyMahliyo plugin: the test says what the phone "hears" next
 * (window.__hear), and reads what was spoken, set and called (window.__hey).
 */
export async function asPhone(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>
    const state = { models: false, enrolled: false, enabled: false, running: false, mic: false, overlay: true }
    const log: { said: string[]; timers: number[]; calls: string[]; prints: number; started: boolean } = { said: [], timers: [], calls: [], prints: 0, started: false }
    const hear: string[] = []
    const listeners: Record<string, ((e: unknown) => void)[]> = {}
    w.__hey = log
    w.__hear = hear
    w.androidBridge = {}
    const header = { name: '', methods: { find: () => ({ name: '', rtype: 'promise' }) } }
    const emit = (ev: string, e: unknown) => (listeners[ev] ?? []).forEach((f) => f(e))
    w.Capacitor = {
      PluginHeaders: { find: () => header },
      nativeCallback: (plugin: string, method: string, opts: { eventName?: string }, cb: (e: unknown) => void) => {
        if (method === 'addListener' && opts?.eventName) (listeners[opts.eventName] ??= []).push(cb)
        return String(Math.random())
      },
      nativePromise: async (plugin: string, method: string, o: Record<string, unknown>) => {
        const key = `${plugin}.${method}`
        if (method === 'addListener') { return { remove: async () => undefined } }
        if (key === 'HeyMahliyo.state') return { ...state }
        if (key === 'HeyMahliyo.prepare') { emit('progress', { part: 'tg', done: 30_000_000, total: 51_879_043 }); state.models = true; return { models: true } }
        if (key === 'HeyMahliyo.askMic') { state.mic = true; return { ...state } }
        if (key === 'HeyMahliyo.listen') {
          const text = hear.shift() ?? ''
          emit('partial', { text: text.split(' ').slice(0, 2).join(' ') })
          await new Promise((r) => setTimeout(r, 150))
          return { text, spk: text ? Array.from({ length: 128 }, (_, i) => Math.sin(i)) : null, ...(o.audio && text ? { wav: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=' } : {}) }
        }
        if (key === 'HeyMahliyo.saveVoice') { log.prints = (o.prints as unknown[]).length; state.enrolled = true; return { threshold: 0.5, least: 0.7 } }
        if (key === 'HeyMahliyo.start') { log.started = true; state.enabled = true; state.running = true; return {} }
        if (key === 'HeyMahliyo.speak') { log.said.push(String(o.text)); return {} }
        if (key === 'HeyMahliyo.setTimer') { log.timers.push(Number(o.seconds)); return {} }
        if (key === 'HeyMahliyo.askCalls') return { granted: true }
        if (key === 'HeyMahliyo.contacts') return { contacts: [{ name: 'Малика Каримова', number: '+992900000001' }, { name: 'Шахноза', number: '+992900000002' }, { name: 'Мама', number: '+992900000003' }] }
        if (key === 'HeyMahliyo.callNumber') { log.calls.push(String(o.number)); return {} }
        if (key === 'HeyMahliyo.takeWake') return { woke: false }
        if (key === 'LocalNotifications.checkPermissions') return { display: 'granted' }
        if (key === 'MahliyoCall.canFullScreen') return { granted: true }
        if (key === 'DkPlace.state') return { place: 'granted', services: true }
        if (key === 'LocalNotifications.getPending') return { notifications: [] }
        if (key === 'MahliyoCall.taken') return { rang: [] }
        return {}
      }
    }
  })
}

