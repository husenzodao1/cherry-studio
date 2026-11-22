/** Sizing of the "Words of the day" card (WordsOfDay.tsx). */

/** Font sizes tried, largest first; at the smallest, words longer than four lines scroll upward. */
export const SIZES = [1.5, 1.4, 1.3, 1.2, 1.12]
/** The card shows at most this many lines at once. */
export const LINES = 4
export const LINE_HEIGHT = 1.32
/** the quote's own padding above and below its lines (0.08em each, globals.css) */
export const PAD = 0.16
/** the height of four lines at a size, in rem (with the quote's padding) */
export const windowRem = (size: number) => (LINES * LINE_HEIGHT + PAD) * size

export interface Fit { size: number; rise: number }

/** the smallest a poem's line may get so that it stays on one line */
export const MIN_SIZE = 0.8

/**
 * Which size a quote takes: the largest at which all of it fits in four lines (and in the room above the
 * author); `rise` is how far it has to scroll upward when even the smallest is too tall.
 * `heightAt(size)` lays the words out at that size and returns their height in px; `rem` is 1rem in px.
 * `fitsWidth(size)`: whether every line fits across at that size (a poem keeps each of its lines whole):
 * sizes too wide are skipped, and when even the smallest is, it gets smaller still, down to MIN_SIZE.
 */
export function fitQuote(heightAt: (size: number) => number, room: number, rem: number, fitsWidth: (size: number) => boolean = () => true): Fit {
  let sizes = SIZES.filter(fitsWidth)
  if (!sizes.length) {
    let size = SIZES[SIZES.length - 1]
    while (size > MIN_SIZE && !fitsWidth(size)) size = Math.round((size - 0.04) * 100) / 100
    sizes = [Math.max(size, MIN_SIZE)]
  }
  for (const size of sizes) {
    const window = Math.min(room, windowRem(size) * rem)
    if (heightAt(size) <= window + 1) return { size, rise: 0 }
  }
  const size = sizes[sizes.length - 1]
  const window = Math.min(room, windowRem(size) * rem)
  return { size, rise: Math.max(0, Math.ceil(heightAt(size) - window)) }
}
