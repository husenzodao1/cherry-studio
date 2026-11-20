/** Sizing of the "Words of the day" card (WordsOfDay.tsx). */

/** Font sizes tried, largest first; at the smallest, words longer than four lines scroll upward. */
export const SIZES = [1.45, 1.28, 1.14, 1.02]
/** The card shows at most this many lines at once. */
export const LINES = 4
export const LINE_HEIGHT = 1.18

export interface Fit { size: number; rise: number }

/**
 * Which size a quote takes: the largest at which all of it fits in four lines (and in the room above the
 * author); `rise` is how far it has to scroll upward when even the smallest is too tall.
 * `heightAt(size)` lays the words out at that size and returns their height in px; `rem` is 1rem in px.
 */
export function fitQuote(heightAt: (size: number) => number, room: number, rem: number): Fit {
  for (const size of SIZES) {
    const window = Math.min(room, LINES * LINE_HEIGHT * size * rem)
    if (heightAt(size) <= window + 1) return { size, rise: 0 }
  }
  const size = SIZES[SIZES.length - 1]
  const window = Math.min(room, LINES * LINE_HEIGHT * size * rem)
  return { size, rise: Math.max(0, Math.ceil(heightAt(size) - window)) }
}
