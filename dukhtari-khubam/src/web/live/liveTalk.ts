'use client'

import { api, ApiFailure } from '../api'
import { base64Pcm16, frameChange, MIC_WORKLET, pcm16Base64, resample } from './pcm'

/**
 * A live voice conversation with Mahliyo (Gemini Live), from the phone. The server gives a one-use token for
 * each two-minute part; a part about to end hands the conversation to the next one by its resumption handle,
 * so she never notices. The microphone goes out as 16 kHz PCM; her voice comes back as 24 kHz PCM and plays in
 * order (stopped at once when she is interrupted); what each says is written as it is said. The camera, when
 * on, sends a frame a second only when the picture changed, and a sharp still photo when asked. Her tool calls
 * (a timer, a call, a song…) are done by the app and answered.
 */

export type LiveState = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error'
export interface LiveOptions {
  lang: string
  mode: 'assistant' | 'camera' | 'coach'
  scenario?: 'ielts' | 'english' | 'russian' | 'interview'
  name?: string
  me?: string
  boy?: boolean
  onState: (s: LiveState) => void
  /** her words and Mahliyo's, as they are said (whole turns are marked done) */
  onHeard: (text: string, done: boolean) => void
  onSaid: (text: string, done: boolean) => void
  /** a tool she asked for; its result goes back to Mahliyo */
  onTool: (name: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>
  /** her month's minutes are spent (the plans), or the live voice is not there (another way is used) */
  onLimit: () => void
  onUnavailable: () => void
}

interface Session {
  sendRealtimeInput(p: { audio?: { data: string; mimeType: string }; video?: { data: string; mimeType: string } }): void
  sendToolResponse(p: { functionResponses: { id?: string; name?: string; response: Record<string, unknown> }[] }): void
  close(): void
}
interface ServerMessage {
  serverContent?: { modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] }; interrupted?: boolean; turnComplete?: boolean
    inputTranscription?: { text?: string; finished?: boolean }; outputTranscription?: { text?: string; finished?: boolean } }
  toolCall?: { functionCalls?: { id?: string; name?: string; args?: Record<string, unknown> }[] }
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean }
  goAway?: { timeLeft?: string }
}
interface Part { token: string; model: string; seconds: number; minutesLeft: number }

/** a test may give its own connection (window.__dkLive) */
type Connect = (token: string, model: string, on: { message: (m: ServerMessage) => void; close: () => void; error: () => void }) => Promise<Session>
const connectGemini: Connect = async (token, model, on) => {
  const seam = (window as unknown as { __dkLive?: Connect }).__dkLive
  if (seam) return seam(token, model, on)
  const { GoogleGenAI, Modality } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: 'v1alpha' } })
  return ai.live.connect({
    model,
    // the settings are the token's (locked on the server)
    config: { responseModalities: [Modality.AUDIO] },
    callbacks: { onmessage: (m) => on.message(m as ServerMessage), onclose: () => on.close(), onerror: () => on.error() }
  }) as unknown as Promise<Session>
}

export class LiveTalk {
  private session: Session | null = null
  private handle: string | undefined
  private rotate: ReturnType<typeof setTimeout> | null = null
  private ended = false
  private mic: MediaStream | null = null
  private micCtx: AudioContext | null = null
  private outCtx: AudioContext | null = null
  private playAt = 0
  private playing = new Set<AudioBufferSourceNode>()
  private heard = ''
  private said = ''
  private cam: { stream: MediaStream; video: HTMLVideoElement; timer: ReturnType<typeof setInterval>; last: Uint8ClampedArray | null; sentAt: number } | null = null

  constructor(private o: LiveOptions) {}

  async start() {
    this.o.onState('connecting')
    try {
      await this.openPart()
      await this.startMic()
      this.o.onState('listening')
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 402) this.o.onLimit()
      else if (e instanceof ApiFailure && e.status === 503) this.o.onUnavailable()
      else { console.warn('[live] could not start:', e instanceof Error ? e.message : String(e)); this.o.onState('error') }
      this.stop(false)
    }
  }

  /** a two-minute part: its token from the server, the connection, the next part planned before it ends */
  private async openPart() {
    const part = await api<Part>('/voice/live', { method: 'POST', body: {
      lang: this.o.lang, mode: this.o.mode, ...(this.o.scenario ? { scenario: this.o.scenario } : {}),
      ...(this.o.name ? { name: this.o.name } : {}), ...(this.o.me ? { me: this.o.me.slice(0, 4000) } : {}),
      now: new Date().toString().slice(0, 40), boy: !!this.o.boy, ...(this.handle ? { handle: this.handle } : {})
    } })
    const old = this.session
    this.session = await connectGemini(part.token, part.model, {
      message: (m) => this.onMessage(m),
      close: () => { if (!this.ended && this.session && !this.rotate) this.o.onState('ended') },
      error: () => { if (!this.ended) this.o.onState('error') }
    })
    old?.close()
    if (this.rotate) clearTimeout(this.rotate)
    // the next part 15 seconds before this one ends (or when Google says it is going away)
    this.rotate = setTimeout(() => void this.next(), Math.max(20, part.seconds - 15) * 1000)
  }

  private async next() {
    this.rotate = null
    if (this.ended) return
    try {
      await this.openPart()
    } catch (e) {
      if (e instanceof ApiFailure && e.status === 402) this.o.onLimit()
      this.stop()
    }
  }

  private onMessage(m: ServerMessage) {
    if (m.sessionResumptionUpdate?.resumable && m.sessionResumptionUpdate.newHandle) this.handle = m.sessionResumptionUpdate.newHandle
    if (m.goAway && !this.ended) { if (this.rotate) clearTimeout(this.rotate); void this.next() }
    const c = m.serverContent
    if (c?.interrupted) this.hush()
    if (c?.inputTranscription?.text) { this.heard += c.inputTranscription.text; this.o.onHeard(this.heard.trim(), false) }
    if (c?.outputTranscription?.text) { this.said += c.outputTranscription.text; this.o.onSaid(this.said.trim(), false) }
    for (const p of c?.modelTurn?.parts ?? []) {
      if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('audio/')) this.play(p.inlineData.data, Number(/rate=(\d+)/.exec(p.inlineData.mimeType)?.[1] ?? 24000))
    }
    if (c?.turnComplete) {
      if (this.heard) this.o.onHeard(this.heard.trim(), true)
      if (this.said) this.o.onSaid(this.said.trim(), true)
      this.heard = ''
      this.said = ''
    }
    for (const f of m.toolCall?.functionCalls ?? []) void this.tool(f)
  }

  private async tool(f: { id?: string; name?: string; args?: Record<string, unknown> }) {
    if (f.name === 'end_conversation') {
      this.session?.sendToolResponse({ functionResponses: [{ id: f.id, name: f.name, response: { result: 'ok' } }] })
      setTimeout(() => this.stop(), 2500)
      return
    }
    let result: Record<string, unknown>
    try { result = await this.o.onTool(f.name ?? '', f.args ?? {}) } catch (e) { result = { error: e instanceof Error ? e.message : 'failed' } }
    this.session?.sendToolResponse({ functionResponses: [{ id: f.id, name: f.name, response: result }] })
  }

  /** the microphone, 100 ms at a time, as 16 kHz PCM */
  private async startMic() {
    this.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
    const ctx = new AudioContext()
    this.micCtx = ctx
    const url = URL.createObjectURL(new Blob([MIC_WORKLET], { type: 'application/javascript' }))
    await ctx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    const node = new AudioWorkletNode(ctx, 'dk-mic')
    node.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (!this.session || this.ended) return
      this.session.sendRealtimeInput({ audio: { data: pcm16Base64(resample(e.data, ctx.sampleRate, 16000)), mimeType: 'audio/pcm;rate=16000' } })
    }
    ctx.createMediaStreamSource(this.mic).connect(node)
  }

  private play(data: string, rate: number) {
    this.outCtx ??= new AudioContext({ sampleRate: 24000 })
    const ctx = this.outCtx
    const samples = base64Pcm16(data)
    const buf = ctx.createBuffer(1, samples.length, rate)
    buf.copyToChannel(samples as Float32Array<ArrayBuffer>, 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    this.playAt = Math.max(this.playAt, ctx.currentTime + 0.02)
    src.start(this.playAt)
    this.playAt += buf.duration
    this.playing.add(src)
    this.o.onState('speaking')
    src.onended = () => {
      this.playing.delete(src)
      if (!this.playing.size && !this.ended) this.o.onState('listening')
    }
  }

  /** she spoke over Mahliyo: her voice stops at once */
  private hush() {
    for (const s of this.playing) { try { s.stop() } catch { /* ended */ } }
    this.playing.clear()
    this.playAt = 0
    if (!this.ended) this.o.onState('listening')
  }

  /** the camera on (the back one): a frame a second, only when the picture changed (and every 5 s at least) */
  async cameraOn(video: HTMLVideoElement) {
    if (this.cam) return
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
    video.srcObject = stream
    await video.play().catch(() => undefined)
    const small = document.createElement('canvas')
    small.width = 32
    small.height = 18
    const sctx = small.getContext('2d', { willReadFrequently: true })!
    const timer = setInterval(() => {
      if (!this.cam || !this.session || !video.videoWidth) return
      sctx.drawImage(video, 0, 0, 32, 18)
      const now = sctx.getImageData(0, 0, 32, 18).data
      const changed = !this.cam.last || frameChange(this.cam.last, now) > 0.04 || Date.now() - this.cam.sentAt > 5000
      this.cam.last = now
      if (!changed) return
      this.cam.sentAt = Date.now()
      this.session.sendRealtimeInput({ video: { data: this.frame(video, 768, 0.6), mimeType: 'image/jpeg' } })
    }, 1000)
    this.cam = { stream, video, timer, last: null, sentAt: 0 }
  }

  /** a sharp still photo of what the camera shows (to read handwriting and small text) */
  still() {
    if (!this.cam || !this.session) return
    this.session.sendRealtimeInput({ video: { data: this.frame(this.cam.video, 1600, 0.85), mimeType: 'image/jpeg' } })
  }

  cameraOff() {
    if (!this.cam) return
    clearInterval(this.cam.timer)
    this.cam.stream.getTracks().forEach((t) => t.stop())
    this.cam.video.srcObject = null
    this.cam = null
  }

  private frame(video: HTMLVideoElement, max: number, quality: number): string {
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(video.videoWidth * scale)
    c.height = Math.round(video.videoHeight * scale)
    c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', quality).split(',')[1]
  }

  stop(announce = true) {
    if (this.ended) return
    this.ended = true
    if (this.rotate) clearTimeout(this.rotate)
    this.cameraOff()
    this.hush()
    this.mic?.getTracks().forEach((t) => t.stop())
    void this.micCtx?.close().catch(() => undefined)
    void this.outCtx?.close().catch(() => undefined)
    this.session?.close()
    this.session = null
    if (announce) this.o.onState('ended')
  }
}
