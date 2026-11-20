import { describe, expect, it } from 'vitest'

import { emptyProgress, ProgressData } from '@/lib/progress'
import { pack, trim, unpack } from '@/lib/progressWire'

const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)

function busyLearner(): ProgressData {
  const p = emptyProgress()
  for (let i = 0; i < 120; i++) p.lessons[`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`] = { p: 100, done: '2026-05-01T10:00:00.000Z', at: '2026-05-01T10:00:00.000Z' }
  p.lessons['00000000-0000-4000-8000-999999999999'] = { p: 0, at: '2026-05-01T10:00:00.000Z' }
  p.days = Array.from({ length: 400 }, (_, i) => day(i))
  p.about = { time: '1 соат', at: '2026-01-01T00:00:00.000Z' }
  p.born = 2008
  return ProgressData.parse(p)
}

describe('progress on the wire', () => {
  it('keeps a year of study days and drops lessons never opened', () => {
    const t = trim(busyLearner())
    expect(t.days).toHaveLength(366)
    expect(t.days.at(-1)).toBe(day(399))
    expect(Object.keys(t.lessons)).toHaveLength(120)
  })
  it('compresses a large progress several times and restores it exactly (after trimming)', async () => {
    const p = busyLearner()
    const packed = await pack(p)
    expect('z' in packed).toBe(true)
    expect((packed as { about?: unknown }).about).toEqual(p.about)
    expect(JSON.stringify(packed).length * 3).toBeLessThan(JSON.stringify(p).length)
    expect(await unpack(packed)).toEqual(trim(p))
  })
  it('leaves small progress as plain JSON', async () => {
    const small = emptyProgress()
    expect(await pack(small)).toEqual(trim(small))
    expect(await unpack(small)).toEqual(small)
  })
})
