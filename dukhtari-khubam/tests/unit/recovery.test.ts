import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkAnswer, clearRecovery, hasRecovery, normalizeAnswer, recoveryQuestions, recoveryWait, setRecovery } from '@/web/offline/recovery'

describe('PIN recovery questions', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k)
    })
  })

  it('compares answers without case, spaces or punctuation', () => {
    expect(normalizeAnswer('  МАНТУ! ')).toBe('манту')
    expect(normalizeAnswer('Ёлка  зелёная')).toBe('елка зеленая')
  })

  it('keeps three different questions with hashed answers and checks them one by one', async () => {
    await setRecovery([{ q: 'food', answer: 'Манту' }, { q: 'city', answer: 'Хуҷанд' }, { q: 'flower', answer: 'Садбарг' }])
    expect(hasRecovery()).toBe(true)
    expect(recoveryQuestions()).toEqual(['food', 'city', 'flower'])
    expect(localStorage.getItem('dk.pin_recovery')).not.toContain('Манту')
    expect(await checkAnswer(0, ' манту ')).toBe('ok')
    expect(await checkAnswer(1, 'Душанбе')).toBe('wrong')
    expect(await checkAnswer(1, 'хуҷанд')).toBe('ok')
    clearRecovery()
    expect(hasRecovery()).toBe(false)
  })

  it('refuses repeated questions and empty answers', async () => {
    await expect(setRecovery([{ q: 'food', answer: 'аа' }, { q: 'food', answer: 'бб' }, { q: 'city', answer: 'вв' }])).rejects.toThrow()
    await expect(setRecovery([{ q: 'food', answer: ' ' }, { q: 'book', answer: 'бб' }, { q: 'city', answer: 'вв' }])).rejects.toThrow()
  })

  it('waits a minute after five wrong answers', async () => {
    await setRecovery([{ q: 'food', answer: 'Манту' }, { q: 'city', answer: 'Хуҷанд' }, { q: 'flower', answer: 'Садбарг' }])
    const now = 1_000_000
    for (let i = 0; i < 4; i++) expect(await checkAnswer(0, 'x', now)).toBe('wrong')
    expect(await checkAnswer(0, 'x', now)).toBe('wait')
    expect(await checkAnswer(0, 'манту', now + 1000)).toBe('wait')
    expect(recoveryWait(now + 1000)).toBe(59)
    expect(await checkAnswer(0, 'манту', now + 61_000)).toBe('ok')
  })
})
