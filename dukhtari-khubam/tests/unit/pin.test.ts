import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkPin, clearPin, hasPin, isPin, setPin, waitLeft } from '@/web/offline/pin'

describe('app PIN', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    })
  })

  it('accepts only four digits', () => {
    expect(isPin('1234')).toBe(true)
    expect(['123', '12345', '12a4', ''].some(isPin)).toBe(false)
  })

  it('keeps a salted hash, checks it, and can be removed', async () => {
    expect(hasPin()).toBe(false)
    await setPin('2580')
    expect(hasPin()).toBe(true)
    expect(localStorage.getItem('dk.pin')).not.toContain('2580')
    expect(await checkPin('1111')).toBe('wrong')
    expect(await checkPin('2580')).toBe('ok')
    clearPin()
    expect(hasPin()).toBe(false)
  })

  it('waits 30 seconds after five wrong tries in a row', async () => {
    await setPin('2580')
    const t0 = 1_000_000
    for (let i = 0; i < 4; i++) expect(await checkPin('0000', t0)).toBe('wrong')
    expect(await checkPin('0000', t0)).toBe('wait')
    expect(waitLeft(t0)).toBe(30)
    expect(await checkPin('2580', t0 + 10_000)).toBe('wait')
    expect(await checkPin('2580', t0 + 31_000)).toBe('ok')
  })
})
