import { describe, expect, it } from 'vitest'

import { fitQuote, LINE_HEIGHT, LINES, MIN_SIZE } from '@/lib/wordsFit'

const REM = 16
/** words that take `lines` lines at any size */
const lines = (n: number) => (size: number) => n * LINE_HEIGHT * size * REM

describe('words of the day: four lines, the rest scrolls upward', () => {
  it('a short quote keeps the largest size', () => {
    expect(fitQuote(lines(2), 400, REM)).toEqual({ size: 1.2, rise: 0 })
  })

  it('a four-line poem fits without moving', () => {
    expect(fitQuote(lines(LINES), 400, REM)).toEqual({ size: 1.2, rise: 0 })
  })

  it('a poem longer than four lines scrolls up by exactly the hidden lines', () => {
    const fit = fitQuote(lines(7), 400, REM)
    expect(fit.size).toBe(0.92)
    expect(fit.rise).toBe(Math.ceil(3 * LINE_HEIGHT * 0.92 * REM))
  })

  it('words that wrap into fewer lines at a smaller size take that size', () => {
    // 6 lines at the two largest sizes, 4 lines below them
    const height = (size: number) => (size > 1.05 ? 6 : 4) * LINE_HEIGHT * size * REM
    expect(fitQuote(height, 400, REM)).toEqual({ size: 1, rise: 0 })
  })

  it('a low card scrolls within the room it has', () => {
    const fit = fitQuote(lines(4), 50, REM)
    expect(fit.rise).toBe(Math.ceil(4 * LINE_HEIGHT * 0.92 * REM - 50))
  })
})

describe('a poem keeps each line whole', () => {
  it('sizes too wide are skipped; when all are, it shrinks below them, never under MIN_SIZE', () => {
    const fit = fitQuote(lines(2), 400, REM, (size) => size <= 1.0)
    expect(fit.size).toBe(1.0)
    const tiny = fitQuote(lines(2), 400, REM, (size) => size <= 0.8)
    expect(tiny.size).toBeLessThanOrEqual(0.8)
    expect(tiny.size).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(fitQuote(lines(2), 400, REM, () => false).size).toBe(MIN_SIZE)
  })
})
