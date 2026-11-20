/**
 * Mahliyo's introduction after sign-in (MahliyoIntro.tsx): the four sentences are written beside her as
 * she says them. These are the stretches of her video (s) in which she speaks, one per sentence, measured
 * from its sound; each sentence is written letter by letter inside its own stretch.
 */
export const SPEECH: readonly [number, number][] = [[1.2, 2.0], [2.45, 3.45], [4.2, 6.55], [7.95, 8.8]]

/** How many letters of each sentence are written at time `t` of the video. */
export function typedAt(lengths: number[], t: number, speech: readonly [number, number][] = SPEECH): number[] {
  return lengths.map((n, i) => {
    const [from, to] = speech[Math.min(i, speech.length - 1)]
    if (t <= from) return 0
    if (t >= to) return n
    return Math.round(n * (t - from) / (to - from))
  })
}

/** When the last sentence is fully written (s). */
export const SPOKEN_BY = SPEECH[SPEECH.length - 1][1]
