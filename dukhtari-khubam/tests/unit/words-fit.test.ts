import { describe, expect, it } from 'vitest'

import { fitQuote, LINE_HEIGHT, LINES, MIN_SIZE, PAD, SIZES, windowRem } from '@/lib/wordsFit'

const REM = 16
/** words that take `lines` lines at any size */
/** words that take `n` lines at any size (with the quote's padding, as the browser measures it) */
const lines = (n: number) => (size: number) => (n * LINE_HEIGHT + PAD) * size * REM
const LARGEST = SIZES[0]
const SMALLEST = SIZES[SIZES.length - 1]

describe('words of the day: four lines, the rest scrolls upward', () => {
  it('a short quote keeps the largest size (1.5rem: big, easy to read)', () => {
    expect(fitQuote(lines(2), 400, REM)).toEqual({ size: LARGEST, rise: 0 })
    expect(LARGEST).toBe(1.5)
    // even the longest words never get small: 1.12rem at the least (a poem's wide line may need less)
    expect(SMALLEST).toBeGreaterThanOrEqual(1.1)
  })

  it('a four-line poem fits without moving', () => {
    expect(fitQuote(lines(LINES), 400, REM)).toEqual({ size: LARGEST, rise: 0 })
  })

  it('a poem longer than four lines scrolls up by exactly the hidden lines', () => {
    const fit = fitQuote(lines(7), 400, REM)
    expect(fit.size).toBe(SMALLEST)
    expect(fit.rise).toBe(Math.ceil(lines(7)(SMALLEST) - windowRem(SMALLEST) * REM))
  })

  it('words that wrap into fewer lines at a smaller size take that size', () => {
    // 6 lines at the two largest sizes, 4 lines below them
    const height = (size: number) => lines(size > SIZES[2] ? 6 : 4)(size)
    expect(fitQuote(height, 400, REM)).toEqual({ size: SIZES[2], rise: 0 })
  })

  it('a low card scrolls within the room it has', () => {
    const fit = fitQuote(lines(4), 50, REM)
    expect(fit.rise).toBe(Math.ceil(lines(4)(SMALLEST) - 50))
  })
})

describe('a poem keeps each line whole', () => {
  it('sizes too wide are skipped; when all are, it shrinks below them, never under MIN_SIZE', () => {
    const fit = fitQuote(lines(2), 400, REM, (size) => size <= 1.3)
    expect(fit.size).toBe(1.3)
    const tiny = fitQuote(lines(2), 400, REM, (size) => size <= 0.95)
    expect(tiny.size).toBeLessThanOrEqual(0.95)
    expect(tiny.size).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(fitQuote(lines(2), 400, REM, () => false).size).toBe(MIN_SIZE)
  })
})
