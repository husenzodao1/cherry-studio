import { describe, expect, it } from 'vitest'

import { base64Pcm16, frameChange, pcm16Base64, resample } from '@/web/live/pcm'

describe('sound and pictures for the live voice', () => {
  it('PCM there and back', () => {
    const s = new Float32Array([0, 0.5, -0.5, 1, -1])
    const back = base64Pcm16(pcm16Base64(s))
    for (let i = 0; i < s.length; i++) expect(back[i]).toBeCloseTo(s[i], 3)
  })
  it('48 kHz to 16 kHz: a third as many samples', () => {
    expect(resample(new Float32Array(4800), 48000, 16000)).toHaveLength(1600)
  })
  it('a picture that did not change is not sent again', () => {
    const a = new Uint8ClampedArray(16).fill(100)
    expect(frameChange(a, a)).toBe(0)
    expect(frameChange(a, new Uint8ClampedArray(16).fill(200))).toBeGreaterThan(0.3)
  })
})
