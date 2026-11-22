import { beforeEach, describe, expect, it } from 'vitest'

import { isStaleCode, nextStep } from '@/web/heal'

const store = new Map<string, string>()
Object.assign(globalThis, {
  sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
})

describe('self-healing ladder', () => {
  beforeEach(() => store.clear())
  it('redraws first, then reloads, then goes home, then gives up', () => {
    const t = 1_000_000
    expect(nextStep(t, '/school')).toBe('reset')
    expect(nextStep(t + 1000, '/school')).toBe('reload')
    expect(nextStep(t + 2000, '/school')).toBe('home')
    expect(nextStep(t + 3000, '/')).toBe('give_up')
  })
  it('never sends the home screen home again', () => {
    expect(nextStep(0, '/')).toBe('reset')
    expect(nextStep(1, '/')).toBe('reload')
    expect(nextStep(2, '/')).toBe('give_up')
  })
  it('starts over after a minute of calm', () => {
    expect(nextStep(0, '/a')).toBe('reset')
    expect(nextStep(1, '/a')).toBe('reload')
    expect(nextStep(61_001, '/a')).toBe('reset')
  })
  it('recognises code replaced by a new release', () => {
    expect(isStaleCode('ChunkLoadError: Loading chunk 42 failed')).toBe(true)
    expect(isStaleCode('Failed to fetch dynamically imported module: /x.js')).toBe(true)
    expect(isStaleCode("Cannot read properties of undefined (reading 'x')")).toBe(false)
  })
})
