/**
 * Sound for Mahliyo's live voice: the microphone as 16 kHz 16-bit PCM (what Gemini Live hears), her voice as
 * 24 kHz PCM played in order, and a picture's change between camera frames.
 */

/** Float samples (−1…1) as little-endian 16-bit PCM, base64 */
export function pcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** base64 16-bit PCM as float samples */
export function base64Pcm16(data: string): Float32Array {
  const bin = atob(data)
  const n = bin.length >> 1
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8)
    if (v >= 0x8000) v -= 0x10000
    out[i] = v / 0x8000
  }
  return out
}

/** samples taken from one rate to another (linear), for a microphone that will not give 16 kHz itself */
export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio
    const a = Math.floor(x)
    const b = Math.min(a + 1, input.length - 1)
    out[i] = input[a] + (input[b] - input[a]) * (x - a)
  }
  return out
}

/** how different two small grey pictures are (0…1): a camera frame is sent only when the picture changed */
export function frameChange(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length || !a.length) return 1
  let sum = 0
  for (let i = 0; i < a.length; i += 4) sum += Math.abs((a[i] + a[i + 1] + a[i + 2]) - (b[i] + b[i + 1] + b[i + 2])) / 3
  return sum / (a.length / 4) / 255
}

/** the worklet that hands the microphone's samples over in 100 ms pieces */
export const MIC_WORKLET = `
class Mic extends AudioWorkletProcessor {
  constructor() { super(); this.buf = []; this.n = 0 }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) { this.buf.push(new Float32Array(ch)); this.n += ch.length }
    if (this.n >= sampleRate / 10) {
      const out = new Float32Array(this.n); let o = 0
      for (const b of this.buf) { out.set(b, o); o += b.length }
      this.port.postMessage(out, [out.buffer]); this.buf = []; this.n = 0
    }
    return true
  }
}
registerProcessor('dk-mic', Mic)
`
